// @vitest-environment happy-dom
// ============================================================
// Inetometer — конвертация SVG в PNG (для og:image)
// Используется для генерации PNG-превью в браузере, без зависимостей.
// ============================================================

/**
 * Загрузить SVG-строку как <img> через data URL.
 * @param {string} svgString
 * @returns {Promise<HTMLImageElement>}
 */
function loadSvgImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG'));
    };
    img.src = url;
  });
}

/**
 * Сконвертировать SVG-строку в PNG Blob.
 *
 * @param {string} svgString
 * @param {number} [width=1200]
 * @param {number} [height=630]
 * @returns {Promise<Blob>}
 */
export async function svgToPng(svgString, width = 1200, height = 630) {
  const img = await loadSvgImage(svgString);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

/**
 * Загрузить SVG по URL и сконвертировать в PNG.
 * @param {string} url
 */
export async function svgUrlToPng(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const svg = await resp.text();
  return svgToPng(svg);
}
