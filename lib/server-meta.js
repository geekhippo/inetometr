// ============================================================
// Inetometr — парсинг метаданных CDN-сервера из response headers
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
 * @param {Headers|Record<string,string>|Map<string,string>} headers
 * @returns {{colo?: string, country?: string, city?: string, ip?: string, asn?: string, postalCode?: string, latitude?: string, longitude?: string, timezone?: string}}
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
    if (out[field] !== undefined) continue; // первый приоритет
    const v = get(headerName);
    if (v && v.trim()) out[field] = v.trim();
  }
  return out;
}

/**
 * Скачивает маленький probe-чанк (1 КБ) и возвращает метаданные.
 * @param {string} [url]
 * @returns {Promise<{colo?: string, country?: string, city?: string, ip?: string, asn?: string}>}
 */
export async function fetchServerMeta(url = 'https://speed.cloudflare.com/__down?bytes=1024') {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    // Закрываем тело — нам нужны только заголовки
    try {
      await r.arrayBuffer();
    } catch {
      /* ignore */
    }
    return parseServerMeta(r.headers);
  } catch {
    return {};
  }
}

/**
 * Краткое описание CDN-сервера для UI.
 * Пример: "Москва, RU (MOW)" или "Riga, LV (ARN)".
 * @param {{colo?: string, country?: string, city?: string}} meta
 * @returns {string}
 */
export function describeServer(meta) {
  if (!meta || (!meta.colo && !meta.city && !meta.country)) return '';
  const parts = [];
  if (meta.city) parts.push(meta.city);
  if (meta.country) parts.push(meta.country);
  if (meta.colo) parts.push(meta.colo);
  return parts.join(' · ');
}
