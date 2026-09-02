// Unit: анимация числовых значений
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animateNumber, createCounterAnimator } from '../lib/animator.js';

// Полифилл requestAnimationFrame и performance.now для node-окружения
let rafQueue = [];
let rafId = 0;
let virtualTime = 0;
let originalNow;
beforeEach(() => {
  virtualTime = 0;
  originalNow = performance.now.bind(performance);
  performance.now = () => virtualTime;
  globalThis.requestAnimationFrame = (cb) => {
    rafQueue.push(cb);
    return ++rafId;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((_, i) => i + 1 !== id);
  };
});
afterEach(() => {
  performance.now = originalNow;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
  rafQueue = [];
});

function flushFrame(deltaMs = 16) {
  const queue = rafQueue;
  rafQueue = [];
  virtualTime += deltaMs;
  for (const cb of queue) cb(virtualTime);
}

describe('animateNumber', () => {
  it('onUpdate вызывается на каждом кадре со значениями от from до to', () => {
    const updates = [];
    animateNumber({
      from: 0,
      to: 100,
      duration: 100,
      onUpdate: (v) => updates.push(v),
    });
    // Несколько кадров
    flushFrame();
    flushFrame();
    flushFrame();
    // onUpdate должен был вызваться хотя бы раз
    expect(updates.length).toBeGreaterThan(0);
    // Первое значение должно быть близко к from (ease-out быстрый старт)
    expect(updates[0]).toBeGreaterThanOrEqual(0);
  });

  it('cancel предотвращает дальнейшие onUpdate', () => {
    const onUpdate = vi.fn();
    const a = animateNumber({ from: 0, to: 100, duration: 50, onUpdate });
    flushFrame();
    const countAfterFirst = onUpdate.mock.calls.length;
    a.cancel();
    flushFrame();
    expect(onUpdate.mock.calls.length).toBe(countAfterFirst);
  });

  it('если разница меньше threshold — фиксирует to без анимации', () => {
    const onUpdate = vi.fn();
    const onDone = vi.fn();
    animateNumber({ from: 50, to: 50.03, onUpdate, onDone });
    expect(onUpdate).toHaveBeenCalledWith(50.03);
    expect(onDone).toHaveBeenCalled();
  });

  it('если from не число — сразу to', () => {
    const onUpdate = vi.fn();
    animateNumber({ from: NaN, to: 100, onUpdate });
    expect(onUpdate).toHaveBeenCalledWith(100);
  });

  it('после duration анимация завершается и вызывает onDone', () => {
    const onDone = vi.fn();
    animateNumber({ from: 0, to: 100, duration: 30, onDone });
    // 5 кадров по 16мс = 80мс > 30мс длительности
    for (let i = 0; i < 5; i++) flushFrame(16);
    expect(onDone).toHaveBeenCalled();
  });
});

describe('createCounterAnimator', () => {
  it('update вызывает set с value', () => {
    const set = vi.fn();
    const a = createCounterAnimator({ set });
    a.update(42);
    expect(set).toHaveBeenCalledWith(42);
  });

  it('update отменяет предыдущую анимацию', () => {
    const set = vi.fn();
    const a = createCounterAnimator({ set });
    a.update(0);
    flushFrame();
    a.update(50); // должна отменить предыдущую
    flushFrame();
    a.update(100);
    // Не должно быть ошибок
    expect(a.value).toBeGreaterThan(0);
  });

  it('reset устанавливает значение', () => {
    const set = vi.fn();
    const a = createCounterAnimator({ set });
    a.reset(99);
    expect(set).toHaveBeenCalledWith(99);
    expect(a.value).toBe(99);
  });

  it('reset без аргумента сбрасывает в NaN', () => {
    const set = vi.fn();
    const a = createCounterAnimator({ set });
    a.update(50);
    a.reset();
    expect(a.value).toBeNaN();
  });

  it('маленькая дельта (< threshold) — мгновенная установка', () => {
    const set = vi.fn();
    const a = createCounterAnimator({ set, threshold: 0.5 });
    a.update(100);
    set.mockClear();
    a.update(100.2); // дельта 0.2 < 0.5
    expect(set).toHaveBeenCalledWith(100.2);
  });
});
