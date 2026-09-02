// Диагностика: где именно скролл на разных разрешениях
import { test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone SE 375x667', w: 375, h: 667 },
  { name: 'iPad 768x1024', w: 768, h: 1024 },
  { name: 'Laptop 1280x800', w: 1280, h: 800 },
  { name: 'Desktop 1920x1080', w: 1920, h: 1080 },
  { name: 'iPhone X landscape 812x375', w: 812, h: 375 },
];

for (const vp of VIEWPORTS) {
  test(`ДИАГНОСТИКА: ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto('/index.html?v=responsive');
    const data = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        htmlScrollWidth: html.scrollWidth,
        htmlClientWidth: html.clientWidth,
        htmlScrollHeight: html.scrollHeight,
        htmlClientHeight: html.clientHeight,
        bodyScrollWidth: body.scrollWidth,
        bodyClientWidth: body.clientWidth,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        appHeight: document.querySelector('.app')?.scrollHeight,
        gaugeHeight: document.querySelector('.gauge-section')?.scrollHeight,
        gaugeMetricsHeight: document.querySelector('.gauge-metrics')?.scrollHeight,
        chartHeight: document.querySelector('.chart-card')?.scrollHeight,
      };
    });
    console.log(`${vp.name}:`, JSON.stringify(data, null, 2));
  });
}
