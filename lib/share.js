// ============================================================
// Inetometr — утилита копирования результата замера в буфер обмена
// ============================================================

/**
 * Форматирует результат замера в текст для копирования/шаринга.
 * @param {{download: number, upload: number, ping: number, jitter?: number}} results
 * @param {{colo?: string, country?: string, city?: string, ip?: string, asn?: string}} [meta]
 * @returns {string}
 */
export function formatResults(results, meta = {}) {
  const lines = [];
  lines.push('📡 ИНЕТОМЕТР — результат замера');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`↓ Входящая:   ${fmtMbps(results.download)} Мбит/с`);
  lines.push(`↑ Исходящая:  ${fmtMbps(results.upload)} Мбит/с`);
  lines.push(`⏱  Задержка:  ${fmtMs(results.ping)} мс`);
  if (Number.isFinite(results.jitter) && results.jitter > 0) {
    lines.push(`📊 Джиттер:   ${fmtMs(results.jitter)} мс`);
  }
  if (meta.colo || meta.city || meta.country) {
    const parts = [];
    if (meta.city) parts.push(meta.city);
    if (meta.country) parts.push(meta.country);
    if (meta.colo) parts.push(meta.colo);
    lines.push(`🌍 Сервер:    ${parts.join(' · ')}`);
  }
  if (meta.ip) lines.push(`🔑 IP:        ${meta.ip}`);
  if (meta.asn) lines.push(`🏢 ASN:       ${meta.asn}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🔗 inetometr.ru');
  return lines.join('\n');
}

function fmtMbps(v) {
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

function fmtMs(v) {
  if (!Number.isFinite(v) || v < 0) return '—';
  return v < 10 ? v.toFixed(1) : v.toFixed(0);
}

/**
 * Копирует текст в буфер обмена. Современный API -> fallback на execCommand.
 * @param {string} text
 * @returns {Promise<boolean>} true если скопировано
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  // Старый fallback — textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
