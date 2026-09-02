// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareSupport, shareText, shareImage } from '../lib/share-api.js';

describe('shareSupport', () => {
  it('возвращает {share: false, files: false} без navigator', () => {
    const orig = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
    expect(shareSupport()).toEqual({ share: false, files: false });
    Object.defineProperty(globalThis, 'navigator', { value: orig, configurable: true });
  });

  it('share=true если navigator.share — функция', () => {
    const orig = navigator.share;
    navigator.share = async () => {};
    const s = shareSupport();
    expect(s.share).toBe(true);
    navigator.share = orig;
  });

  it('share=false если navigator.share нет', () => {
    const orig = navigator.share;
    delete navigator.share;
    expect(shareSupport().share).toBe(false);
    navigator.share = orig;
  });
});

describe('shareText', () => {
  it('unsupported — {ok: false, reason: "unsupported"}', async () => {
    delete navigator.share;
    const r = await shareText({ title: 'T', text: 'X' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unsupported');
  });

  it('успешный share — {ok: true}', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    const r = await shareText({ title: 'T', text: 'X', url: 'https://inetometr.ru' });
    expect(r.ok).toBe(true);
    expect(navigator.share).toHaveBeenCalledWith({ title: 'T', text: 'X', url: 'https://inetometr.ru' });
    delete navigator.share;
  });

  it('AbortError — {ok: false, reason: "aborted"}', async () => {
    navigator.share = vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError'));
    const r = await shareText({ title: 'T', text: 'X' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('aborted');
    delete navigator.share;
  });

  it('другая ошибка — {ok: false, reason: message}', async () => {
    navigator.share = vi.fn().mockRejectedValue(new Error('Network failed'));
    const r = await shareText({ title: 'T', text: 'X' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('Network failed');
    delete navigator.share;
  });
});

describe('shareImage', () => {
  it('unsupported — {ok: false, reason: "unsupported"}', async () => {
    delete navigator.share;
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    const r = await shareImage({ title: 'T', text: 'X', blob, filename: 'test.png' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unsupported');
  });

  it('с поддержкой файлов — вызывает navigator.share с files', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    navigator.canShare = vi.fn().mockReturnValue(true);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const r = await shareImage({ title: 'T', text: 'X', url: 'https://inetometr.ru', blob, filename: 'test.png' });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('image');
    const call = navigator.share.mock.calls[0][0];
    expect(call.title).toBe('T');
    expect(call.files).toHaveLength(1);
    expect(call.files[0].name).toBe('test.png');
    delete navigator.share;
    delete navigator.canShare;
  });

  it('без поддержки файлов — fallback на shareText', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    navigator.canShare = vi.fn().mockReturnValue(false);
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    const r = await shareImage({ title: 'T', text: 'X', blob, filename: 'test.png' });
    expect(r.ok).toBe(true);
    expect(r.mode).toBeUndefined(); // shareText не возвращает mode
    const call = navigator.share.mock.calls[0][0];
    expect(call.files).toBeUndefined();
    delete navigator.share;
    delete navigator.canShare;
  });

  it('AbortError — {ok: false, reason: "aborted"}', async () => {
    navigator.share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    navigator.canShare = vi.fn().mockReturnValue(true);
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    const r = await shareImage({ title: 'T', text: 'X', blob, filename: 'test.png' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('aborted');
    delete navigator.share;
    delete navigator.canShare;
  });
});
