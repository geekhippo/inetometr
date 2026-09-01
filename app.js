// ============================================================
// Интернометр — в стиле Яндекс.Интернетометра
// ============================================================

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

const state = {
  running: false,
  results: { download: 0, upload: 0, ping: 0, jitter: 0 },
  chart: { data: [], max: 0, sum: 0, count: 0, min: Infinity },
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
  chartCanvas: $('chart'),
  chartTitle: $('chart-title'),
  chartCurrent: $('chart-current'),
  chartMax: $('chart-max'),
  chartAvg: $('chart-avg'),
  chartMin: $('chart-min'),
  ticksGroup: $('ticks-group'),
  progressArc: $('progress-arc'),
  indicator: $('indicator'),
  toast: $('toast'),
};

// Геометрия шкалы — соответствует реальному расположению тиков в viewBox 800x460
// Тики: i=0 (y=460, x=22), i=60 (y=82, x=400), i=120 (y=460, x=778)
// Значит: cx=400, cy=460, rx=378, ry=378 (полуэллипс с центром внизу viewBox)
const GAUGE_GEOM = { cx: 400, cy: 460, rx: 378, ry: 378, maxMbps: 1000 };

// Перевод Мбит/с в нормализованное значение 0..1 (логарифмическая шкала: 0→0, 100→0.5, 1000→1)
function speedToT(mbps) {
  if (mbps <= 0) return 0;
  // log10 шкала от 1 до 1000: 1 -> 0, 1000 -> 1
  const minVal = 1, maxVal = GAUGE_GEOM.maxMbps;
  const t = (Math.log10(Math.max(mbps, minVal)) - Math.log10(minVal)) / (Math.log10(maxVal) - Math.log10(minVal));
  return Math.max(0, Math.min(1, t));
}

// t=0..1 -> координаты на эллиптической дуге (угол от 180° слева до 360°/0° справа)
function pointOnGauge(t) {
  const angleDeg = 180 + t * 180; // 180..360
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: GAUGE_GEOM.cx + Math.cos(angle) * GAUGE_GEOM.rx,
    y: GAUGE_GEOM.cy + Math.sin(angle) * GAUGE_GEOM.ry,
  };
}

// Строим SVG path от начальной точки (t=0) до заданной t
function buildProgressPath(t) {
  if (t <= 0) return '';
  // Эллиптическая дуга — используем SVG arc команду
  const start = pointOnGauge(0);
  const end = pointOnGauge(t);
  // Эллиптическая дуга через ВЕРХ (sweep=1, large=0) — всегда, при любом t
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${GAUGE_GEOM.rx} ${GAUGE_GEOM.ry} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

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
function buildTicks() {
  const svgNS = 'http://www.w3.org/2000/svg';
  // Шкала — полукруг снизу + боковые дуги. viewBox 800x460.
  // Центр эллипса: cx=400, cy=460 (низ). Радиусы: rx=400, ry=240.
  // Угол от 0 (правая сторона) до 180 (левая) — это верхняя дуга.
  const cx = 400, cy = 460;
  const rx = 385, ry = 240;
  const totalTicks = 121; // шаг через каждые ~1.5 градуса
  const longEvery = 10;   // длинные тики
  const group = els.ticksGroup;
  group.innerHTML = '';

  for (let i = 0; i < totalTicks; i++) {
    // угол от 180° (слева) до 360°/0° (справа) — проходим через верх
    const t = i / (totalTicks - 1); // 0..1
    const angleDeg = 180 + t * 180;
    const angle = (angleDeg * Math.PI) / 180;

    const isLong = i % longEvery === 0;
    const rOuter = isLong ? rx : rx - 4;
    const rInner = rx - (isLong ? 14 : 8);

    const x1 = cx + Math.cos(angle) * rInner;
    const y1 = cy + Math.sin(angle) * rInner;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
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
  if (state.chart.data.length > 120) state.chart.data.shift();
  state.chart.max = Math.max(state.chart.max, v);
  state.chart.min = Math.min(state.chart.min, v);
  state.chart.sum += v;
  state.chart.count += 1;
  els.chartMax.textContent = state.chart.max.toFixed(2);
  els.chartAvg.textContent = (state.chart.sum / state.chart.count).toFixed(2);
  els.chartMin.textContent = state.chart.min.toFixed(2);
  drawChart();
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
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed > 0) {
            const mbps = (received * 8) / 1e6 / elapsed;
            onProgress(mbps);
            allSpeeds.push(mbps);
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
  const cut = Math.floor(allSpeeds.length * 0.2);
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
    for (let i = 0; i < bytes; i += 4096) data[i] = i & 255;
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

// ---------- Run ----------
async function runTest() {
  if (state.running) return;
  state.running = true;
  state.results = { download: 0, upload: 0, ping: 0, jitter: 0 };
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
      els.download.textContent = mbps.toFixed(2);
      els.chartCurrent.textContent = `${mbps.toFixed(2)} Мбит/с`;
      pushChartPoint(mbps);
      updateIndicator(mbps);
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
      els.upload.textContent = mbps.toFixed(2);
      els.chartCurrent.textContent = `${mbps.toFixed(2)} Мбит/с`;
      pushChartPoint(mbps);
      updateIndicator(mbps);
    });
    state.results.upload = ul;
    els.upload.textContent = ul.toFixed(2);
    els.chartCurrent.textContent = `${ul.toFixed(2)} Мбит/с`;
    // Финальный индикатор — оставляем на upload
    updateIndicator(ul);
    showToast(`Отдача: ${ul.toFixed(2)} Мбит/с`);

    setStatus(5);
    showToast(`Готово: ↓${dl.toFixed(1)} / ↑${ul.toFixed(1)} Мбит/с`);
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

setStatus(0);
els.chartCurrent.textContent = '— Мбит/с';
window.addEventListener('resize', drawChart);

window.addEventListener('error', (e) => {
  console.error('[ERR]', e.message);
  showToast('Ошибка: ' + e.message, 6000);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[REJ]', e.reason?.message || e.reason);
  showToast('Ошибка: ' + (e.reason?.message || e.reason), 6000);
});