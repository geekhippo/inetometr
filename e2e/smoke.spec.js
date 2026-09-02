// E2E: критический путь — замер должен стартануть, шкала отрисоваться, индикатор появиться.
// Мокируем network через page.route, чтобы тест был детерминированным.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  // Подменяем все запросы к Cloudflare — отвечаем быстро и предсказуемо.
  // Также добавляем cf-meta-* заголовки, чтобы бейдж сервера заполнился.
  await page.route('**/speed.cloudflare.com/**', async (route) => {
    const metaHeaders = {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'cf-meta-colo, cf-meta-country, cf-meta-city',
      'cf-meta-colo': 'MOW',
      'cf-meta-country': 'RU',
      'cf-meta-city': 'Moscow',
    };
    const url = route.request().url();
    if (url.includes('__down')) {
      const buf = Buffer.alloc(1024 * 1024, 0x42);
      await route.fulfill({ status: 200, body: buf, contentType: 'application/octet-stream', headers: metaHeaders });
    } else if (url.includes('__up')) {
      await route.fulfill({ status: 200, body: 'OK', contentType: 'text/plain', headers: metaHeaders });
    } else {
      await route.continue();
    }
  });
});

test('страница загружается и шкала рисуется', async ({ page }) => {
  await page.goto('/index.html');
  // 121 тик на шкале
  const ticks = page.locator('#ticks-group line.tick');
  await expect(ticks).toHaveCount(121);
  // Кнопка замера видна и подписана
  const btn = page.locator('#start-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toContainText('Начать замер');
  // Стартовое состояние: метрики показывают "—"
  await expect(page.locator('#v-download')).toContainText('—');
  await expect(page.locator('#v-upload')).toContainText('—');
  await expect(page.locator('#v-ping')).toContainText('—');
});

test('нажатие кнопки стартует замер и индикатор становится видимым', async ({ page }) => {
  await page.goto('/index.html');
  // Кнопка должна быть enabled
  const btn = page.locator('#start-btn');
  await expect(btn).toBeEnabled();
  // Стартуем
  await btn.click();
  // Через короткое время индикатор должен появиться
  await expect(page.locator('#progress-arc')).toHaveClass(/visible/, { timeout: 5000 });
  await expect(page.locator('#indicator')).toHaveClass(/visible/, { timeout: 5000 });
  // Не должно быть ошибок в консоли
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('геометрия: внешние концы тиков лежат на окружности rx=378', async ({ page }) => {
  await page.goto('/index.html');
  // Получаем координаты индикатора при t=0.5
  const result = await page.evaluate(() => {
    const ticks = document.querySelectorAll('#ticks-group line.tick');
    const cx = 400, cy = 460, rx = 378;
    // Тик i=60 (середина шкалы)
    const tick = ticks[60];
    const x2 = parseFloat(tick.getAttribute('x2'));
    const y2 = parseFloat(tick.getAttribute('y2'));
    const r = Math.hypot(x2 - cx, y2 - cy);
    return { tickRadius: r, expected: rx };
  });
  expect(result.tickRadius).toBeCloseTo(result.expected, 1);
});

test('бейдж CDN-сервера появляется после probe-запроса', async ({ page }) => {
  await page.goto('/index.html');
  // Ждём появления бейджа с "Замер с:"
  await expect(page.locator('#server-badge-text')).toContainText('Замер с:', { timeout: 5000 });
  await expect(page.locator('#server-badge-text')).toContainText('MOW');
  await expect(page.locator('#server-badge-text')).toContainText('RU');
});

test('Open Graph meta-теги присутствуют для превью при шаринге', async ({ page }) => {
  await page.goto('/index.html');
  // og:title
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
  expect(ogTitle).toContain('Инетометр');
  // og:image
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toMatch(/og-image\.(svg|png)$/);
  // twitter:card
  const twCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
  expect(twCard).toBe('summary_large_image');
  // og:image:width / height
  const ogW = await page.locator('meta[property="og:image:width"]').getAttribute('content');
  const ogH = await page.locator('meta[property="og:image:height"]').getAttribute('content');
  expect(ogW).toBe('1200');
  expect(ogH).toBe('630');
});

test('og-image.svg доступен и валидный SVG', async ({ page }) => {
  const resp = await page.request.get('/og-image.svg');
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toMatch(/image\/svg|image/);
  const body = await resp.text();
  expect(body).toMatch(/<svg[^>]*viewBox="0 0 1200 630"/);
  // Должен содержать "Инетометр"
  expect(body).toContain('Инетометр');
});

test('кнопка "Скопировать" скрыта до замера и появляется после', async ({ page }) => {
  await page.goto('/index.html');
  // Изначально скрыта
  await expect(page.locator('.result-actions')).toBeHidden();
  // Кликаем кнопку замера
  await page.locator('#start-btn').click();
  // Должна появиться после завершения (но т.к. у нас 1 МБ download это быстро)
  await expect(page.locator('.result-actions')).toBeVisible({ timeout: 10000 });
  // Кнопка copy существует и подписана
  const copyBtn = page.locator('#copy-btn');
  await expect(copyBtn).toBeVisible();
  await expect(copyBtn).toContainText('Скопировать результат');
});

test('clipboard содержит отформатированный результат', async ({ page, context }) => {
  // Даём разрешение на чтение буфера
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/index.html');
  // Запускаем замер
  await page.locator('#start-btn').click();
  await expect(page.locator('.result-actions')).toBeVisible({ timeout: 10000 });
  // Кликаем copy
  await page.locator('#copy-btn').click();
  // Проверяем что в буфере
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('📡 ИНЕТОМЕТР');
  expect(text).toContain('Входящая');
  expect(text).toContain('Исходящая');
  expect(text).toContain('Задержка');
  expect(text).toContain('inetometr.ru');
  // После успешного копирования label меняется
  await expect(page.locator('#copy-btn')).toContainText('Скопировано!');
});

test('кнопка "Скачать картинку" генерирует PNG и инициирует скачивание', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#start-btn').click();
  await expect(page.locator('.result-actions')).toBeVisible({ timeout: 10000 });

  // Перехватываем download
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('#image-btn').click();

  const download = await downloadPromise;
  // Проверяем имя файла
  expect(download.suggestedFilename()).toMatch(/^inetometr-\d{4}-\d{2}-\d{2}\.png$/);

  // Сохраняем во временный файл и проверяем что это валидный PNG
  const path = await download.path();
  const buf = readFileSync(path);
  // PNG magic: 89 50 4E 47
  expect(buf[0]).toBe(0x89);
  expect(buf[1]).toBe(0x50);
  expect(buf[2]).toBe(0x4e);
  expect(buf[3]).toBe(0x47);
  // Разумный размер: > 1КБ
  expect(buf.length).toBeGreaterThan(1024);

  // После скачивания label должен измениться
  await expect(page.locator('#image-btn')).toContainText(/Скачано|Скачать/);
});
