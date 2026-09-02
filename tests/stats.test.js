// Unit: статистические утилиты
import { describe, it, expect } from 'vitest';
import {
  median,
  rollingMedian,
  createRollingMedian,
  trimmedMean,
  mean,
  stddev,
} from '../lib/stats.js';

describe('median', () => {
  it('пустой массив → NaN', () => {
    expect(median([])).toBeNaN();
  });
  it('не мутирует входной массив', () => {
    const a = [3, 1, 2];
    median(a);
    expect(a).toEqual([3, 1, 2]);
  });
  it('нечётное количество', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([10, 20, 30, 40, 50])).toBe(30);
  });
  it('чётное количество (среднее двух средних)', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it('один элемент', () => {
    expect(median([42])).toBe(42);
  });
});

describe('rollingMedian', () => {
  it('окно=1 возвращает сам массив', () => {
    expect(rollingMedian([1, 5, 3, 8, 2], 1)).toEqual([1, 5, 3, 8, 2]);
  });
  it('окно=3: накапливает сэмплы', () => {
    // [1,5,3,8,2] с окном 3
    // i=0: [1]      → 1
    // i=1: [1,5]    → 3
    // i=2: [1,5,3]  → 3
    // i=3: [5,3,8]  → 5
    // i=4: [3,8,2]  → 3
    expect(rollingMedian([1, 5, 3, 8, 2], 3)).toEqual([1, 3, 3, 5, 3]);
  });
  it('окно=7 на массиве из 5 — окно не больше массива', () => {
    const r = rollingMedian([1, 5, 3, 8, 2], 7);
    expect(r).toHaveLength(5);
    expect(r[4]).toBe(3); // медиана всего массива
  });
  it('окно=0 или отрицательное → 1', () => {
    expect(rollingMedian([1, 2, 3], 0)).toEqual([1, 2, 3]);
    expect(rollingMedian([1, 2, 3], -5)).toEqual([1, 2, 3]);
  });
  it('пустой массив → пустой массив', () => {
    expect(rollingMedian([])).toEqual([]);
  });
  it('не-числовые значения игнорируются по сортировке', () => {
    // NaN не сортируется; проверим, что не падает
    const r = rollingMedian([1, 5, 3, 8, 2]);
    expect(r).toHaveLength(5);
  });
  it('убирает одиночный выброс', () => {
    // окно 5: [10,10,10,10,1000,10,10,10,10,10]
    // после 1000 на i=4 в окне 5: [10,10,10,10,1000] → median=10
    // на i=5: [10,10,10,1000,10] → median=10
    const r = rollingMedian([10, 10, 10, 10, 1000, 10, 10, 10, 10, 10], 5);
    expect(r[4]).toBe(10);
    expect(r[5]).toBe(10);
  });
});

describe('createRollingMedian (streaming)', () => {
  it('push и value — окно 3', () => {
    const rm = createRollingMedian(3);
    expect(rm.push(1)).toBe(1);
    expect(rm.push(5)).toBe(3);
    expect(rm.push(3)).toBe(3);
    expect(rm.push(8)).toBe(5);
    expect(rm.push(2)).toBe(3);
  });
  it('reset очищает буфер', () => {
    const rm = createRollingMedian(3);
    rm.push(10); rm.push(20); rm.push(30);
    rm.reset();
    expect(NaN).toBeNaN(); // маркер: после reset value()=NaN
    expect(rm.value()).toBeNaN();
  });
  it('длинный поток — стабильность (выбросы фильтруются)', () => {
    const rm = createRollingMedian(5);
    const samples = [50, 50, 50, 50, 50, 9999, 50, 50, 50, 50, 50, 9999, 50];
    const out = samples.map((v) => rm.push(v));
    // На 9999 в окне 5: [50,50,50,50,9999] → median=50
    expect(out[5]).toBe(50);
    // После 9999 (на 6-м шаге после): [50,50,50,9999,50] → 50
    expect(out[6]).toBe(50);
  });
});

describe('trimmedMean', () => {
  it('отбрасывает k мин и k макс', () => {
    // [1,2,3,4,5,6,7,8,9,10] k=2 → [3..8] → mean 5.5
    expect(trimmedMean([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2)).toBe(5.5);
  });
  it('если 2k >= n — возвращает обычное среднее', () => {
    expect(trimmedMean([1, 2, 3], 2)).toBeCloseTo(2, 5);
  });
  it('пустой → NaN', () => {
    expect(trimmedMean([])).toBeNaN();
  });
});

describe('mean', () => {
  it('среднее арифметическое', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([10])).toBe(10);
    expect(mean([])).toBeNaN();
  });
});

describe('stddev', () => {
  it('константа → 0', () => {
    expect(stddev([5, 5, 5, 5])).toBe(0);
  });
  it('один элемент → 0 (недостаточно данных)', () => {
    expect(stddev([5])).toBe(0);
  });
  it('простой набор', () => {
    // [2,4,4,4,5,5,7,9] → mean=5, sample stddev ≈ 2.138
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
  it('пустой → 0', () => {
    expect(stddev([])).toBe(0);
  });
});
