// ============================================================
// Unit-тесты: lib/server-meta.js — парсинг CDN headers
// ============================================================
import { describe, it, expect } from 'vitest';
import { parseServerMeta, describeServer } from '../lib/server-meta.js';

describe('parseServerMeta', () => {
  it('извлекает все 5 базовых полей из Headers (объект с get)', () => {
    const headers = {
      get: (k) => {
        const map = {
          'cf-meta-colo': 'ARN',
          'cf-meta-country': 'LV',
          'cf-meta-city': 'Riga',
          'cf-meta-ip': '46.8.230.49',
          'cf-meta-asn': '56971',
        };
        return map[k.toLowerCase()] || null;
      },
    };
    const meta = parseServerMeta(headers);
    expect(meta.colo).toBe('ARN');
    expect(meta.country).toBe('LV');
    expect(meta.city).toBe('Riga');
    expect(meta.ip).toBe('46.8.230.49');
    expect(meta.asn).toBe('56971');
  });

  it('извлекает из plain object (Headers fallback)', () => {
    const headers = {
      'CF-META-COLO': 'MOW',
      'cf-meta-country': 'RU',
      'cf-meta-city': 'Moscow',
    };
    const meta = parseServerMeta(headers);
    expect(meta.colo).toBe('MOW');
    expect(meta.country).toBe('RU');
    expect(meta.city).toBe('Moscow');
  });

  it('извлекает из Map', () => {
    const headers = new Map([
      ['cf-meta-colo', 'FRA'],
      ['cf-meta-country', 'DE'],
    ]);
    const meta = parseServerMeta(headers);
    expect(meta.colo).toBe('FRA');
    expect(meta.country).toBe('DE');
  });

  it('пустые/нулевые значения пропускаются', () => {
    const headers = {
      get: (k) => {
        const map = { 'cf-meta-colo': '', 'cf-meta-country': '   ' };
        return map[k.toLowerCase()];
      },
    };
    const meta = parseServerMeta(headers);
    expect(meta.colo).toBeUndefined();
    expect(meta.country).toBeUndefined();
  });

  it('отсутствующие заголовки → пустой объект', () => {
    expect(parseServerMeta({ get: () => null })).toEqual({});
    expect(parseServerMeta(null)).toEqual({});
    expect(parseServerMeta({})).toEqual({});
  });
});

describe('describeServer', () => {
  it('объединяет city · country · colo', () => {
    expect(describeServer({ city: 'Riga', country: 'LV', colo: 'ARN' })).toBe('Riga · LV · ARN');
  });

  it('опускает пустые поля', () => {
    expect(describeServer({ country: 'RU', colo: 'MOW' })).toBe('RU · MOW');
    expect(describeServer({ colo: 'MOW' })).toBe('MOW');
  });

  it('пустой объект → пустая строка', () => {
    expect(describeServer({})).toBe('');
    expect(describeServer(null)).toBe('');
  });
});
