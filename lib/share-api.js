// ============================================================
// Inetometer — обёртка над Web Share API
// Graceful fallback: проверка поддержки, обработка отмены пользователем.
// ============================================================

/**
 * Поддерживает ли устройство navigator.share (мобильные, некоторые десктопы)
 * и/или navigator.canShare с файлами.
 *
 * @returns {{share: boolean, files: boolean}}
 */
export function shareSupport() {
  if (typeof navigator === 'undefined') return { share: false, files: false };
  const share = typeof navigator.share === 'function';
  let files = false;
  if (share && typeof navigator.canShare === 'function') {
    try {
      // Проверяем возможность расшарить Blob
      const testFile = new File([new Uint8Array(8)], 'test.png', { type: 'image/png' });
      files = navigator.canShare({ files: [testFile] });
    } catch {
      files = false;
    }
  }
  return { share, files };
}

/**
 * Расшарить текст результата (без файлов). Открывает нативный диалог.
 *
 * @param {object} opts
 * @param {string} opts.title     — заголовок (имя приложения)
 * @param {string} opts.text      — основной текст (результат замера)
 * @param {string} [opts.url]     — URL страницы
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function shareText({ title, text, url }) {
  if (!shareSupport().share) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    await navigator.share({ title, text, url });
    return { ok: true };
  } catch (e) {
    if (e && e.name === 'AbortError') {
      return { ok: false, reason: 'aborted' };
    }
    return { ok: false, reason: e?.message || 'unknown' };
  }
}

/**
 * Расшарить PNG-картинку + текст. На устройствах без поддержки файлов
 * в share — откатывается на shareText без картинки.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.text
 * @param {string} [opts.url]
 * @param {Blob}   opts.blob      — PNG-результат
 * @param {string} opts.filename  — имя файла
 */
export async function shareImage({ title, text, url, blob, filename }) {
  if (!shareSupport().share) {
    return { ok: false, reason: 'unsupported' };
  }
  if (shareSupport().files) {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      await navigator.share({ title, text, url, files: [file] });
      return { ok: true, mode: 'image' };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { ok: false, reason: 'aborted' };
      }
      // Фоллбэк на текст
      return shareText({ title, text, url });
    }
  }
  return shareText({ title, text, url });
}
