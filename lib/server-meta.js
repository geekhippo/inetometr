// ============================================================
// Inetometr — парсинг метаданных CDN-сервера из response headers
// + авто-определение фактического местоположения по IP.
// ============================================================

// Cloudflare speed.cloudflare.com выставляет cf-meta-* заголовки.
// Список публичных заголовков:
// cf-meta-ip, cf-meta-colo, cf-meta-asn, cf-meta-country, cf-meta-city,
// cf-meta-postalCode, cf-meta-latitude, cf-meta-longitude, cf-meta-timezone

const CF_META_KEYS = [
  ['colo', 'cf-meta-colo'],
  ['country', 'cf-meta-country'],
  ['city', 'cf-meta-city'],
  ['ip', 'cf-meta-ip'],
  ['asn', 'cf-meta-asn'],
  ['postalCode', 'cf-meta-postalCode'],
  ['latitude', 'cf-meta-latitude'],
  ['longitude', 'cf-meta-longitude'],
  ['timezone', 'cf-meta-timezone'],
  ['colo', 'colo'], // дубликат на случай прямого CF-RAY-стиля
];

/**
 * Извлекает метаданные CDN из Headers / Map<string,string>.
 * Устойчив к регистру заголовков.
 */
export function parseServerMeta(headers) {
  const get = (name) => {
    if (!headers) return null;
    const lower = name.toLowerCase();
    if (typeof headers.get === 'function') return headers.get(name) || headers.get(lower);
    if (headers instanceof Map) return headers.get(name) || headers.get(lower);
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === lower) return headers[k];
    }
    return null;
  };
  const out = {};
  for (const [field, headerName] of CF_META_KEYS) {
    if (out[field] !== undefined) continue;
    const v = get(headerName);
    if (v && v.trim()) out[field] = v.trim();
  }
  return out;
}

/**
 * Парсит ответ /cdn-cgi/trace в объект.
 * Формат: key=value построчно.
 */
export function parseTrace(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Скачивает probe-чанк и возвращает метаданные CF + colo.
 */
export async function fetchServerMeta(url = 'https://speed.cloudflare.com/__down?bytes=1024') {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    try { await r.arrayBuffer(); } catch { /* ignore */ }
    const meta = parseServerMeta(r.headers);
    if (!meta.colo) {
      try {
        const trace = await fetch('https://speed.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
        const text = await trace.text();
        const fields = parseTrace(text);
        if (fields.colo) meta.colo = fields.colo;
        if (fields.ip && !meta.ip) meta.ip = fields.ip;
        if (fields.loc) meta.country = fields.loc.toUpperCase();
      } catch { /* ignore */ }
    }
    return meta;
  } catch {
    return {};
  }
}

// ============================================================
// IP-геолокация (ip-api.com — бесплатный, 45 req/min, без ключа)
// Кэшируем результат на 1 час в localStorage, чтобы не упираться
// в лимит при каждом замере.
// ============================================================
const GEO_CACHE_KEY = 'inetometr:geoip:v1';
const GEO_TTL_MS = 60 * 60 * 1000; // 1 час
const GEO_ENDPOINT = 'http://ip-api.com/json';

/**
 * Получить geo-метаданные для указанного IP.
 * Использует ip-api.com (бесплатный, CORS-friendly).
 * @param {string} ip — IPv4 адрес
 * @returns {Promise<{country,countryCode,region,regionName,city,org,as,timezone,lat,lon}|null>}
 */
export async function lookupGeoIP(ip) {
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;

  // Проверяем кэш
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.ip === ip && Date.now() - cached.t < GEO_TTL_MS) {
        return cached.data;
      }
    }
  } catch { /* ignore */ }

  try {
    const r = await fetch(`${GEO_ENDPOINT}/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,org,as,timezone,lat,lon&lang=ru`, {
      cache: 'no-store',
      // ip-api.com поддерживает CORS для всех origin
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.status !== 'success') return null;

    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ip, data, t: Date.now() }));
    } catch { /* quota — игнорируем */ }
    return data;
  } catch {
    return null;
  }
}

/**
 * Получить IP самого пользователя через CF trace (если доступен),
 * иначе fallback на ipify / api.ipify.org.
 * @returns {Promise<string|null>}
 */
export async function fetchOwnIP() {
  const candidates = [
    'https://speed.cloudflare.com/cdn-cgi/trace',
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/ip',
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const text = await r.text();
      // CF trace: ip=...
      const m = text.match(/ip=([\d.]+)/);
      if (m) return m[1];
      // ipify JSON
      try {
        const j = JSON.parse(text);
        if (j.ip) return j.ip;
      } catch { /* not JSON */ }
      // ifconfig returns plain text IP
      if (/^\d+\.\d+\.\d+\.\d+$/.test(text.trim())) return text.trim();
    } catch { continue; }
  }
  return null;
}

/**
 * Краткое описание местоположения для UI.
 * Приоритет: city + countryCode → "Москва, RU"
 * @param {{city?: string, countryCode?: string, country?: string}} geo
 * @returns {string}
 */
export function describeGeo(geo) {
  if (!geo) return '';
  const parts = [];
  if (geo.city) parts.push(geo.city);
  if (geo.countryCode) parts.push(geo.countryCode);
  else if (geo.country) parts.push(geo.country);
  return parts.join(', ');
}

/**
 * Краткое описание CDN-сервера для UI (через cf-meta-* заголовки).
 */
export function describeServer(meta) {
  if (!meta || (!meta.colo && !meta.city && !meta.country)) return '';
  const parts = [];
  if (meta.city) parts.push(meta.city);
  if (meta.country) parts.push(meta.country);
  if (meta.colo) {
    if (parts.length > 0) {
      parts.push(`CDN ${meta.colo}`);
    } else {
      parts.push(`Cloudflare ${meta.colo}`);
    }
  }
  return parts.join(' · ');
}
