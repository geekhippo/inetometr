// ============================================================
// Unit-тесты: lib/server-meta.js — парсинг CDN headers
// ============================================================
import { describe, it, expect } from 'vitest';
import { parseServerMeta, describeServer, parseTrace } from '../lib/server-meta.js';

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
  it('объединяет city · country · CDN colo', () => {
    expect(describeServer({ city: 'Riga', country: 'LV', colo: 'ARN' })).toBe('Riga · LV · CDN ARN');
  });

  it('опускает пустые поля', () => {
    expect(describeServer({ country: 'RU', colo: 'MOW' })).toBe('RU · CDN MOW');
    // Только colo — показываем "Cloudflare MOW"
    expect(describeServer({ colo: 'MOW' })).toBe('Cloudflare MOW');
  });

  it('пустой объект → пустая строка', () => {
    expect(describeServer({})).toBe('');
    expect(describeServer(null)).toBe('');
  });
});

describe('parseTrace', () => {
  it('парсит типичный ответ /cdn-cgi/trace', () => {
    const text = `fl=4b1234
h=speed.cloudflare.com
ip=46.8.230.49
ts=1693594827.123
visit_scheme=https
uag=Test/1.0
colo=ARN
sliver=none
http=http/2
loc=LV
tls=TLSv1.3
sni=plaintext
warp=off
gateway=off
rbi=off
kex=X25519`;
    const out = parseTrace(text);
    expect(out.colo).toBe('ARN');
    expect(out.ip).toBe('46.8.230.49');
    expect(out.loc).toBe('LV');
    expect(out.http).toBe('http/2');
  });

  it('пустой текст → пустой объект', () => {
    expect(parseTrace('')).toEqual({});
  });

  it('строки без = игнорируются', () => {
    expect(parseTrace('a=1\nbroken line\nb=2')).toEqual({ a: '1', b: '2' });
  });
});
