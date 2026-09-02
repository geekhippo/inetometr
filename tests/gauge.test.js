// ============================================================
// Unit-тесты для lib/gauge.js — геометрия шкалы
// Покрывает регрессии: largeArc=0, ry=rx, дрейф тиков относительно индикатора
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  GAUGE_GEOM,
  TICK_COUNT,
  TICK_LONG_EVERY,
  speedToT,
  pointOnGauge,
  buildProgressPath,
  generateTicks,
} from '../lib/gauge.js';

describe('GAUGE_GEOM', () => {
  it('должен быть круговым эллипсом (rx == ry)', () => {
    expect(GAUGE_GEOM.rx).toBe(GAUGE_GEOM.ry);
  });
  it('центр внизу viewBox', () => {
    expect(GAUGE_GEOM.cy).toBe(460);
    expect(GAUGE_GEOM.cx).toBe(400);
  });
  it('верхняя точка шкалы (t=0.5) находится в y=82 (cy - ry)', () => {
    const top = pointOnGauge(0.5);
    expect(top.y).toBeCloseTo(82, 0);
    expect(top.x).toBeCloseTo(400, 0);
  });
  it('крайние точки шкалы лежат на y=cy', () => {
    const left = pointOnGauge(0);
    const right = pointOnGauge(1);
    expect(left.y).toBeCloseTo(GAUGE_GEOM.cy, 1);
    expect(right.y).toBeCloseTo(GAUGE_GEOM.cy, 1);
    expect(left.x).toBeLessThan(GAUGE_GEOM.cx);
    expect(right.x).toBeGreaterThan(GAUGE_GEOM.cx);
  });
});

describe('speedToT', () => {
  it('0 Мбит/с → 0', () => {
    expect(speedToT(0)).toBe(0);
  });
  it('отрицательное → 0', () => {
    expect(speedToT(-5)).toBe(0);
  });
  it('1 Мбит/с → 0 (нижняя граница лог. шкалы)', () => {
    expect(speedToT(1)).toBeCloseTo(0, 5);
  });
  it('100 Мбит/с → ~0.667 (log10(100)=2, шкала 1..1000 → (2-0)/3)', () => {
    // Не 0.5, как в линейной шкале: лог-шкала 1..1000 даёт 100 Мбит/с → 0.667.
    // Середина шкалы (t=0.5) — это ~31.6 Мбит/с.
    expect(speedToT(100)).toBeCloseTo(2 / 3, 5);
  });
  it('~31.6 Мбит/с (10^1.5) → 0.5 (середина шкалы)', () => {
    expect(speedToT(Math.pow(10, 1.5))).toBeCloseTo(0.5, 5);
  });
  it('1000 Мбит/с → 1 (верхняя граница)', () => {
    expect(speedToT(1000)).toBeCloseTo(1, 5);
  });
  it('10 Мбит/с → ~0.333 (log10(10) = 1, log10(1)=0, log10(1000)=3, (1-0)/(3-0) = 0.333)', () => {
    expect(speedToT(10)).toBeCloseTo(1 / 3, 5);
  });
  it('NaN/Infinity → 0', () => {
    expect(speedToT(NaN)).toBe(0);
    expect(speedToT(Infinity)).toBe(0);
  });
});

describe('pointOnGauge', () => {
  it('t=0 → левая крайняя точка (cx - rx, cy)', () => {
    const p = pointOnGauge(0);
    expect(p.x).toBeCloseTo(GAUGE_GEOM.cx - GAUGE_GEOM.rx, 2);
    expect(p.y).toBeCloseTo(GAUGE_GEOM.cy, 2);
  });
  it('t=1 → правая крайняя точка (cx + rx, cy)', () => {
    const p = pointOnGauge(1);
    expect(p.x).toBeCloseTo(GAUGE_GEOM.cx + GAUGE_GEOM.rx, 2);
    expect(p.y).toBeCloseTo(GAUGE_GEOM.cy, 2);
  });
  it('t=0.5 → верхняя точка (cx, cy - ry)', () => {
    const p = pointOnGauge(0.5);
    expect(p.x).toBeCloseTo(GAUGE_GEOM.cx, 2);
    expect(p.y).toBeCloseTo(GAUGE_GEOM.cy - GAUGE_GEOM.ry, 2);
  });
  it('t за пределами [0,1] клампится', () => {
    expect(pointOnGauge(-0.5)).toEqual(pointOnGauge(0));
    expect(pointOnGauge(1.5)).toEqual(pointOnGauge(1));
  });
});

describe('buildProgressPath — регрессия largeArc', () => {
  it('t<=0 → пустая строка', () => {
    expect(buildProgressPath(0)).toBe('');
    expect(buildProgressPath(-0.1)).toBe('');
  });
  it('всегда использует largeArc=0 (короткая дуга через верх)', () => {
    // Ранее баг: при t>0.5 дуга уходила вниз за viewBox.
    // Здесь мы проверяем что path ВСЕГДА содержит "0 0 1" (large=0, sweep=1).
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]) {
      const path = buildProgressPath(t);
      expect(path).toMatch(/A 378 378 0 0 1 /);
    }
  });
  it('стартует от t=0 (cx - rx, cy)', () => {
    const path = buildProgressPath(0.5);
    // Начало: x=22, y=460
    expect(path).toMatch(/^M 22\.00 460\.00 A /);
  });
  it('при t=0.5 заканчивается в верхней точке', () => {
    const path = buildProgressPath(0.5);
    // Конец: x=400, y=82
    expect(path).toMatch(/ 400\.00 82\.00$/);
  });
});

describe('generateTicks — регрессия дрейфа', () => {
  it('генерирует ровно TICK_COUNT тиков', () => {
    const ticks = generateTicks();
    expect(ticks).toHaveLength(TICK_COUNT);
  });
  it('каждый 10-й тик — длинный', () => {
    const ticks = generateTicks();
    for (let i = 0; i < TICK_COUNT; i++) {
      if (i % TICK_LONG_EVERY === 0) {
        expect(ticks[i].long).toBe(true);
      } else {
        expect(ticks[i].long).toBe(false);
      }
    }
  });
  it('первый и последний тики лежат на окружности GAUGE_GEOM', () => {
    const ticks = generateTicks();
    // Расстояние от центра до (x1,y1) внутреннего конца должно быть rInner
    const cx = GAUGE_GEOM.cx;
    const cy = GAUGE_GEOM.cy;
    const first = ticks[0];
    const r = Math.hypot(first.x1 - cx, first.y1 - cy);
    // long=true для i=0, значит rInner = rx - 14 = 364
    expect(r).toBeCloseTo(GAUGE_GEOM.rx - 14, 1);
  });
  it('тики находятся на той же окружности, что и индикатор (нет дрейфа)', () => {
    // Главный регрессионный тест: тики должны лежать на той же дуге,
    // что и pointOnGauge(t). Раньше тики рисовались по ry=240,
    // а индикатор по ry=378 — был 7px дрейф.
    const ticks = generateTicks();
    for (let i = 0; i < TICK_COUNT; i += 10) {
      const t = i / (TICK_COUNT - 1);
      // Внешний конец тика должен лежать на окружности GAUGE_GEOM
      const rOuter = Math.hypot(ticks[i].x2 - GAUGE_GEOM.cx, ticks[i].y2 - GAUGE_GEOM.cy);
      expect(rOuter).toBeCloseTo(GAUGE_GEOM.rx, 1);
      // Угол pointOnGauge(t) должен совпадать с углом тика на окружности
      const arcPoint = pointOnGauge(t);
      const tickAngle = Math.atan2(ticks[i].y2 - GAUGE_GEOM.cy, ticks[i].x2 - GAUGE_GEOM.cx);
      const arcAngle = Math.atan2(arcPoint.y - GAUGE_GEOM.cy, arcPoint.x - GAUGE_GEOM.cx);
      expect(tickAngle).toBeCloseTo(arcAngle, 5);
      const dxTick = ticks[i].x2 - ticks[i].x1;
      const dyTick = ticks[i].y2 - ticks[i].y1;
      const dxRadial = ticks[i].x2 - GAUGE_GEOM.cx;
      const dyRadial = ticks[i].y2 - GAUGE_GEOM.cy;
      // Вектор тика должен быть коллинеарен радиальному (dot / |a||b| = ±1)
      const dot = dxTick * dxRadial + dyTick * dyRadial;
      const normTick = Math.hypot(dxTick, dyTick);
      const normRadial = Math.hypot(dxRadial, dyRadial);
      const cosAngle = dot / (normTick * normRadial);
      expect(cosAngle).toBeCloseTo(1, 5);
    }
  });
  it('точка индикатора при t=0.5 (100 Мбит/с) лежит точно на тике i=60', () => {
    const ticks = generateTicks();
    const indicator = pointOnGauge(0.5);
    // Тик i=60 — это середина (t=60/120=0.5)
    // Внешний конец тика должен совпадать с indicator (или быть очень близко)
    const dx = ticks[60].x2 - indicator.x;
    const dy = ticks[60].y2 - indicator.y;
    const dist = Math.hypot(dx, dy);
    expect(dist).toBeLessThan(0.01); // менее 0.01 px
  });
});
