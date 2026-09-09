// crawl-snackpass.mjs
//
// Crawls a Snackpass ordering page and captures the underlying JSON API
// responses (menu items, modifier groups, options) that the page's React
// app fetches client-side. Snackpass loads menu data via XHR/fetch after
// the initial HTML, so a plain fetch() of the page only gets you meta tags —
// this script drives a real headless browser and listens to network traffic.
//
// USAGE:
//   npm init -y
//   npm install playwright
//   npx playwright install chromium
//   node crawl-snackpass.mjs https://order.snackpass.co/teazenteabrentwood
//
// OUTPUT:
//   ./snackpass-capture/*.json  — one file per captured API response
//   ./snackpass-capture/_summary.json — list of every captured URL + size

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = process.argv[2] || 'https://order.snackpass.co/teazenteabrentwood';
const OUTPUT_DIR = './snackpass-capture';

// Keywords used to decide which JSON responses are worth keeping.
// Widen this list if the site's API uses different naming.
const KEYWORDS = ['menu', 'item', 'product', 'modifier', 'store', 'catalog', 'category', 'option'];

function safeFilename(url) {
  return url.replace(/[^a-z0-9]/gi, '_').slice(-100);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const page = await context.newPage();

  const captured = [];

  page.on('response', async (response) => {
    try {
      const url = response.url();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      if (!KEYWORDS.some((k) => url.toLowerCase().includes(k))) return;

      const json = await response.json().catch(() => null);
      if (!json) return;

      const filename = path.join(OUTPUT_DIR, `${Date.now()}-${safeFilename(url)}.json`);
      fs.writeFileSync(filename, JSON.stringify(json, null, 2));
      captured.push({ url, filename, bytes: fs.statSync(filename).size });
      console.log('[captured]', url, '->', filename);
    } catch (err) {
      // ignore individual response failures, keep crawling
    }
  });

  console.log('Navigating to', TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {
    console.log('networkidle timeout hit, continuing anyway');
  });

  // Give lazy-loaded widgets time to fire their fetches.
  await page.waitForTimeout(3000);

  // Best-effort: click through visible menu item cards to trigger the
  // per-item modifier modal, which often fires an additional API call
  // that returns modifier groups (Topping/Sweet/Ice/Tea Base/Milk Base).
  // Selectors are guesses — inspect the page in DevTools and adjust if
  // this finds 0 elements.
  const candidateSelectors = [
    '[data-testid*="item"]',
    '[data-testid*="product"]',
    '[class*="MenuItem"]',
    '[class*="ProductCard"]',
    '[class*="menu-item"]',
  ];

  let clicked = 0;
  for (const selector of candidateSelectors) {
    const elements = await page.$$(selector);
    if (elements.length === 0) continue;
    console.log(`Selector "${selector}" matched ${elements.length} elements`);
    for (const el of elements) {
      try {
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(800);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);
        clicked++;
      } catch {
        // element not clickable (off-screen, detached, etc.) — skip
      }
    }
    if (clicked > 0) break; // stop after the first selector that actually worked
  }
  console.log(`Clicked through ${clicked} candidate item elements`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_summary.json'),
    JSON.stringify(captured, null, 2)
  );

  await browser.close();
  console.log(`\nDone. Captured ${captured.length} JSON responses in ${OUTPUT_DIR}/`);
  console.log('Open the files there and look for ones containing "modifier", "topping",');
  console.log('"sweetness" or similar keys — those are what you want to feed into the');
  console.log('system prompt as the modifier dictionary.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
