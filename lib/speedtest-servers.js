// ============================================================
// Inetometr — конфигурация серверов для замера скорости
// Каждый сервер имеет URL-билдер для download/upload/ping
// и человекочитаемое имя. Серверы опрашиваются по приоритету.
// ============================================================

/**
 * @typedef {object} ServerConfig
 * @property {string}   id            — короткий ID ("cloudflare", "hetzner")
 * @property {string}   name          — отображаемое имя
 * @property {string}   region        — где находится ("EU", "US", "RU", "GLOBAL")
 * @property {string}   downloadUrl   — URL для скачивания (поддерживает {bytes} и {n})
 * @property {string}   uploadUrl     — URL для upload
 * @property {string}   pingUrl       — URL для ping
 * @property {number}   priority      — чем меньше, тем раньше пробуется
 */

/** @type {ServerConfig[]} */
export const SERVERS = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    region: 'GLOBAL',
    // Скачивание: редирект на ближайший CF PoP
    downloadUrl: 'https://speed.cloudflare.com/__down?bytes={bytes}&_={n}',
    // Upload: тот же домен
    uploadUrl: 'https://speed.cloudflare.com/__up',
    // Ping: GET с bytes=0
    pingUrl: 'https://speed.cloudflare.com/__down?bytes=0&_={n}',
    priority: 1,
  },
  {
    id: 'hetzner',
    name: 'Hetzner',
    region: 'EU',
    // Hetzner отдаёт статические .bin файлы 1/10/100 МБ
    downloadUrl: 'https://speed.hetzner.de/{size}.bin?_={n}',
    // Upload: на Hetzner нет публичного upload endpoint — пропускаем
    uploadUrl: null,
    // Ping: HEAD-запрос к большому файлу (дешевле чем качать)
    pingUrl: 'https://speed.hetzner.de/100MB.bin?_={n}',
    priority: 2,
  },
  {
    id: 'httpbin',
    name: 'httpbin',
    region: 'GLOBAL',
    // Только для upload fallback
    downloadUrl: null,
    uploadUrl: 'https://nghttp2.org/httpbin/post',
    pingUrl: null,
    priority: 3,
  },
  {
    id: 'postman-echo',
    name: 'Postman Echo',
    region: 'GLOBAL',
    // Дополнительный upload-fallback (надёжнее httpbin)
    downloadUrl: null,
    uploadUrl: 'https://postman-echo.com/post',
    pingUrl: null,
    priority: 4,
  },
  {
    id: 'mockbin',
    name: 'Mockbin',
    region: 'EU',
    // Ещё один upload-fallback (FR/CDN)
    downloadUrl: null,
    uploadUrl: 'https://mockbin.org/bin/{id}',
    pingUrl: null,
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
 * Подставить параметры в URL-шаблон.
 *  {bytes} — размер файла
 *  {size}  — "1MB" / "10MB" / "100MB" (для Hetzner)
 *  {n}     — анти-кэш random
 */
export function buildUrl(template, params = {}) {
  let url = template;
  for (const [k, v] of Object.entries(params)) {
    url = url.replaceAll(`{${k}}`, String(v));
  }
  return url;
}

/**
 * Конвертация байтов в Hetzner-size (1MB / 10MB / 100MB).
 */
export function bytesToHetznerSize(bytes) {
  if (bytes >= 100_000_000) return '100MB';
  if (bytes >= 10_000_000) return '10MB';
  return '1MB';
}
