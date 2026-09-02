// ============================================================
// Интернометр — в стиле Яндекс.Интернетометра
// ============================================================
import {
  GAUGE_GEOM,
  TICK_COUNT,
  TICK_LONG_EVERY,
  speedToT,
  pointOnGauge,
  buildProgressPath,
  generateTicks,
} from './lib/gauge.js';
import { formatResults, copyToClipboard } from './lib/share.js';
import { fetchServerMeta, describeServer } from './lib/server-meta.js';
import { createRollingMedian } from './lib/stats.js';

const DOWNLOAD_URL = 'https://speed.cloudflare.com/__down?bytes=';
const UPLOAD_URL = 'https://speed.cloudflare.com/__up';
const PING_URL = 'https://speed.cloudflare.com/__down?bytes=0';

const PHASE_LABELS = [
  'Готов к замеру',
  'Измеряю пинг…',
  'Считаю джиттер…',
  'Скачиваю файл…',
  'Отправляю данные…',
  'Замер завершён',
];

// ---------- State ----------
// Streaming rolling median для UI-цифр (окно 7 сэмплов ≈ 1.4с при 200мс интервале).
// Убирает одиночные выбросы (TCP bursts, GC паузы), но не задерживает реакцию.
const downloadMedian = createRollingMedian(7);
const uploadMedian = createRollingMedian(7);

const state = {
  running: false,
  results: { download: 0, upload: 0, ping: 0, jitter: 0 },
  chart: { data: [], max: 0, sum: 0, count: 0, min: Infinity },
  serverMeta: {},
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  status: $('gauge-status'),
  download: $('v-download'),
  upload: $('v-upload'),
  ping: $('v-ping'),
  startBtn: $('start-btn'),
  btnLabel: document.querySelector('#start-btn .btn-label'),
  chartCanvas: $('chart-canvas'),
  chartTitle: $('chart-title'),
  chartCurrent: $('chart-current'),
  chartMax: $('chart-max'),
  chartAvg: $('chart-avg'),
  chartMin: $('chart-min'),
  ticksGroup: $('ticks-group'),
  progressArc: $('progress-arc'),
  indicator: $('indicator'),
  toast: $('toast'),
  resultActions: document.querySelector('.result-actions'),
  copyBtn: $('copy-btn'),
  copyBtnLabel: document.querySelector('#copy-btn span'),
  serverBadge: $('server-badge'),
  serverBadgeText: $('server-badge-text'),
};

// Геометрия и лог-шкала импортируются из ./lib/gauge.js (testable, no DOM).
// Тики, индикатор и дуга используют одну и ту же GAUGE_GEOM — гарантия отсутствия дрейфа.

function updateIndicator(mbps) {
  const t = speedToT(mbps);
  const arc = els.progressArc;
  if (t <= 0) {
    arc.setAttribute('d', '');
    arc.classList.remove('visible');
    els.indicator.classList.remove('visible');
    return;
  }
  arc.setAttribute('d', buildProgressPath(t));
  arc.classList.add('visible');
  const pt = pointOnGauge(t);
  els.indicator.setAttribute('cx', pt.x.toFixed(2));
  els.indicator.setAttribute('cy', pt.y.toFixed(2));
  els.indicator.setAttribute('r', 9);
  els.indicator.classList.add('visible');
}

// ---------- Ticks (как у Яндекса) ----------
// Чистая геометрия — в lib/gauge.js (TICK_COUNT, TICK_LONG_EVERY, generateTicks).
function buildTicks() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const group = els.ticksGroup;
  group.innerHTML = '';
  const ticks = generateTicks(GAUGE_GEOM, TICK_COUNT, TICK_LONG_EVERY);
  for (const tick of ticks) {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', tick.x1.toFixed(2));
    line.setAttribute('y1', tick.y1.toFixed(2));
    line.setAttribute('x2', tick.x2.toFixed(2));
    line.setAttribute('y2', tick.y2.toFixed(2));
    line.setAttribute('class', 'tick');
    group.appendChild(line);
  }
}
buildTicks();

// ---------- Chart ----------
const ctx = els.chartCanvas.getContext('2d');

function drawChart() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = els.chartCanvas.clientWidth || 800;
  const cssH = els.chartCanvas.clientHeight || 180;
  if (els.chartCanvas.width !== cssW * dpr || els.chartCanvas.height !== cssH * dpr) {
    els.chartCanvas.width = cssW * dpr;
    els.chartCanvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);

  const padX = 4, padY = 8;
  const w = cssW - padX * 2;
  const h = cssH - padY * 2;

  // Сетка-подложка
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = padY + h - (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + w, y);
    ctx.stroke();
  }

  const data = state.chart.data;
  if (data.length < 2) return;
  const max = Math.max(state.chart.max, 1);
  const min = 0;

  const grad = ctx.createLinearGradient(0, padY, 0, padY + h);
  grad.addColorStop(0, '#ff7a3d');
  grad.addColorStop(1, '#fc3f1d');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = padX + (i / (data.length - 1)) * w;
    const y = padY + h - ((v - min) / (max - min || 1)) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function resetChart() {
  state.chart = { data: [], max: 0, sum: 0, count: 0, min: Infinity };
  els.chartMax.textContent = '—';
  els.chartAvg.textContent = '—';
  els.chartMin.textContent = '—';
  drawChart();
}

function pushChartPoint(v) {
  state.chart.data.push(v);
  if (state.chart.data.length > 120) {
    const removed = state.chart.data.shift();
    state.chart.sum -= removed;
    state.chart.count -= 1;
  } else {
    state.chart.count += 1;
  }
  state.chart.max = Math.max(state.chart.max, v);
  state.chart.min = Math.min(state.chart.min, v);
  state.chart.sum += v;
  els.chartMax.textContent = state.chart.max.toFixed(2);
  els.chartAvg.textContent = (state.chart.sum / state.chart.count).toFixed(2);
  els.chartMin.textContent = state.chart.min.toFixed(2);
  drawChart();
}

// Троттлинг pushChartPoint: обновление графика не чаще 12 раз в секунду (~80 мс)
let _lastChartPush = 0;
function pushChartPointThrottled(v) {
  const now = performance.now();
  if (now - _lastChartPush < 80) return;
  _lastChartPush = now;
  pushChartPoint(v);
}

// ---------- Tests ----------
async function pingTest() {
  const samples = 10;
  const times = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    await fetch(`${PING_URL}&_=${Date.now()}_${i}`, { cache: 'no-store', mode: 'cors' });
    times.push(performance.now() - t0);
    await sleep(80);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

async function downloadTest(onProgress) {
  const urlBuilders = [
    (bytes) => `https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Date.now()}_${bytes}`,
    (bytes) => {
      const label = bytes >= 100_000_000 ? '100MB' : bytes >= 10_000_000 ? '10MB' : '1MB';
      return `https://speed.hetzner.de/${label}.bin?_=${Date.now()}`;
    },
  ];
  const sizes = [1_000_000, 5_000_000, 10_000_000, 25_000_000];
  const allSpeeds = [];
  for (const bytes of sizes) {
    let worked = false;
    for (const build of urlBuilders) {
      try {
        const t0 = performance.now();
        const resp = await fetch(build(bytes), { cache: 'no-store', mode: 'cors' });
        if (!resp.ok) continue;
        const reader = resp.body.getReader();
        let received = 0;
        let lastSample = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed > 0) {
            const mbps = (received * 8) / 1e6 / elapsed;
            onProgress(mbps);
            // Сэмплируем не чаще раза в 200 мс — иначе массив раздувается
            if (performance.now() - lastSample > 200) {
              allSpeeds.push(mbps);
              lastSample = performance.now();
            }
          }
        }
        const totalElapsed = (performance.now() - t0) / 1000;
        if (totalElapsed > 0) {
          allSpeeds.push((received * 8) / 1e6 / totalElapsed);
        }
        worked = true;
        break;
      } catch (e) { console.warn('dl:', e.message); }
    }
    if (!worked) throw new Error(`Не удалось скачать ${bytes} байт`);
  }
  allSpeeds.sort((a, b) => a - b);
  return allSpeeds[Math.floor(allSpeeds.length / 2)] || 0;
}

function uploadViaXHR(url, data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const t0 = performance.now();
    let lastReported = 0;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed <= 0) return;
      const mbps = (e.loaded * 8) / 1e6 / elapsed;
      const now = performance.now();
      if (now - lastReported > 100) {
        onProgress(mbps);
        lastReported = now;
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const elapsed = (performance.now() - t0) / 1000;
        resolve(elapsed > 0 ? (data.byteLength * 8) / 1e6 / elapsed : 0);
      } else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.timeout = 30000;
    xhr.send(data);
  });
}

async function uploadTest(onProgress) {
  const endpoints = ['https://speed.cloudflare.com/__up', 'https://nghttp2.org/httpbin/post'];
  const sizes = [500_000, 2_000_000, 5_000_000];
  const allSpeeds = [];
  for (const bytes of sizes) {
    const data = new Uint8Array(bytes);
    // Псевдослучайное заполнение (LCG) — данные плохо сжимаются на проводе
    let seed = 12345 >>> 0;
    for (let i = 0; i < bytes; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed & 0xff;
    }
    let worked = false;
    for (const url of endpoints) {
      try {
        const mbps = await uploadViaXHR(url, data, onProgress);
        if (mbps > 0) {
          allSpeeds.push(mbps);
          worked = true;
          break;
        }
      } catch (e) { console.warn('up:', e.message); }
    }
    if (!worked) throw new Error('Все upload-серверы недоступны');
  }
  allSpeeds.sort((a, b) => a - b);
  return allSpeeds[Math.floor(allSpeeds.length / 2)] || 0;
}

// ---------- Server meta (CDN) ----------
// При загрузке страницы делаем probe-чанк (1 КБ) к Cloudflare и парсим cf-meta-* заголовки.
// Это нужно для бейджа "Замер с сервера MOW" и для текста в копии результата.
async function initServerMeta() {
  els.serverBadgeText.textContent = 'Определяем сервер…';
  try {
    const meta = await fetchServerMeta();
    state.serverMeta = meta;
    showServerBadge();
  } catch {
    state.serverMeta = {};
    els.serverBadgeText.textContent = 'Сервер неизвестен';
  }
}

function showServerBadge() {
  const desc = describeServer(state.serverMeta);
  if (desc) {
    els.serverBadgeText.textContent = `Замер с: ${desc}`;
  } else {
    els.serverBadgeText.textContent = 'Сервер неизвестен';
  }
}

// ---------- Copy result ----------
async function copyResult() {
  const text = formatResults(state.results, state.serverMeta);
  const ok = await copyToClipboard(text);
  if (ok) {
    els.copyBtn.classList.add('copied');
    if (els.copyBtnLabel) els.copyBtnLabel.textContent = 'Скопировано!';
    showToast('Результат скопирован в буфер обмена');
    setTimeout(() => {
      els.copyBtn.classList.remove('copied');
      if (els.copyBtnLabel) els.copyBtnLabel.textContent = 'Скопировать результат';
    }, 2000);
  } else {
    showToast('Не удалось скопировать — скопируйте вручную', 3000);
  }
}

// ---------- Run ----------
async function runTest() {
  if (state.running) return;
  state.running = true;
  state.results = { download: 0, upload: 0, ping: 0, jitter: 0 };
  // Сбросить медианы — иначе первый сэмпл нового замера будет сглажен с предыдущим.
  downloadMedian.reset();
  uploadMedian.reset();
  els.download.textContent = '—';
  els.upload.textContent = '—';
  els.ping.textContent = '—';
  resetChart();
  // сброс индикатора шкалы
  els.progressArc.setAttribute('d', '');
  els.progressArc.classList.remove('visible');
  els.indicator.classList.remove('visible');
  els.startBtn.disabled = true;
  els.startBtn.classList.add('running');
  // Скрыть кнопку "Скопировать" до завершения нового замера
  if (els.resultActions) els.resultActions.hidden = true;

  try {
    // Phase 1: Ping
    setStatus(1);
    els.ping.textContent = '…';
    const ping = await pingTest();
    state.results.ping = ping;
    els.ping.textContent = ping.toFixed(0);
    showToast(`Пинг: ${ping.toFixed(0)} мс`);

    // Phase 2: Download
    setStatus(3);
    els.chartTitle.textContent = 'Скорость входящая';
    els.download.textContent = '…';
    const dl = await downloadTest((mbps) => {
      // Показываем сглаженное значение, чтобы цифра не прыгала.
      const smoothed = downloadMedian.push(mbps);
      els.download.textContent = smoothed.toFixed(2);
      els.chartCurrent.textContent = `${smoothed.toFixed(2)} Мбит/с`;
      pushChartPointThrottled(smoothed);
      updateIndicator(smoothed);
    });
    state.results.download = dl;
    els.download.textContent = dl.toFixed(2);
    els.chartCurrent.textContent = `${dl.toFixed(2)} Мбит/с`;
    updateIndicator(dl);
    showToast(`Загрузка: ${dl.toFixed(2)} Мбит/с`);

    // Phase 3: Upload
    setStatus(4);
    resetChart();
    els.chartTitle.textContent = 'Скорость исходящая';
    els.upload.textContent = '…';
    const ul = await uploadTest((mbps) => {
      const smoothed = uploadMedian.push(mbps);
      els.upload.textContent = smoothed.toFixed(2);
      els.chartCurrent.textContent = `${smoothed.toFixed(2)} Мбит/с`;
      pushChartPointThrottled(smoothed);
      updateIndicator(smoothed);
    });
    state.results.upload = ul;
    els.upload.textContent = ul.toFixed(2);
    els.chartCurrent.textContent = `${ul.toFixed(2)} Мбит/с`;
    // Финальный индикатор — оставляем на upload
    updateIndicator(ul);
    showToast(`Отдача: ${ul.toFixed(2)} Мбит/с`);

    setStatus(5);
    showToast(`Готово: ↓${dl.toFixed(1)} / ↑${ul.toFixed(1)} Мбит/с`);
    // Показать блок "Скопировать + бейдж сервера"
    if (els.resultActions) els.resultActions.hidden = false;
  } catch (e) {
    console.error(e);
    showToast('Ошибка: ' + (e.message || e), 4000);
    setStatus(0);
  } finally {
    state.running = false;
    els.startBtn.disabled = false;
    els.startBtn.classList.remove('running');
    els.btnLabel.textContent = 'Повторить';
  }
}

function setStatus(n) {
  els.status.textContent = PHASE_LABELS[n];
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let toastTimer;
function showToast(msg, ms = 2500) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

// ---------- Wire up ----------
els.startBtn.addEventListener('click', runTest);
$('info-btn').addEventListener('click', () => $('info-dialog').showModal());
if (els.copyBtn) els.copyBtn.addEventListener('click', copyResult);

setStatus(0);
els.chartCurrent.textContent = '— Мбит/с';
window.addEventListener('resize', drawChart);

// Запустить определение CDN-сервера сразу при загрузке страницы
// (не блокирует UI; результат появится в бейдже)
initServerMeta();

window.addEventListener('error', (e) => {
  console.error('[ERR]', e.message);
  showToast('Ошибка: ' + e.message, 6000);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[REJ]', e.reason?.message || e.reason);
  showToast('Ошибка: ' + (e.reason?.message || e.reason), 6000);
});