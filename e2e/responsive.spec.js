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
    await page.waitForTimeout(100);
    const overflowInfo = await page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      const app = document.querySelector('.app');
      const topbar = document.querySelector('.topbar');
      const button = document.querySelector('#info-btn');
      const info = { ok: scrollWidth <= clientWidth + 1, scrollWidth, clientWidth };
      if (!info.ok) {
        const details = [];
        const logEl = (el, name) => {
          if (!el) { details.push(`${name}: null`); return; }
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          details.push(`${name}: width=${rect.width}, height=${rect.height}, left=${rect.left}, right=${rect.right}, top=${rect.top}, bottom=${rect.bottom}`);
          details.push(`  style: width=${style.width}, height=${style.height}, padding-left=${style.paddingLeft}, padding-right=${style.paddingRight}, margin-left=${style.marginLeft}, margin-right=${style.marginTop}, box-sizing=${style.boxSizing}`);
        };
        logEl(document.documentElement, 'html');
        logEl(document.body, 'body');
        logEl(app, '.app');
        logEl(topbar, '.topbar');
        logEl(button, '#info-btn');
        // check overflow via left/right
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
        let node;
        const offenders = [];
        while (node = walker.nextNode()) {
          const rect = node.getBoundingClientRect();
          if (rect.right > clientWidth + 1 || rect.left < -1) {
            offenders.push({
              tag: node.tagName,
              id: node.id,
              class: node.className,
              width: rect.width,
              left: rect.left,
              right: rect.right,
              styleWidth: window.getComputedStyle(node).width,
              stylePaddingL: window.getComputedStyle(node).paddingLeft,
              stylePaddingR: window.getComputedStyle(node).paddingRight,
              styleMarginL: window.getComputedStyle(node).marginLeft,
              styleMarginR: window.getComputedStyle(node).marginRight,
            });
          }
        }
        if (offenders.length > 0) {
          details.push(`Offending elements count: ${offenders.length}`);
          details.push(JSON.stringify(offenders.slice(0,10), null, 2));
        } else {
          details.push(`No element exceeds clientWidth bounds`);
        }
        info.details = details.join('\n');
      }
      return info;
    });
    if (!overflowInfo.ok) {
      console.log(`Horizontal overflow: ${overflowInfo.scrollWidth - overflowInfo.clientWidth}px`);
      console.log(overflowInfo.details);
    }
    expect(overflowInfo.ok).toBe(true);
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
