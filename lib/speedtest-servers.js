// ============================================================
// Inetometr — конфигурация серверов для замера скорости
// Каждый сервер имеет URL-билдер для download/upload/ping
// и человекочитаемое имя. Серверы опрашиваются по приоритету.
//
// ОГРАНИЧЕНИЕ БРАУЗЕРА: HTTP-запрос с mode:"cors" требует от сервера
// заголовок Access-Control-Allow-Origin. Большинство публичных зеркал
// (Hetzner, OVH probe, Python, Mozilla, Ubuntu, Yandex mirror и т.п.)
// этот заголовок не отдают — браузер режет запрос. Поэтому ниже только
// проверенные CORS-совместимые источники.
//
// Стратегия: используем НАШ сервер inetometr.ru (87.121.221.180, РФ) —
// same-origin в продакшене → CORS не нужен. Для локальной разработки
// (127.0.0.1:8766) тот же путь отдаётся локальным Python-сервером.
// ============================================================

/**
 * @typedef {object} ServerConfig
 * @property {string}   id              — короткий ID
 * @property {string}   name            — отображаемое имя
 * @property {string}   region          — тип дистрибуции ("RU", "Anycast", "Global")
 * @property {string}   downloadUrl     — URL для скачивания
 * @property {string}   uploadUrl       — URL для upload
 * @property {string}   pingUrl         — URL для ping-замера
 * @property {?number}  sizeBytes       — размер файла (null если ?bytes переменная)
 * @property {number}   priority        — чем меньше, тем раньше пробуется
 */

/** @type {ServerConfig[]} */
export const SERVERS = [
  {
      id: 'inetometr',
      name: 'Инетометр (наш сервер)',
      region: 'RU',
      // Наш производство на 87.121.221.180 (Амстердам, РФ-сегмент)
      // Файл speedtest/5mb.bin кладётся в /var/www/inetometr/speedtest/.
      // В проде использует same-origin (CORS не нужен),
      // в локальной разработке тоже same-origin (127.0.0.1:8766).
      downloadUrl: '/speedtest/5mb.bin',
      uploadUrl: null,  // нет своего upload-handler'а → используем CF
      pingUrl: '/speedtest/5mb.bin?ping&_={n}',
      sizeBytes: 5242880,
      priority: 1,
    },
  {
    id: 'cloudflare',
    name: 'Cloudflare (anycast)',
    region: 'Global',
    // speed.cloudflare.com — переменный bytes 1..100МБ
    downloadUrl: 'https://speed.cloudflare.com/__down?bytes={bytes}&_={n}',
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'https://speed.cloudflare.com/__down?bytes=0&_={n}',
    sizeBytes: null,
    priority: 2,
  },
  {
    id: 'jsdelivr',
    name: 'jsDelivr (Москва/Прага)',
    region: 'EU',
    // jsDelivr — статическое зеркало npm-пакетов, отдаёт 600+KB
    downloadUrl: 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js?_={n}',
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js?ping&_={n}',
    sizeBytes: 617000,
    priority: 3,
  },
  {
    id: 'cdnjs',
    name: 'cdnjs (Cloudflare)',
    region: 'Global',
    downloadUrl: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js?_={n}',
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js?ping&_={n}',
    sizeBytes: 600000,
    priority: 4,
  },
  {
    id: 'unpkg',
    name: 'unpkg (npm CDN)',
    region: 'Global',
    downloadUrl: 'https://unpkg.com/three@0.158.0/build/three.min.js?_={n}',
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'https://unpkg.com/three@0.158.0/build/three.min.js?ping&_={n}',
    sizeBytes: 184000,
    priority: 5,
  },
];

/**
 * Получить все серверы с download endpoint
 */
export function downloadServers() {
  return SERVERS.filter((s) => s.downloadUrl).sort((a, b) => a.priority - b.priority);
}

/**
 * Получить все серверы с upload endpoint
 */
export function uploadServers() {
  return SERVERS.filter((s) => s.uploadUrl).sort((a, b) => a.priority - b.priority);
}

/**
 * Получить все серверы с ping endpoint
 */
export function pingServers() {
  return SERVERS.filter((s) => s.pingUrl).sort((a, b) => a.priority - b.priority);
}

/**
 * Подставить параметры в URL-шаблон:
 *  {bytes} — желаемый размер файла (для CF, игнорируется CDN)
 *  {n}     — анти-кэш random
 *  Если {bytes} в URL нет, шаблон остаётся как есть.
 */
export function buildUrl(template, params = {}) {
  if (!template) return '';
  let url = template;
  for (const [k, v] of Object.entries(params)) {
    url = url.replaceAll(`{${k}}`, String(v));
  }
  url = url.replaceAll('{bytes}', '');
  return url;
}

/**
 * Размер одного замера (в байтах).
 */
export function bytesToHetznerSize(bytes) {
  if (bytes >= 100_000_000) return '100MB';
  if (bytes >= 10_000_000) return '10MB';
  return '1MB';
}

/**
 * Размер одного замера download для конкретного сервера
 */
export function sizeForServer(server, requestedBytes) {
  if (server && server.sizeBytes != null) return server.sizeBytes;
  return requestedBytes;
}

/**
 * Префикс origin текущей страницы (для relative URL → absolute)
 * Используется для нашего сервера «Инетометр».
 */
export function resolveOriginUrl(relativeUrl) {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
  }
  return relativeUrl;
}
