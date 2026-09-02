// ============================================================
// Inetometr — утилита анимации числовых значений
// Плавное "считание" от старого к новому значению (ease-out cubic).
// ============================================================

const DEFAULT_DURATION = 450; // мс

/**
 * Ease-out cubic: быстрый старт, плавное замедление.
 * @param {number} t 0..1
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Запустить анимацию счётчика от текущего значения к целевому.
 * @param {object} opts
 * @param {number}   opts.from       — начальное значение (parseFloat текста)
 * @param {number}   opts.to         — конечное значение
 * @param {number}  [opts.duration]  — мс (по умолчанию 450)
 * @param {function} opts.onUpdate   — callback(value) на каждом кадре
 * @param {function} opts.onDone     — callback() по завершении
 * @returns {{cancel: function}}
 */
export function animateNumber({ from, to, duration = DEFAULT_DURATION, onUpdate, onDone }) {
  // Если разница мала — просто фиксируем значение
  if (!Number.isFinite(from) || !Number.isFinite(to) || Math.abs(to - from) < 0.05) {
    onUpdate?.(to);
    onDone?.();
    return { cancel: () => {} };
  }

  const start = performance.now();
  let cancelled = false;
  let rafId = 0;

  function step(now) {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(t);
    const current = from + (to - from) * eased;
    onUpdate?.(current);
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onUpdate?.(to);
      onDone?.();
    }
  }

  rafId = requestAnimationFrame(step);

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(rafId);
    },
  };
}

/**
 * Хелпер: создать объект-аниматор с состоянием, который можно
 * дёргать на каждом сэмпле — он сам отменит предыдущую анимацию.
 *
 * @param {object} opts
 * @param {(v: number) => void} opts.set  — куда писать текущее значение
 * @param {number} [opts.duration]
 * @param {number} [opts.threshold]       — ниже какой дельты анимация пропускается
 */
export function createCounterAnimator({ set, duration = DEFAULT_DURATION, threshold = 0.05 }) {
  let current = NaN;
  let active = null;

  function update(target) {
    if (!Number.isFinite(target)) return;
    if (!Number.isFinite(current) || Math.abs(target - current) < threshold) {
      current = target;
      set(target);
      return;
    }
    if (active) active.cancel();
    active = animateNumber({
      from: current,
      to: target,
      duration,
      onUpdate: (v) => {
        current = v;
        set(v);
      },
      onDone: () => {
        active = null;
      },
    });
  }

  function reset(value = NaN) {
    if (active) active.cancel();
    active = null;
    current = value;
    if (Number.isFinite(value)) set(value);
  }

  return { update, reset, get value() { return current; } };
}
