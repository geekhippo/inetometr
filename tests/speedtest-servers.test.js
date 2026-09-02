// Unit: конфигурация серверов спидометра
import { describe, it, expect } from 'vitest';
import {
  SERVERS,
  downloadServers,
  uploadServers,
  pingServers,
  buildUrl,
  bytesToHetznerSize,
} from '../lib/speedtest-servers.js';

describe('SERVERS config', () => {
  it('содержит cloudflare как primary', () => {
    expect(SERVERS.find((s) => s.id === 'cloudflare')).toBeDefined();
  });
  it('содержит минимум 2 сервера', () => {
    expect(SERVERS.length).toBeGreaterThanOrEqual(2);
  });
  it('у всех серверов есть id, name, priority', () => {
    for (const s of SERVERS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(typeof s.priority).toBe('number');
    }
  });
  it('приоритеты уникальны', () => {
    const prios = SERVERS.map((s) => s.priority);
    expect(new Set(prios).size).toBe(prios.length);
  });
});

describe('downloadServers', () => {
  it('возвращает только серверы с downloadUrl', () => {
    const ds = downloadServers();
    expect(ds.length).toBeGreaterThan(0);
    for (const s of ds) expect(s.downloadUrl).toBeTruthy();
  });
  it('отсортированы по priority', () => {
    const ds = downloadServers();
    for (let i = 1; i < ds.length; i++) {
      expect(ds[i].priority).toBeGreaterThanOrEqual(ds[i - 1].priority);
    }
  });
  it('cloudflare — первый', () => {
    expect(downloadServers()[0].id).toBe('cloudflare');
  });
});

describe('uploadServers', () => {
  it('cloudflare и httpbin имеют upload', () => {
    const us = uploadServers();
    const ids = us.map((s) => s.id);
    expect(ids).toContain('cloudflare');
    expect(ids).toContain('httpbin');
  });
  it('hetzner НЕ имеет upload', () => {
    const us = uploadServers();
    expect(us.find((s) => s.id === 'hetzner')).toBeUndefined();
  });
});

describe('pingServers', () => {
  it('cloudflare и hetzner имеют ping', () => {
    const ps = pingServers();
    const ids = ps.map((s) => s.id);
    expect(ids).toContain('cloudflare');
    expect(ids).toContain('hetzner');
  });
});

describe('buildUrl', () => {
  it('подставляет {bytes}', () => {
    expect(buildUrl('https://x/y?bytes={bytes}', { bytes: 1000 })).toBe('https://x/y?bytes=1000');
  });
  it('подставляет {size}', () => {
    expect(buildUrl('https://x/{size}.bin', { size: '10MB' })).toBe('https://x/10MB.bin');
  });
  it('подставляет {n}', () => {
    expect(buildUrl('https://x?cb={n}', { n: 12345 })).toBe('https://x?cb=12345');
  });
  it('подставляет несколько параметров сразу', () => {
    expect(buildUrl('https://x?b={bytes}&cb={n}', { bytes: 100, n: 5 }))
      .toBe('https://x?b=100&cb=5');
  });
  it('заменяет ВСЕ вхождения параметра', () => {
    expect(buildUrl('https://x?a={bytes}&b={bytes}', { bytes: 7 }))
      .toBe('https://x?a=7&b=7');
  });
  it('не тронутые {placeholders} остаются в URL', () => {
    expect(buildUrl('https://x?b={bytes}&u={unknown}', { bytes: 1 }))
      .toBe('https://x?b=1&u={unknown}');
  });
});

describe('bytesToHetznerSize', () => {
  it('1 МБ → 1MB', () => {
    expect(bytesToHetznerSize(1_000_000)).toBe('1MB');
  });
  it('10 МБ → 10MB', () => {
    expect(bytesToHetznerSize(10_000_000)).toBe('10MB');
  });
  it('100 МБ → 100MB', () => {
    expect(bytesToHetznerSize(100_000_000)).toBe('100MB');
  });
  it('50 МБ → 10MB (округление вниз)', () => {
    expect(bytesToHetznerSize(50_000_000)).toBe('10MB');
  });
});
