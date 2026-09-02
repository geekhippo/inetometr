// ============================================================
// Unit-тесты: lib/share.js — форматирование и копирование
// ============================================================
import { describe, it, expect } from 'vitest';
import { formatResults } from '../lib/share.js';

describe('formatResults', () => {
  it('форматирует 3 базовые метрики', () => {
    const text = formatResults({ download: 87.5, upload: 45.2, ping: 12 });
    expect(text).toContain('87.5');
    expect(text).toContain('45.2');
    expect(text).toContain('12');
    expect(text).toContain('Входящая');
    expect(text).toContain('Исходящая');
    expect(text).toContain('Задержка');
  });

  it('большие скорости (>=100) — 1 знак после запятой', () => {
    const text = formatResults({ download: 123.456, upload: 500.0, ping: 5 });
    expect(text).toContain('123.5');
    expect(text).toContain('500.0');
  });

  it('маленькие скорости (<100) — 2 знака', () => {
    const text = formatResults({ download: 7.123, upload: 0.5, ping: 25 });
    expect(text).toContain('7.12');
    expect(text).toContain('0.50');
  });

  it('ping < 10 мс — 1 знак', () => {
    const text = formatResults({ download: 50, upload: 50, ping: 3.7 });
    expect(text).toContain('3.7');
  });

  it('ping >= 10 мс — 0 знаков (целое)', () => {
    const text = formatResults({ download: 50, upload: 50, ping: 18.7 });
    expect(text).toContain('19');
  });

  it('джиттер включается только если > 0', () => {
    expect(formatResults({ download: 50, upload: 50, ping: 10, jitter: 2.5 })).toContain('Джиттер');
    expect(formatResults({ download: 50, upload: 50, ping: 10 })).not.toContain('Джиттер');
    expect(formatResults({ download: 50, upload: 50, ping: 10, jitter: 0 })).not.toContain('Джиттер');
  });

  it('метаданные сервера — все 3 поля через ·', () => {
    const text = formatResults(
      { download: 50, upload: 50, ping: 10 },
      { city: 'Москва', country: 'RU', colo: 'MOW' }
    );
    expect(text).toContain('Москва · RU · MOW');
  });

  it('IP и ASN в конце', () => {
    const text = formatResults(
      { download: 50, upload: 50, ping: 10 },
      { ip: '1.2.3.4', asn: '12345' }
    );
    expect(text).toContain('1.2.3.4');
    expect(text).toContain('12345');
  });

  it('нулевые/мусорные значения → прочерк', () => {
    const text = formatResults({ download: 0, upload: -5, ping: NaN });
    expect(text).toContain('—');
  });

  it('ссылка на сайт в конце', () => {
    const text = formatResults({ download: 50, upload: 50, ping: 10 });
    expect(text).toContain('inetometr.ru');
  });
});
