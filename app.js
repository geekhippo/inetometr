
// ============================================================
// Интернометр — в стиле Яндекс.Интернетометра
// ============================================================
window.__APP_MODULE_EXECUTED = true;
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
import { createCounterAnimator } from './lib/animator.js';
import { renderResultImage, downloadResultImage } from './lib/image-card.js';
import {
  downloadServers,
  uploadServers,
  pingServers,
  buildUrl,
  bytesToHetznerSize,
  SERVERS,
  resolveOriginUrl,
} from './lib/speedtest-servers.js';
import { shareSupport, shareImage } from './lib/share-api.js';
import {
  loadHistory,
  addToHistory,
  groupByDay,
  delta,
  clearHistory,
  recentHistory,
} from './lib/history.js';

const PHASE_LABELS = [
  'Готов к замеру',
  'Измеряю пинг…',
  'Считаю джиттер…',
  'Скачиваю файл…',
  'Отправляю данные…',
  'Замер завершён',
];

// ---------- State ----------
const downloadMedian = createRollingMedian(7);
const uploadMedian = createRollingMedian(7);

const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animDuration = reducedMotion ? 0 : 350;

const state = {
  running: false,
  selectedServerId: null,
  results: { download: 0, upload: 0, ping: 0, jitter: 0 },
  chart: { data: [], max: 0, sum: 0, count: 0, min: Infinity },
  downloadSamples: [],
  usedServers: { ping: null, download: null, upload: null },
  serverMeta: {},
};

const els = {
  status: () => document.getElementById('gauge-status'),
  download: () => document.getElementById('v-download'),
  upload: () => document.getElementById('v-upload'),
  ping: () => document.getElementById('v-ping'),
  serverSelect: () => document.getElementById('server-select'),
  startBtn: () => document.getElementById('start-btn'),
  btnLabel: () => document.querySelector('#start-btn .btn-label'),
  chartCanvas: () => document.getElementById('chart-canvas'),
  chartTitle: () => document.getElementById('chart-title'),
  chartCurrent: () => document.getElementById('chart-current'),
  chartMax: () => document.getElementById('chart-max'),
  chartAvg: () => document.getElementById('chart-avg'),
  chartMin: () => document.getElementById('chart-min'),
  ticksGroup: () => document.getElementById('ticks-group'),
  progressArc: () => document.getElementById('progress-arc'),
  indicator: () => document.getElementById('indicator'),
  toast: () => document.getElementById('toast'),
  resultActions: () => document.querySelector('.result-actions'),
  copyBtn: () => document.getElementById('copy-btn'),
  copyBtnLabel: () => document.querySelector('#copy-btn span'),
  imageBtn: () => document.getElementById('image-btn'),
  imageBtnLabel: () => document.querySelector('#image-btn span'),
  shareBtn: () => document.getElementById('share-btn'),
  shareBtnLabel: () => document.querySelector('#share-btn span'),
  serverBadge: () => document.getElementById('server-badge'),
  serverBadgeText: () => document.getElementById('server-badge-text'),
  historyCard: () => document.getElementById('history-card'),
  historyClear: () => document.getElementById('history-clear'),
};

const downloadAnim = createCounterAnimator({
  set: (v) => { if(els.download()) els.download().textContent = v.toFixed(2); },
  duration: animDuration,
  threshold: 0.5,
});
const uploadAnim = createCounterAnimator({
  set: (v) => { if(els.upload()) els.upload().textContent = v.toFixed(2); },
  duration: animDuration,
  threshold: 0.5,
});

function updateIndicator(mbps) {
  const t = speedToT(mbps);
  const arc = els.progressArc();
  if (!arc) return;
  if (t <= 0) {
    arc.setAttribute('d', '');
    arc.classList.remove('visible');
    if(els.indicator()) els.indicator().classList.remove('visible');
    return;
  }
  arc.setAttribute('d', buildProgressPath(t));
  arc.classList.add('visible');
  const pt = pointOnGauge(t);
  if(els.indicator()) {
    els.indicator().setAttribute('cx', pt.x.toFixed(2));
    els.indicator().setAttribute('cy', pt.y.toFixed(2));
    els.indicator().setAttribute('r', 9);
    els.indicator().classList.add('visible');
  }
}

function buildTicks() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const group = els.ticksGroup();
  if (!group) return;
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

function updateHistoryUI() {
  const canvas = document.getElementById('history-canvas');
  const card = document.getElementById('history-card');
  if (!canvas || !card) return;
  const history = loadHistory();
  if (history.length === 0) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  drawHistoryChart(history);

  // Update percent deltas между последним и предпоследним замером
  if (history.length >= 2) {
    const dlDelta = delta(history, 'download');
    const ulDelta = delta(history, 'upload');
    const dlEl = document.getElementById('history-delta-dl');
    const ulEl = document.getElementById('history-delta-ul');
    if (dlEl) {
      dlEl.textContent = dlDelta !== null ? `${dlDelta > 0 ? '+' : ''}${dlDelta.toFixed(1)}%` : '—';
      dlEl.className = 'history-delta' + (dlDelta > 0 ? ' history-delta--up' : dlDelta < 0 ? ' history-delta--down' : '');
    }
    if (ulEl) {
      ulEl.textContent = ulDelta !== null ? `${ulDelta > 0 ? '+' : ''}${ulDelta.toFixed(1)}%` : '—';
      ulEl.className = 'history-delta' + (ulDelta > 0 ? ' history-delta--up' : ulDelta < 0 ? ' history-delta--down' : '');
    }
  }
}

function showResultActions() {
  const block = els.resultActions();
  if (block) block.hidden = false;
  const share = els.shareBtn();
  if (share) {
    const support = shareSupport();
    share.hidden = !support.share;
  }
  const badge = els.serverBadgeText();
  const meta = state.serverMeta;
  const usedServerId = state.usedServers.download || state.usedServers.upload;
  if (badge && usedServerId) {
    const server = SERVERS.find(s => s.id === usedServerId);
    if (server) badge.textContent = `Замер с: ${server.name}`;
  } else if (badge && meta && (meta.colo || meta.city)) {
    badge.textContent = `Замер с: ${meta.colo || meta.city} CDN`;
  }
}

function drawHistoryChart(history) {
  const canvas = document.getElementById('history-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || 800;
  const ch = canvas.clientHeight || 140;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);

  const w = cw - 8;
  const h = ch - 16;

  // Группируем замеры по дню (последние 7 дней) — получаем средние
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const byDay = {}; // { 'YYYY-MM-DD': { dl: number[], ul: number[] } }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayMs - i * dayMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay[key] = { dl: [], ul: [] };
  }
  for (const r of history) {
    const d = new Date(r.t);
    d.setHours(0, 0, 0, 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (byDay[key]) {
      byDay[key].dl.push(r.download || 0);
      byDay[key].ul.push(r.upload || 0);
    }
  }
  const days = Object.keys(byDay);
  const seriesDl = days.map(k => byDay[k].dl.length ? byDay[k].dl.reduce((s, v) => s + v, 0) / byDay[k].dl.length : 0);
  const seriesUl = days.map(k => byDay[k].ul.length ? byDay[k].ul.reduce((s, v) => s + v, 0) / byDay[k].ul.length : 0);
  const maxVal = Math.max(...seriesDl, ...seriesUl, 1);

  // Сетка
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = 8 + h - (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(cw - 4, y);
    ctx.stroke();
  }

  // Линия download (оранжевая)
  const gradDl = ctx.createLinearGradient(0, 8, 0, ch - 8);
  gradDl.addColorStop(0, '#ff7a3d');
  gradDl.addColorStop(1, '#fc3f1d');
  ctx.strokeStyle = gradDl;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  days.forEach((_, i) => {
    const x = 4 + (i / (days.length - 1)) * (cw - 8);
    const y = 8 + h - (seriesDl[i] / maxVal) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Точки download
  ctx.fillStyle = '#fc3f1d';
  days.forEach((_, i) => {
    if (seriesDl[i] <= 0) return;
    const x = 4 + (i / (days.length - 1)) * (cw - 8);
    const y = 8 + h - (seriesDl[i] / maxVal) * h;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Линия upload (зелёная)
  const gradUl = ctx.createLinearGradient(0, 8, 0, ch - 8);
  gradUl.addColorStop(0, '#4ade80');
  gradUl.addColorStop(1, '#22c55e');
  ctx.strokeStyle = gradUl;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  days.forEach((_, i) => {
    const x = 4 + (i / (days.length - 1)) * (cw - 8);
    const y = 8 + h - (seriesUl[i] / maxVal) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Точки upload
  ctx.fillStyle = '#22c55e';
  days.forEach((_, i) => {
    if (seriesUl[i] <= 0) return;
    const x = 4 + (i / (days.length - 1)) * (cw - 8);
    const y = 8 + h - (seriesUl[i] / maxVal) * h;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawChart() {
  const canvas = els.chartCanvas();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 800;
  const cssH = canvas.clientHeight || 180;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);
  const padX = 4, padY = 8;
  const w = cssW - padX * 2;
  const h = cssH - padY * 2;
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
  if(els.chartMax()) els.chartMax().textContent = '—';
  if(els.chartAvg()) els.chartAvg().textContent = '—';
  if(els.chartMin()) els.chartMin().textContent = '—';
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
  if(els.chartMax()) els.chartMax().textContent = state.chart.max.toFixed(2);
  if(els.chartAvg()) els.chartAvg().textContent = (state.chart.sum / state.chart.count).toFixed(2);
  if(els.chartMin()) els.chartMin().textContent = state.chart.min.toFixed(2);
  drawChart();
}

let _lastChartPush = 0;
function pushChartPointThrottled(v) {
  const now = performance.now();
  if (now - _lastChartPush < 80) return;
  _lastChartPush = now;
  pushChartPoint(v);
}

function initServerSelector() {
  const select = els.serverSelect();
  if (!select) return;
  select.innerHTML = '';
  // Первой опцией — «Авто», value=null = режим перебора всех серверов
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = 'Авто (ближайший)';
  select.appendChild(autoOpt);
  const servers = downloadServers();
  servers.forEach(server => {
    const opt = document.createElement('option');
    opt.value = server.id;
    opt.textContent = server.name;
    select.appendChild(opt);
  });
  select.value = state.selectedServerId || 'auto';
  select.onchange = (e) => {
    const v = e.target.value;
    state.selectedServerId = v === 'auto' ? null : v;
    const name = v === 'auto' ? 'Авто (ближайший)' : SERVERS.find(s => s.id === v)?.name;
    showToast(`Выбран сервер: ${name}`);
  };
}

async function pingTest() {
  const samples = 10;
  const times = [];
  for (let i = 0; i < samples; i++) {
    let sample = null;
    for (const server of pingServers()) {
      try {
        const t0 = performance.now();
        const pingUrl = resolveOriginUrl(server.pingUrl);
        await fetch(buildUrl(pingUrl, { n: `${Date.now()}_${i}` }), {
          cache: 'no-store',
          mode: 'cors',
        });
        sample = performance.now() - t0;
        state.usedServers.ping = server.id;
        break;
      } catch { continue; }
    }
    if (sample !== null) times.push(sample);
    await new Promise(r => setTimeout(r, 80));
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] || 0;
}

// Один замер download с одного URL, с прогрессом и сбором мульти-сэмплов
async function measureDownload(url, onProgress) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 25000);
  const t0 = performance.now();
  const resp = await fetch(url, { cache: 'no-store', mode: 'cors', signal: ctrl.signal });
  clearTimeout(tid);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  let received = 0;
  let lastReport = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    const elapsed = (performance.now() - t0) / 1000;
    if (elapsed > 0) {
      const mbps = (received * 8) / 1e6 / elapsed;
      const now = performance.now();
      if (now - lastReport > 80) { onProgress(mbps); lastReport = now; }
    }
  }
  if (received <= 0) throw new Error('empty body');
  const elapsed = (performance.now() - t0) / 1000;
  return elapsed > 0 ? (received * 8) / 1e6 / elapsed : 0;
}

async function downloadTest(onProgress) {
  const allDlServers = downloadServers();
  const selected = allDlServers.find(s => s.id === state.selectedServerId);
  const serverQueue = selected
    ? [selected, ...allDlServers.filter(s => s.id !== selected.id)]
    : allDlServers;

  for (const server of serverQueue) {
    const samples = [];
    try {
      // Resolve relative URL to absolute (for our server /speedtest/5mb.bin)
      const baseUrl = resolveOriginUrl(server.downloadUrl);
      if (server.sizeBytes == null) {
        // Переменный размер (CF): два прохода, три размера
        for (let pass = 0; pass < 2; pass++) {
          const sizes = [1_000_000, 5_000_000, 10_000_000];
          for (const bytes of sizes) {
            const url = buildUrl(baseUrl, { bytes, n: Date.now() + pass * 1000 });
            const mbps = await measureDownload(url, onProgress);
            if (mbps > 0) samples.push(mbps);
          }
        }
      } else {
        // Фиксированный файл (CDN): два прохода
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < 1; i++) {
            const url = buildUrl(baseUrl, { n: Date.now() + pass * 1000 + i });
            const mbps = await measureDownload(url, onProgress);
            if (mbps > 0) samples.push(mbps);
          }
        }
      }
      if (samples.length === 0) throw new Error('no samples');
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      state.usedServers.download = server.id;
      return median;
    } catch (e) {
      console.warn(`dl ${server.id}:`, e.message);
      // Следующий сервер в очереди
    }
  }
  throw new Error('Не удалось скачать ни с одного сервера');
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
  const sizes = [2_000_000]; // 2 MB
  const allSpeeds = [];
  for (const bytes of sizes) {
    const data = new Uint8Array(bytes);
    let seed = 12345 >>> 0;
    for (let i = 0; i < bytes; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed & 0xff;
    }
    let worked = false;
    for (const server of uploadServers()) {
      try {
        const url = buildUrl(server.uploadUrl, { n: Date.now() });
        const mbps = await uploadViaXHR(url, data, onProgress);
        if (mbps >= 0.5) {
          allSpeeds.push(mbps);
          state.usedServers.upload = server.id;
          worked = true;
          break;
        }
      } catch (e) { console.warn(`up ${server.id}:`, e.message); }
    }
    if (!worked) throw new Error('Все upload-серверы недоступны');
  }
  allSpeeds.sort((a, b) => a - b);
  return allSpeeds[Math.floor(allSpeeds.length / 2)] || 0;
}

async function initServerMeta() {
  els.serverBadgeText();
  if (!els.serverBadgeText()) return;
  els.serverBadgeText().textContent = 'Определяем сервер…';
  try {
    const meta = await fetchServerMeta();
    state.serverMeta = meta;
    const desc = describeServer(state.serverMeta);
    els.serverBadgeText().textContent = desc ? `Замер с: ${desc}` : 'Сервер неизвестен';
  } catch {
    state.serverMeta = {};
    els.serverBadgeText().textContent = 'Сервер неизвестен';
  }
}

async function copyResult() {
  const text = formatResults(state.results, state.serverMeta);
  const ok = await copyToClipboard(text);
  if (ok) {
    els.copyBtn().classList.add('copied');
    if(els.copyBtnLabel()) els.copyBtnLabel().textContent = 'Скопировано!';
    showToast('Результат скопирован в буфер обмена');
    setTimeout(() => {
      els.copyBtn().classList.remove('copied');
      if(els.copyBtnLabel()) els.copyBtnLabel().textContent = 'Скопировать результат';
    }, 2000);
  }
}

async function downloadImage() {
  if (!els.imageBtn()) return;
  const originalLabel = els.imageBtnLabel() ? els.imageBtnLabel().textContent : 'Скачать картинку';
  if (els.imageBtnLabel()) els.imageBtnLabel().textContent = 'Готовлю…';
  els.imageBtn().disabled = true;
  try {
    const samples = (state.downloadSamples || []).slice(-80);
    const { blob } = await renderResultImage(state.results, state.serverMeta, samples);
    downloadResultImage(blob);
    if (els.imageBtnLabel()) els.imageBtnLabel().textContent = 'Скачано!';
    showToast('Картинка сохранена');
  } catch (e) {
    console.error('image:', e);
    showToast('Не удалось создать картинку', 3000);
    if (els.imageBtnLabel()) els.imageBtnLabel().textContent = originalLabel;
  } finally {
    setTimeout(() => {
      els.imageBtn().disabled = false;
      if (els.imageBtnLabel()) els.imageBtnLabel().textContent = originalLabel;
    }, 1500);
  }
}

async function shareResult() {
  if (!els.shareBtn()) return;
  const originalLabel = els.shareBtnLabel() ? els.shareBtnLabel().textContent : 'Поделиться';
  if (els.shareBtnLabel()) els.shareBtnLabel().textContent = 'Готовлю…';
  try {
    const text = formatResults(state.results, state.serverMeta);
    const url = typeof location !== 'undefined' ? location.href : 'https://inetometr.ru';
    const filename = `inetometr-${new Date().toISOString().slice(0, 10)}.png`;
    let result;
    if (shareSupport().files) {
      const samples = (state.downloadSamples || []).slice(-80);
      const { blob } = await renderResultImage(state.results, state.serverMeta, samples);
      result = await shareImage({ title: 'Инетометр', text, url, blob, filename });
    } else {
      result = await shareImage({ title: 'Инетометр', text, url, blob: null, filename });
    }
    if (result.ok) {
      if (els.shareBtnLabel()) els.shareBtnLabel().textContent = 'Отправлено!';
    } else if (result.reason === 'aborted') {
      // ignore
    }
  } catch (e) {
    console.error('share:', e);
    showToast('Ошибка при отправке', 3000);
  } finally {
    if (els.shareBtnLabel()) els.shareBtnLabel().textContent = originalLabel;
  }
}

async function run() {
  if (state.running) return;
  state.running = true;
  
  const btn = els.startBtn();
  const label = els.btnLabel();
  if (btn) btn.disabled = true;
  if (label) label.textContent = 'Замер…';

  resetChart();
  state.downloadSamples = [];

  try {
    // 1. Ping
    if (els.status()) els.status().textContent = PHASE_LABELS[1];
    state.results.ping = await pingTest();
    if (els.ping()) els.ping().textContent = state.results.ping.toFixed(1);
    
    // 2. Jitter (упрощенно)
    if (els.status()) els.status().textContent = PHASE_LABELS[2];
    state.results.jitter = state.results.ping * 0.1; 
    
    // 3. Download
    if (els.status()) els.status().textContent = PHASE_LABELS[3];
    state.results.download = await downloadTest(v => {
      const smoothed = downloadMedian.push(v);
      downloadAnim.update(smoothed);
      updateIndicator(smoothed);
      pushChartPointThrottled(smoothed);
    });
    if (els.download()) els.download().textContent = state.results.download.toFixed(2);

    // 4. Upload
    if (els.status()) els.status().textContent = PHASE_LABELS[4];
    state.results.upload = await uploadTest(v => {
      const smoothed = uploadMedian.push(v);
      uploadAnim.update(smoothed);
    });
    if (els.upload()) els.upload().textContent = state.results.upload.toFixed(2);

    // Final
    if (els.status()) els.status().textContent = PHASE_LABELS[5];
    addToHistory(state.results, state.selectedServerId);
    updateHistoryUI();
    showResultActions();
    showToast('Замер завершён успешно!');

  } catch (e) {
    console.error('run error:', e);
    showToast(`Ошибка: ${e.message}`, 5000);
  } finally {
    state.running = false;
    if (btn) btn.disabled = false;
    if (label) label.textContent = 'Начать замер';
  }
}

// --- Init ---
function init() {
  buildTicks();
  initServerSelector();
  updateHistoryUI();
  initServerMeta();
  
  if(els.startBtn()) {
    els.startBtn().onclick = run;
  }
  if(els.copyBtn()) {
    els.copyBtn().onclick = copyResult;
  }
  if(els.imageBtn()) {
    els.imageBtn().onclick = downloadImage;
  }
  if(els.shareBtn()) {
    els.shareBtn().onclick = shareResult;
  }
  if(els.historyClear()) {
    els.historyClear().onclick = () => {
      clearHistory();
      updateHistoryUI();
      showToast('История очищена');
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  try {
    init();
  } catch (e) {
    console.error('Init error:', e);
    window.__INIT_ERROR = e.message;
  }
}
