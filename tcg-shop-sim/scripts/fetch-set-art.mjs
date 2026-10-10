import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const linkOnly = args.includes('--link');
const folder = args.find(arg => !arg.startsWith('--'));
if (!folder) {
  console.error('Usage: npm run fetch:art -- <package folder containing set.json> [--link]');
  console.error('  --link  store remote image URLs in set.json instead of downloading the files');
  process.exit(1);
}

const jsonPath = path.join(folder, 'set.json');
const pkg = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
const existing = new Map([
  ...(pkg.image || []).map(entry => [entry.cardId, entry]),
  ...pkg.card_data.filter(card => card.path).map(card => [card.id, { cardId: card.id, path: card.path }]),
]);
let downloaded = 0;

for (const [index, card] of pkg.card_data.entries()) {
  if (existing.has(card.id) && !linkOnly) continue;
  const url = card.image_uris?.digital?.normal || card.image_uris?.digital?.large ||
    card.image_uris?.normal || card.image_uris?.large;
  if (!url) continue;
  if (linkOnly) {
    existing.set(card.id, { cardId: card.id, path: url });
    downloaded += 1;
    continue;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Artwork request failed (${response.status}) for ${card.id}.`);
  const type = response.headers.get('content-type') || '';
  const urlExt = new URL(url).pathname.split('.').pop().toLowerCase();
  const ext = ['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(urlExt)
    ? (urlExt === 'jpeg' ? 'jpg' : urlExt)
    : ({ 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[type] || 'jpg');
  const name = `${String(index + 1).padStart(4, '0')}-${card.id.replace(/[^a-zA-Z0-9_-]+/g, '_')}.${ext}`;
  await fs.writeFile(path.join(folder, name), Buffer.from(await response.arrayBuffer()));
  existing.set(card.id, { cardId: card.id, path: name });
  downloaded += 1;
  if (downloaded % 25 === 0) console.log(`Downloaded ${downloaded} images…`);
}

for (const card of pkg.card_data) {
  const entry = existing.get(card.id);
  if (entry) card.path = entry.path;
}
delete pkg.image;
await fs.writeFile(jsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`${linkOnly ? 'Linked' : 'Downloaded'} ${downloaded} image(s); ${existing.size} cards with image paths in ${jsonPath}.`);
