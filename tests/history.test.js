// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadHistory,
  saveHistory,
  addToHistory,
  clearHistory,
  groupByDay,
  delta,
  averagesLastDays,
  recentHistory,
} from '../lib/history.js';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('loadHistory / saveHistory', () => {
  it('пустая история возвращает []', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('saveHistory → loadHistory round-trip', () => {
    const data = [{ t: 1, download: 10, upload: 5, ping: 20 }];
    saveHistory(data);
    expect(loadHistory()).toEqual(data);
  });

  it('saveHistory обрезает до MAX_HISTORY=50', async () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      t: i, download: i, upload: i, ping: i,
    }));
    saveHistory(data);
    expect(loadHistory()).toHaveLength(50);
    // Проверим что сохранились последние 50
    expect(loadHistory()[0]).toEqual({ t: 10, download: 10, upload: 10, ping: 10 });
  });

  it('loadHistory ловит ошибку парсинга', () => {
    localStorage.setItem('inetometr:history:v1', '{not json');
    expect(loadHistory()).toEqual([]);
  });

  it('loadHistory возвращает [] если данные не массив', () => {
    localStorage.setItem('inetometr:history:v1', JSON.stringify({ foo: 1 }));
    expect(loadHistory()).toEqual([]);
  });
});

describe('addToHistory', () => {
  it('добавляет запись с timestamp', () => {
    const h = addToHistory({ download: 100, upload: 50, ping: 5 }, 'cloudflare');
    expect(h).toHaveLength(1);
    expect(h[0].download).toBe(100);
    expect(h[0].upload).toBe(50);
    expect(h[0].ping).toBe(5);
    expect(h[0].server).toBe('cloudflare');
    expect(typeof h[0].t).toBe('number');
  });

  it('добавляет в конец существующей истории', () => {
    addToHistory({ download: 10, upload: 5, ping: 20 });
    const h2 = addToHistory({ download: 20, upload: 10, ping: 15 });
    expect(h2).toHaveLength(2);
    expect(h2[1].download).toBe(20);
  });

  it('подставляет 0 для отсутствующих метрик', () => {
    const h = addToHistory({ download: 50, upload: 0, ping: 0 });
    expect(h[0].download).toBe(50);
    expect(h[0].upload).toBe(0);
  });
});

describe('clearHistory', () => {
  it('очищает localStorage', () => {
    addToHistory({ download: 10, upload: 5, ping: 20 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('группирует замеры по дням', () => {
    const now = new Date('2026-09-02T12:00:00Z').getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const history = [
      { t: now, download: 100, upload: 50, ping: 10 },
      { t: now - 2 * dayMs, download: 80, upload: 40, ping: 15 },
      { t: now - 3 * dayMs, download: 60, upload: 30, ping: 20 },
    ];
    const grouped = groupByDay(history, 7);
    const arr = [...grouped.values()];
    const total = arr.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(3);
  });

  it('возвращает `days` бакетов даже для пустых дней', () => {
    const grouped = groupByDay([], 7);
    expect(grouped.size).toBe(7);
    for (const bucket of grouped.values()) {
      expect(bucket.count).toBe(0);
    }
  });

  it('игнорирует записи старше days', () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const history = [
      { t: now, download: 100, upload: 50, ping: 10 },
      { t: now - 30 * dayMs, download: 1, upload: 1, ping: 100 },
    ];
    const grouped = groupByDay(history, 7);
    const total = [...grouped.values()].reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });
});

describe('delta', () => {
  it('null если меньше 2 записей', () => {
    expect(delta([], 'download')).toBeNull();
    expect(delta([{ t: 1, download: 100, upload: 50, ping: 5 }], 'download')).toBeNull();
  });

  it('null если предыдущее = 0', () => {
    expect(delta([{ t: 1, download: 0, upload: 0, ping: 5 }, { t: 2, download: 100, upload: 50, ping: 5 }], 'download')).toBeNull();
  });

  it('+50% если рост 100→150', () => {
    const h = [
      { t: 1, download: 100, upload: 50, ping: 5 },
      { t: 2, download: 150, upload: 50, ping: 5 },
    ];
    expect(delta(h, 'download')).toBe(50);
  });

  it('-25% если падение 100→75', () => {
    const h = [
      { t: 1, download: 100, upload: 50, ping: 5 },
      { t: 2, download: 75, upload: 50, ping: 5 },
    ];
    expect(delta(h, 'download')).toBe(-25);
  });
});

describe('averagesLastDays', () => {
  it('0 если нет замеров', () => {
    expect(averagesLastDays([], 7)).toEqual({ download: 0, upload: 0, count: 0 });
  });

  it('среднее по дням', () => {
    const now = Date.now();
    const history = [
      { t: now, download: 100, upload: 50, ping: 5 },
      { t: now - 1000, download: 200, upload: 100, ping: 10 },
    ];
    const r = averagesLastDays(history, 7);
    expect(r.download).toBe(150);
    expect(r.upload).toBe(75);
    expect(r.count).toBe(2);
  });
});

describe('recentHistory', () => {
  it('фильтрует по последним N дням', () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const history = [
      { t: now, download: 100, upload: 50, ping: 5 },
      { t: now - 3 * dayMs, download: 80, upload: 40, ping: 10 },
      { t: now - 10 * dayMs, download: 60, upload: 30, ping: 15 },
    ];
    const r = recentHistory(history, 7);
    expect(r).toHaveLength(2);
    expect(r[0].download).toBe(100);
    expect(r[1].download).toBe(80);
  });
});
