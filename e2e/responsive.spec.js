// E2E: адаптивный дизайн — страница должна корректно отображаться
// на разных разрешениях: 375 (iPhone SE), 768 (iPad), 1280 (Laptop), 1920 (Desktop).
// Также проверяем landscape-режим.
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'iPad 768x1024', width: 768, height: 1024 },
  { name: 'Laptop 1280x800', width: 1280, height: 800 },
  { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`нет горизонтального скролла @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/index.html?v=responsive');
    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test(`нет вертикального скролла @ ${vp.name} (для desktop 800px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/index.html?v=responsive');
    const overflow = await page.evaluate(() => {
      return {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      };
    });
    // На десктопе с 800px+ страница должна влезать без вертикального скролла
    if (vp.height >= 800) {
      expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
    }
  });

  test(`121 тик на шкале @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/index.html?v=responsive');
    const ticks = page.locator('#ticks-group line.tick');
    await expect(ticks).toHaveCount(121);
  });

  test(`3 метрики видны (Входящая/Исходящая/Задержка) @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/index.html?v=responsive');
    await expect(page.locator('#v-download')).toBeVisible();
    await expect(page.locator('#v-upload')).toBeVisible();
    await expect(page.locator('#v-ping')).toBeVisible();
  });

  test(`кнопка "Начать замер" видна @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/index.html?v=responsive');
    const btn = page.locator('#start-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Начать замер');
  });
}

test('landscape: 812x375 (iPhone X landscape) — нет вертикального скролла', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto('/index.html?v=responsive');
  const overflow = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
});
