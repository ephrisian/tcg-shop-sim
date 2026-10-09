const loadMoreKeywords = ['more', 'view more', '查看更多', '加载更多', '点击加载', '更多'];
const maxLoadMoreClicks = 300;

async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw new Error('playwright-core is not installed. Run "npm install" in tcg-shop-sim.');
  }
  const attempts = [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
  let lastError;
  for (const options of attempts) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not start a browser (install Microsoft Edge or Chrome): ${lastError?.message || 'unknown error'}`);
}

export function parseCardFunUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'card.fun' || !/^\/products\/\d+\/?$/.test(url.pathname)) {
    throw new Error('Enter a URL like https://card.fun/products/301');
  }
  url.search = '';
  url.hash = '';
  return url;
}

// Loads a card.fun product page, expands every "MORE" button, and returns the card list.
export async function scrapeCardFunSet(rawUrl, onProgress = () => {}) {
  const url = parseCardFunUrl(rawUrl);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    onProgress('Opening card.fun…');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.part__wrap__item', { timeout: 30000 });

    const countCards = () => page.locator('.part__wrap__item').count();
    let clicks = 0;
    let idleRounds = 0;
    while (clicks < maxLoadMoreClicks && idleRounds < 3) {
      const before = await countCards();
      const clicked = await page.evaluate((keywords) => {
        const candidates = document.querySelectorAll('.loadMoreWrap, button, a, div, span, p');
        for (const el of candidates) {
          if (el.children.length > 2) continue;
          const text = (el.textContent || '').trim().toLowerCase();
          if (text.length > 12 || !keywords.includes(text)) continue;
          if (el.offsetHeight === 0 || getComputedStyle(el).visibility === 'hidden') continue;
          el.scrollIntoView({ block: 'center' });
          el.click();
          return true;
        }
        return false;
      }, loadMoreKeywords);
      if (!clicked) { idleRounds++; await page.waitForTimeout(700); continue; }
      clicks++;
      try {
        await page.waitForFunction((n) => document.querySelectorAll('.part__wrap__item').length > n, before, { timeout: 8000 });
        idleRounds = 0;
      } catch {
        idleRounds++;
      }
      onProgress(`Loading cards… ${await countCards()} found`);
    }

    const result = await page.evaluate(() => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
      const cards = [];
      const sections = document.querySelectorAll('.part');
      const readItem = (item, section) => {
        const img = item.querySelector('img');
        const src = img?.getAttribute('src') || '';
        if (!src) return;
        cards.push({ name: text(item.querySelector('.name')), type: text(item.querySelector('.type')), section, imageUrl: src });
      };
      if (sections.length) {
        sections.forEach(part => part.querySelectorAll('.part__wrap__item').forEach(item => readItem(item, text(part.querySelector('.part__title')))));
      } else {
        document.querySelectorAll('.part__wrap__item').forEach(item => readItem(item, ''));
      }
      return { title: document.title, cards };
    });

    // Dedupe on the stable path. The signed query must stay untouched: the CDN signature covers it, so stripping it causes 403s.
    const seen = new Set();
    const cards = [];
    for (const card of result.cards) {
      let imageUrl;
      let key;
      try {
        const parsed = new URL(card.imageUrl, url);
        key = parsed.origin + parsed.pathname;
        imageUrl = parsed.href;
      } catch { continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({ ...card, imageUrl });
    }
    if (cards.length === 0) throw new Error('No cards were found on that page.');
    return { url: url.href, productId: url.pathname.split('/').filter(Boolean).pop(), title: result.title.replace(/-?card\.fun$/i, '').trim(), cards };
  } finally {
    await browser.close();
  }
}
