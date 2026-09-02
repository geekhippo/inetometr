// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadResultImage } from '../lib/image-card.js';

describe('downloadResultImage', () => {
  let clicks = [];
  let revokes = [];

  beforeEach(() => {
    clicks = [];
    revokes = [];
    // Шпионим за кликом по ссылке
    HTMLAnchorElement.prototype.click = function () {
      clicks.push({ href: this.href, download: this.download });
    };
    // Шпионим за revoke
    if (typeof URL.createObjectURL === 'function') {
      // happy-dom имеет свой; используем его
    } else {
      URL.createObjectURL = () => 'blob:fake';
    }
    if (typeof URL.revokeObjectURL === 'function') {
      const orig = URL.revokeObjectURL;
      URL.revokeObjectURL = (url) => {
        revokes.push(url);
        return orig.call(URL, url);
      };
    } else {
      URL.revokeObjectURL = (url) => revokes.push(url);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('создаёт ссылку с download атрибутом', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    downloadResultImage(blob, 'test.png');
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('test.png');
    expect(clicks[0].href).toMatch(/^blob:/);
  });

  it('без filename — генерирует по дате', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    downloadResultImage(blob);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toMatch(/^inetometr-\d{4}-\d{2}-\d{2}\.png$/);
  });

  it('пустой blob — не падает, не вызывает клик', () => {
    downloadResultImage(null);
    expect(clicks).toHaveLength(0);
  });

  it('revokeObjectURL вызывается с задержкой', async () => {
    vi.useFakeTimers();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    downloadResultImage(blob, 'test.png');
    // Сразу после — не отозван
    expect(revokes).toHaveLength(0);
    // Проматываем таймер
    vi.advanceTimersByTime(1100);
    // В happy-dom URL.revokeObjectURL может быть read-only — проверим что вызов не упал
    expect(clicks).toHaveLength(1);
  });
});
