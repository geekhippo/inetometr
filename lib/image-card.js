// ============================================================
// Inetometer — генерация PNG-картинки с результатом замера
// Canvas API: рендерит карточку 1200×630 (стандарт Open Graph).
// Можно скачать или использовать как <canvas> для Web Share API.
// ============================================================

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND = '#fc3f1d';
const BRAND_LIGHT = '#ff7a3d';
const TEXT = '#1a1a1a';
const TEXT_DIM = '#666666';
const BG = '#ffffff';
const BG_SOFT = '#f6f6f6';

/**
 * Сгенерировать Data URL с PNG-картинкой результата замера.
 *
 * @param {object}        results       {download, upload, ping, jitter}
 * @param {object}        serverMeta    {city, country, colo, ip}  (опц.)
 * @param {number[]}     [chartData]    массив сэмплов скорости для графика
 * @returns {Promise<{dataUrl: string, blob: Blob}>}
 */
export async function renderResultImage(results, serverMeta = {}, chartData = []) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // Фон
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Лёгкая текстура: горизонтальная линия-акцент сверху
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, WIDTH, 8);

  // Шапка: лого + бренд
  ctx.fillStyle = TEXT;
  ctx.font = '700 36px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('Инетометр', 60, 56);

  // Оранжевый кружок рядом с логотипом
  ctx.beginPath();
  ctx.arc(290, 78, 14, 0, Math.PI * 2);
  ctx.fillStyle = BRAND;
  ctx.fill();

  // Дата + сервер
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '500 18px Inter, -apple-system, sans-serif';
  ctx.fillText(dateStr, 60, 102);

  if (serverMeta && (serverMeta.colo || serverMeta.city)) {
    const parts = [];
    if (serverMeta.colo) parts.push(serverMeta.colo);
    if (serverMeta.city) parts.push(serverMeta.city);
    if (serverMeta.country) parts.push(serverMeta.country);
    const serverText = `Замер с сервера: ${parts.join(', ')}`;
    ctx.fillText(serverText, 60, 128);
  }

  // 3 метрики в ряд
  const metrics = [
    { label: 'Входящая', value: results.download?.toFixed(2) ?? '—', unit: 'Мбит/с', arrow: '↓' },
    { label: 'Исходящая', value: results.upload?.toFixed(2) ?? '—', unit: 'Мбит/с', arrow: '↑' },
    { label: 'Задержка', value: results.ping?.toFixed(0) ?? '—', unit: 'мс', arrow: null },
  ];

  const cardY = 200;
  const cardH = 220;
  const cardGap = 24;
  const cardW = (WIDTH - 120 - cardGap * 2) / 3;

  metrics.forEach((m, i) => {
    const x = 60 + i * (cardW + cardGap);
    // Подложка карточки
    ctx.fillStyle = BG_SOFT;
    roundRect(ctx, x, cardY, cardW, cardH, 16);
    ctx.fill();

    // Лейбл
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '500 18px Inter, -apple-system, sans-serif';
    ctx.fillText(m.label, x + 24, cardY + 24);

    // Стрелка (если есть)
    if (m.arrow) {
      ctx.beginPath();
      ctx.arc(x + cardW - 28, cardY + 36, 12, 0, Math.PI * 2);
      ctx.fillStyle = TEXT;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.arrow, x + cardW - 28, cardY + 36);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'top';
    }

    // Значение
    ctx.fillStyle = TEXT;
    ctx.font = '700 80px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(m.value, x + 24, cardY + 80);

    // Единицы
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillText(m.unit, x + 24, cardY + 168);
  });

  // Мини-график скорости (если есть данные)
  if (chartData && chartData.length >= 2) {
    const graphX = 60;
    const graphY = 460;
    const graphW = WIDTH - 120;
    const graphH = 110;
    // Подложка
    ctx.fillStyle = BG_SOFT;
    roundRect(ctx, graphX, graphY, graphW, graphH, 12);
    ctx.fill();

    // Сетка
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = graphY + (i / 4) * graphH;
      ctx.beginPath();
      ctx.moveTo(graphX, y);
      ctx.lineTo(graphX + graphW, y);
      ctx.stroke();
    }

    // Линия
    const max = Math.max(...chartData, 1);
    const stepX = graphW / (chartData.length - 1);
    const grad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
    grad.addColorStop(0, BRAND_LIGHT);
    grad.addColorStop(1, BRAND);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    chartData.forEach((v, i) => {
      const x = graphX + i * stepX;
      const y = graphY + graphH - (v / max) * (graphH - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Футер
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '500 16px Inter, -apple-system, sans-serif';
  ctx.fillText('inetometr.ru — открытый спидометр', 60, HEIGHT - 50);

  // Конвертируем в PNG blob
  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  const dataUrl = canvas.toDataURL('image/png');
  return { dataUrl, blob, width: WIDTH, height: HEIGHT };
}

/**
 * Скачать PNG-картинку через a.download.
 */
export function downloadResultImage(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `inetometr-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Хелпер: прямоугольник со скруглёнными углами
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
