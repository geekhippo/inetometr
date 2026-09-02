// ============================================================
// Inetometer — история замеров в localStorage + агрегаты
// ============================================================

const STORAGE_KEY = 'inetometr:history:v1';
const MAX_HISTORY = 50; // замеров

/**
 * @typedef {object} HistoryEntry
 * @property {number} t          — timestamp (ms)
 * @property {number} download   — Мбит/с
 * @property {number} upload     — Мбит/с
 * @property {number} ping       — мс
 * @property {string} [server]   — ID сервера
 */

/**
 * Загрузить историю из localStorage. Возвращает [] если ничего нет.
 * @returns {HistoryEntry[]}
 */
export function loadHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Сохранить историю.
 * @param {HistoryEntry[]} history
 */
export function saveHistory(history) {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = history.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Квота localStorage — молча игнорируем
    console.warn('saveHistory:', e.message);
  }
}

/**
 * Добавить новый замер в историю.
 * @param {object} results    {download, upload, ping}
 * @param {string} [serverId]
 * @returns {HistoryEntry[]} обновлённая история
 */
export function addToHistory(results, serverId) {
  const entry = {
    t: Date.now(),
    download: results.download || 0,
    upload: results.upload || 0,
    ping: results.ping || 0,
    server: serverId,
  };
  const history = loadHistory();
  history.push(entry);
  saveHistory(history);
  return history;
}

/**
 * Очистить историю.
 */
export function clearHistory() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Сгруппировать замеры по дням (последние `days` дней).
 * @param {HistoryEntry[]} history
 * @param {number} days
 * @returns {Map<number, {download: number[], upload: number[], count: number}>}
 *   ключ Map — начало дня (ms)
 */
export function groupByDay(history, days = 7) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(now - (days - 1) * dayMs);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();

  /** @type {Map<number, {download: number[], upload: number[], count: number}>} */
  const out = new Map();
  for (let i = 0; i < days; i++) {
    out.set(startMs + i * dayMs, { download: [], upload: [], count: 0 });
  }

  for (const e of history) {
    if (e.t < startMs) continue;
    const d = new Date(e.t);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    const bucket = out.get(key);
    if (bucket) {
      bucket.download.push(e.download);
      bucket.upload.push(e.upload);
      bucket.count += 1;
    }
  }
  return out;
}

/**
 * Посчитать среднее по массиву; пустой → 0.
 * @param {number[]} arr
 */
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Дельта в процентах: ((текущее - предыдущее) / предыдущее) * 100.
 * Возвращает null если предыдущее = 0 или нет данных.
 *
 * @param {HistoryEntry[]} history
 * @param {'download'|'upload'|'ping'} metric
 * @returns {number|null}
 */
export function delta(history, metric) {
  if (!history || history.length < 2) return null;
  const last = history[history.length - 1][metric];
  const prev = history[history.length - 2][metric];
  if (!prev || prev <= 0) return null;
  return ((last - prev) / prev) * 100;
}

/**
 * Средние значения за последние `days` дней.
 * @param {HistoryEntry[]} history
 * @param {number} days
 * @returns {{download: number, upload: number, count: number}}
 */
export function averagesLastDays(history, days = 7) {
  const grouped = groupByDay(history, days);
  let totalDl = 0, totalUl = 0, totalCount = 0;
  for (const bucket of grouped.values()) {
    totalDl += avg(bucket.download) * bucket.download.length;
    totalUl += avg(bucket.upload) * bucket.upload.length;
    totalCount += bucket.count;
  }
  if (totalCount === 0) return { download: 0, upload: 0, count: 0 };
  return {
    download: totalDl / totalCount,
    upload: totalUl / totalCount,
    count: totalCount,
  };
}

/**
 * Получить историю, отфильтрованную по последним `days` дням.
 */
export function recentHistory(history, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter((e) => e.t >= cutoff);
}
