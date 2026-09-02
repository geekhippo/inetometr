import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.route('**/speed.cloudflare.com/**', async (route) => {
  await route.fulfill({
    status: 200,
    body: 'X'.repeat(1024),
    headers: {
      'access-control-allow-origin': '*',
      'access-control-expose-headers':
        'cf-meta-ip, cf-meta-colo, cf-meta-asn, cf-meta-country, cf-meta-city',
      'cf-meta-colo': 'MOW',
      'cf-meta-country': 'RU',
      'cf-meta-city': 'Moscow',
      'cf-meta-ip': '1.2.3.4',
      'cf-meta-asn': '12345',
    },
  });
});

await page.goto('http://127.0.0.1:8766/index.html?v=v14final');
await page.waitForFunction(
  () => document.getElementById('server-badge-text')?.textContent?.includes('Замер с:'),
  { timeout: 5000 }
);
await page.screenshot({
  path: 'C:/Users/shaba/.config/browser-harness/tmp/inetometr-v14-initial.png',
  fullPage: false,
});
console.log('SHOT1: inetometr-v14-initial.png');

// Эмулируем завершённый замер: заполним метрики и покажем result-actions
await page.evaluate(() => {
  document.getElementById('v-download').textContent = '87.5';
  document.getElementById('v-upload').textContent = '45.2';
  document.getElementById('v-ping').textContent = '12';
  document.querySelector('.result-actions').hidden = false;
});
await page.waitForTimeout(300);
await page.screenshot({
  path: 'C:/Users/shaba/.config/browser-harness/tmp/inetometr-v14-after.png',
  fullPage: false,
});
console.log('SHOT2: inetometr-v14-after.png');

await browser.close();
