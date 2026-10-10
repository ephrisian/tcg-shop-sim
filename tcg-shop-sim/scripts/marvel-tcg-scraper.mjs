import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './cardfun-scraper.mjs';

const defaultUrl = 'https://www.marvelherorush.com/en/cards';
const maxPages = 200;
const extensions = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/avif': 'avif' };

export function parseMarvelTcgUrl(value = defaultUrl) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`Enter a URL like ${defaultUrl}`);
  url.hash = '';
  return url;
}

// Image links are signed with expiring query parameters, so the path identifies the image.
export function marvelImageKey(value, baseUrl) {
  const url = new URL(value, baseUrl);
  return `${url.origin}${url.pathname}`;
}

export function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Turns the detail popup's label/value pairs into card fields, e.g. "Battle Power" -> battle_power: 500.
export function detailFields(info) {
  const fields = {};
  for (const { label, value } of info) {
    const key = slugify(label).replace(/-/g, '_');
    if (!key || !value) continue;
    fields[key] = /^\d+$/.test(value) ? Number(value) : value;
  }
  return fields;
}

// Builds unique card ids from card numbers (the same number can appear more than once, e.g. alternate arts).
export function buildCardData(scrapedCards) {
  const used = new Map();
  return scrapedCards.map((card, index) => {
    const base = slugify(card.number) || `card-${String(index + 1).padStart(4, '0')}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    const { rarity, ...rest } = detailFields(card.info);
    return {
      id: count === 1 ? base : `${base}-${count}`,
      name: card.name || `Card ${index + 1}`,
      number: card.number,
      rarity: rarity ? String(rarity) : 'Base',
      ...rest,
      effect: card.effect,
    };
  });
}

// Walks every page of the card list, opens each card's detail popup, and returns the full card details.
export async function scrapeMarvelTcgCards(rawUrl = defaultUrl, onProgress = () => {}) {
  const url = parseMarvelTcgUrl(rawUrl);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    onProgress('Opening card list…');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.card-grid .card-item img', { timeout: 60000 });

    const readPage = () => page.evaluate(() => ({
      current: document.querySelector('.my-pagination .number.is-active')?.textContent.trim() || '',
      total: Number((document.querySelector('.mobile-pagination__page')?.textContent.match(/\/\s*(\d+)/) || [])[1]) || 0,
      count: document.querySelectorAll('.card-grid .card-item').length,
      firstSrc: document.querySelector('.card-grid .card-item img')?.getAttribute('src') || '',
    }));

    const readDetail = () => page.evaluate(() => {
      const root = document.querySelector('.card-detail-inner');
      if (!root) return null;
      const text = el => (el ? el.textContent.trim() : '');
      return {
        name: text(root.querySelector('.card-name')),
        number: text(root.querySelector('.card-no')),
        imageUrl: root.querySelector('.card-image img')?.getAttribute('src') || '',
        info: [...root.querySelectorAll('.other-info .info-item')].map(item => ({
          label: text(item.querySelector('.label')),
          value: text(item.querySelector('.value')),
        })),
        effect: text(root.querySelector('.effect .value')),
      };
    });

    const closeDetail = async () => {
      await page.locator('.card-detail-inner .close-icon').first().click().catch(() => {});
      try {
        await page.waitForSelector('.card-detail-inner', { state: 'detached', timeout: 3000 });
      } catch {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.card-detail-inner', { state: 'detached', timeout: 3000 }).catch(() => {});
      }
    };

    const openCard = async (index, gridSrc) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.locator('.card-grid .card-item').nth(index).click();
        try {
          await page.waitForSelector('.card-detail-inner .card-no', { timeout: 5000 });
          const detail = await readDetail();
          if (detail?.number) return detail;
        } catch { /* retry */ }
        await closeDetail();
      }
      throw new Error(`Could not open the details for card ${index + 1} (${gridSrc}).`);
    };

    const cards = [];
    let pageCount = 0;
    for (let guard = 0; guard < maxPages; guard++) {
      const data = await readPage();
      pageCount++;
      for (let i = 0; i < data.count; i++) {
        const gridSrc = await page.locator('.card-grid .card-item img').nth(i).getAttribute('src');
        const detail = await openCard(i, gridSrc);
        const imageUrl = new URL(detail.imageUrl || gridSrc, url).href;
        cards.push({ ...detail, imageUrl });
        await closeDetail();
      }
      onProgress(`Page ${data.current || pageCount}${data.total ? `/${data.total}` : ''}: ${cards.length} cards`);

      const next = page.locator('.my-pagination .btn-next').first();
      const disabled = await next.evaluate(el => /disabled/.test(el.className) || el.getAttribute('aria-disabled') === 'true').catch(() => true);
      if (disabled || (data.total && pageCount >= data.total)) break;

      let advanced = false;
      // Clicks made before the page hydrates are ignored, so retry a few times.
      for (let attempt = 0; attempt < 5 && !advanced; attempt++) {
        await next.click();
        try {
          await page.waitForFunction(
            ([src, current]) => document.querySelector('.my-pagination .number.is-active')?.textContent.trim() !== current
              && document.querySelector('.card-grid .card-item img')?.getAttribute('src') !== src,
            [data.firstSrc, data.current],
            { timeout: 6000 },
          );
          advanced = true;
        } catch { /* retry */ }
      }
      if (!advanced) throw new Error(`Could not advance past page ${data.current || pageCount}.`);
    }
    if (cards.length === 0) throw new Error('No cards were found on that page.');
    return { url: url.href, pages: pageCount, cards };
  } finally {
    await browser.close();
  }
}

// Scrapes every card, then writes set.json and the card images into outDir.
export async function downloadMarvelTcgCards(rawUrl, outDir, onProgress = () => {}) {
  const scraped = await scrapeMarvelTcgCards(rawUrl, onProgress);
  await fs.mkdir(outDir, { recursive: true });
  const cardData = buildCardData(scraped.cards);

  // Cards that share an image file download it once.
  const artwork = new Map();
  cardData.forEach((card, index) => {
    const key = marvelImageKey(scraped.cards[index].imageUrl);
    if (!artwork.has(key)) artwork.set(key, { imageUrl: scraped.cards[index].imageUrl, firstIndex: index, cardIds: [] });
    artwork.get(key).cardIds.push(card.id);
  });

  const images = [];
  const failures = [];
  const queue = [...artwork.values()];
  let done = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const response = await fetch(job.imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = (response.headers.get('content-type') || '').split(';')[0].trim();
        const ext = extensions[type] || path.extname(new URL(job.imageUrl).pathname).slice(1) || 'jpg';
        const file = `${String(job.firstIndex + 1).padStart(4, '0')}-${cardData[job.firstIndex].id}.${ext}`;
        await fs.writeFile(path.join(outDir, file), Buffer.from(await response.arrayBuffer()));
        job.cardIds.forEach(cardId => images.push({ cardId, path: file }));
      } catch (error) {
        failures.push(`${job.cardIds.join(', ')}: ${error instanceof Error ? error.message : 'Download failed'}`);
      }
      onProgress(`Downloaded ${++done}/${artwork.size} images`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const rarities = [...new Set(cardData.map(card => card.rarity))];
  const packageData = {
    schemaVersion: 1,
    game: { id: 'marvel-hero-rush', name: 'Marvel Hero Rush', providerId: 'marvelherorush' },
    set: { id: 'hr', code: 'HR', name: 'Marvel Hero Rush', company: 'Marvel' },
    card_data: cardData,
    value: cardData.map(card => ({ cardId: card.id, marketPrice: 0 })),
    ...(images.length ? { image: images.sort((a, b) => a.path.localeCompare(b.path) || a.cardId.localeCompare(b.cardId)) } : {}),
    products: [
      { id: 'booster-pack', name: 'Booster Pack', type: 'pack', cardsPerPack: 5, slots: [{ rarity: rarities, count: 5 }] },
      { id: 'booster-box', name: 'Booster Box', type: 'box', packsPerBox: 20, packProductId: 'booster-pack' },
    ],
  };
  await fs.writeFile(path.join(outDir, 'set.json'), JSON.stringify(packageData, null, 2) + '\n');
  return { url: scraped.url, pages: scraped.pages, total: cardData.length, images: artwork.size, failures, outDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [url = defaultUrl, outDir = path.join(root, 'developer-tools', 'set-packages', 'marvelherorush', 'hr')] = process.argv.slice(2);
  downloadMarvelTcgCards(url, path.resolve(outDir), message => console.log(message))
    .then(result => {
      console.log(`Saved ${result.total} cards (${result.images - result.failures.length}/${result.images} images) from ${result.pages} pages to ${result.outDir}`);
      result.failures.forEach(failure => console.error(`Image failed: ${failure}`));
      if (result.failures.length) process.exitCode = 1;
    })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
