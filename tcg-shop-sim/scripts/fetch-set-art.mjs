import fs from 'node:fs/promises';
import path from 'node:path';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: npm run fetch:art -- <package folder containing set.json>');
  process.exit(1);
}

const jsonPath = path.join(folder, 'set.json');
const pkg = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
const existing = new Map((pkg.image || []).map(entry => [entry.cardId, entry]));
let downloaded = 0;

for (const [index, card] of pkg.card_data.entries()) {
  if (existing.has(card.id)) continue;
  const url = card.image_uris?.digital?.normal || card.image_uris?.digital?.large ||
    card.image_uris?.normal || card.image_uris?.large;
  if (!url) continue;
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

pkg.image = [...existing.values()];
await fs.writeFile(jsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Downloaded ${downloaded} image(s); ${pkg.image.length} total image records in ${jsonPath}.`);
