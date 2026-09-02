// ============================================================
// Inetometr — статистические утилиты (pure functions, no DOM)
// Используются для сглаживания сэмплов скорости.
// ============================================================

/**
 * Медиана массива чисел. Возвращает NaN для пустого массива.
 * Не мутирует входной массив.
 */
export function median(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return NaN;
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Скользящая медиана по последним `window` значениям.
 * Возвращает массив той же длины, что и samples; первые элементы
 * до накопления `window` сэмплов считаются по тому, что есть.
 *
 * @param {number[]} samples  — входной ряд (например, мгновенные Мбит/с)
 * @param {number}   window   — размер окна (по умолчанию 7)
 * @returns {number[]}        — сглаженный ряд
 */
export function rollingMedian(samples, window = 7) {
  if (!Array.isArray(samples)) return [];
  const w = Math.max(1, Math.floor(window));
  const out = [];
  for (let i = 0; i < samples.length; i++) {
    const start = Math.max(0, i - w + 1);
    out.push(median(samples.slice(start, i + 1)));
  }
  return out;
}

/**
 * Эффективный rolling median для больших потоков (O(n) амортизированно).
 * Не копирует массив на каждом шаге. Полезно для непрерывного UI-обновления,
 * где добавляется по одному сэмплу за раз.
 *
 * @returns {{push: (v: number) => number, value: () => number, reset: () => void}}
 */
export function createRollingMedian(window = 7) {
  const w = Math.max(1, Math.floor(window));
  const buf = [];
  const sorted = [];
  const idx = new Map(); // value -> count в окне

  function push(v) {
    buf.push(v);
    // вставить в sorted
    let i = sorted.findIndex((x) => x > v);
    if (i === -1) i = sorted.length;
    sorted.splice(i, 0, v);
    idx.set(v, (idx.get(v) || 0) + 1);

    if (buf.length > w) {
      const old = buf.shift();
      const c = idx.get(old) - 1;
      if (c <= 0) idx.delete(old);
      else idx.set(old, c);
      // удалить из sorted (первое вхождение)
      const j = sorted.indexOf(old);
      if (j !== -1) sorted.splice(j, 1);
    }
    return value();
  }

  function value() {
    if (sorted.length === 0) return NaN;
    const n = sorted.length;
    if (n % 2 === 1) return sorted[(n - 1) / 2];
    // для чётного — среднее двух средних; если есть дубликаты с разных сторон —
    // берём по одному сэмплу (sorted[lower] и sorted[upper]) и усредняем.
    return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  function reset() {
    buf.length = 0;
    sorted.length = 0;
    idx.clear();
  }

  return { push, value, reset };
}

/**
 * Trimmed mean: среднее после отбрасывания `k` самых малых и `k` самых больших.
 * Устойчиво к выбросам.
 */
export function trimmedMean(samples, k = 1) {
  if (!Array.isArray(samples) || samples.length === 0) return NaN;
  if (samples.length <= 2 * k) return mean(samples);
  const sorted = samples.slice().sort((a, b) => a - b);
  const trimmed = sorted.slice(k, sorted.length - k);
  return mean(trimmed);
}

/**
 * Простое среднее.
 */
export function mean(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return NaN;
  let s = 0;
  for (const v of samples) s += v;
  return s / samples.length;
}

/**
 * Стандартное отклонение (sample, n-1).
 */
export function stddev(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const m = mean(samples);
  let s = 0;
  for (const v of samples) s += (v - m) ** 2;
  return Math.sqrt(s / (samples.length - 1));
}
