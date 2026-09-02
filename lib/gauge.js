// ============================================================
// Inetometr — gauge geometry (pure functions, no DOM)
// All exports are deterministic; safe to unit-test.
// ============================================================

// Единая геометрия эллипса шкалы.
// Центр внизу viewBox (cx=400, cy=460), круговой эллипс (rx=ry=378).
// Верхняя точка шкалы: (400, 82). Левая/правая: (22, 460) и (778, 460).
export const GAUGE_GEOM = { cx: 400, cy: 460, rx: 378, ry: 378, maxMbps: 1000 };

// Тиков: 121, длинный каждый 10-й. Соответствует визуалу Яндекс.Интернетометра.
export const TICK_COUNT = 121;
export const TICK_LONG_EVERY = 10;

/**
 * Логарифмическое преобразование Мбит/с → t∈[0,1].
 * 1 Мбит/с → 0, 1000 Мбит/с → 1, 100 Мбит/с → 0.5.
 * 0 или отрицательное → 0.
 */
export function speedToT(mbps) {
  if (!Number.isFinite(mbps) || mbps <= 0) return 0;
  const minVal = 1;
  const maxVal = GAUGE_GEOM.maxMbps;
  const t = (Math.log10(mbps) - Math.log10(minVal)) / (Math.log10(maxVal) - Math.log10(minVal));
  return Math.max(0, Math.min(1, t));
}

/**
 * t∈[0,1] → точка на дуге.
 * t=0 — левая крайняя (180°), t=1 — правая (360°/0°), t=0.5 — верх (270°).
 */
export function pointOnGauge(t, geom = GAUGE_GEOM) {
  const clamped = Math.max(0, Math.min(1, t));
  const angleDeg = 180 + clamped * 180;
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: geom.cx + Math.cos(angle) * geom.rx,
    y: geom.cy + Math.sin(angle) * geom.ry,
  };
}

/**
 * SVG path от t=0 до t. Всегда sweep=1, largeArc=0 (короткая дуга через верх).
 * Если t<=0 — пустая строка.
 */
export function buildProgressPath(t, geom = GAUGE_GEOM) {
  if (!(t > 0)) return '';
  const start = pointOnGauge(0, geom);
  const end = pointOnGauge(t, geom);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${geom.rx} ${geom.ry} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Сгенерировать все 121 тик шкалы.
 * Возвращает массив {x1, y1, x2, y2, long}, где long=true для длинных.
 * ВАЖНО: использует ту же геометрию, что и pointOnGauge — иначе дрейф.
 */
export function generateTicks(geom = GAUGE_GEOM, count = TICK_COUNT, longEvery = TICK_LONG_EVERY) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angleDeg = 180 + t * 180;
    const angle = (angleDeg * Math.PI) / 180;
    const isLong = i % longEvery === 0;
    const rOuter = geom.rx;
    const rInner = geom.rx - (isLong ? 14 : 8);
    const x1 = geom.cx + Math.cos(angle) * rInner;
    const y1 = geom.cy + Math.sin(angle) * rInner;
    const x2 = geom.cx + Math.cos(angle) * rOuter;
    const y2 = geom.cy + Math.sin(angle) * rOuter;
    ticks.push({ x1, y1, x2, y2, long: isLong });
  }
  return ticks;
}
