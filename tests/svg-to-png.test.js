// @vitest-environment happy-dom
// Unit: утилиты SVG-to-PNG. Рендеринг canvas в happy-dom не поддерживается,
// полное тестирование — в e2e/smoke.spec.js (Chromium).
import { describe, it, expect, vi } from 'vitest';
import { svgToPng, svgUrlToPng } from '../lib/svg-to-png.js';

const SAMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="red"/></svg>';

describe('svgToPng (happy-dom не рендерит canvas — поведение под таймаут)', () => {
  it('функция существует и принимает аргументы', () => {
    expect(typeof svgToPng).toBe('function');
    // Ожидаем, что функция попытается загрузить Image. В happy-dom это таймаутит,
    // но проверим что вызов с правильными аргументами не падает с TypeError.
    const promise = svgToPng(SAMPLE_SVG, 100, 50);
    expect(promise).toBeInstanceOf(Promise);
    // Не дожидаемся — пусть race с таймаутом
    promise.catch(() => {});
  });
});

describe('svgUrlToPng', () => {
  it('загружает SVG по URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_SVG,
    });
    // Запускаем но не дожидаемся — рендер в happy-dom таймаутит
    const promise = svgUrlToPng('https://example.com/og.svg');
    expect(promise).toBeInstanceOf(Promise);
    expect(fetch).toHaveBeenCalledWith('https://example.com/og.svg');
    promise.catch(() => {});
  });

  it('ошибка HTTP — throws', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(svgUrlToPng('https://example.com/missing.svg')).rejects.toThrow('HTTP 404');
  });

  it('сетевая ошибка — throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(svgUrlToPng('https://example.com/og.svg')).rejects.toThrow('network down');
  });
});
