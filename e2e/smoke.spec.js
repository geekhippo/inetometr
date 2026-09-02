// E2E: критический путь — замер должен стартануть, шкала отрисоваться, индикатор появиться.
// Мокируем network через page.route, чтобы тест был детерминированным.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Подменяем все запросы к Cloudflare — отвечаем быстро и предсказуемо.
  await page.route('**/speed.cloudflare.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('__down')) {
      // Эмулируем download: 1 МБ файл
      const buf = Buffer.alloc(1024 * 1024, 0x42);
      await route.fulfill({ status: 200, body: buf, contentType: 'application/octet-stream' });
    } else if (url.includes('__up')) {
      await route.fulfill({ status: 200, body: 'OK', contentType: 'text/plain' });
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
