import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

const tempDirectories = [];
const validatorPath = resolve('scripts/validate-set-package.mjs');
const exporterPath = resolve('scripts/export-set-package.mjs');

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'tcg-set-package-'));
  tempDirectories.push(directory);
  mkdirSync(join(directory, 'images'));
  mkdirSync(join(directory, 'images', 'products'));
  writeFileSync(join(directory, 'images', 'card.png'), 'test image');
  writeFileSync(join(directory, 'images', 'products', 'pack.png'), 'pack image');
  const data = {
    schemaVersion: 1,
    game: { id: 'example', name: 'Example TCG' },
    set: { id: 'first', code: 'EX1', name: 'First Set', runSize: 2 },
    card_data: [{ id: 'card-1', name: 'Example Card', rarity: 'Common' }],
    value: [{ cardId: 'card-1', marketPrice: 1.25 }],
    image: [{ cardId: 'card-1', path: 'images/card.png' }],
    products: [{ id: 'pack', name: 'Booster Pack', type: 'pack', image: 'images/products/pack.png', cardsPerPack: 1, slots: [{ rarity: 'Common', count: 1 }] }],
    redemptions: { caseCount: 2, packsPerCase: 144, tiers: [{ id: 'tier-1', quantity: 2, prizeType: 'card', prizeId: 'card-1' }] },
    credits: { companies: ['Example'] },
  };
  const jsonPath = join(directory, 'set.json');
  writeFileSync(jsonPath, JSON.stringify(data));
  return { directory, data, jsonPath };
};

const validate = (_directory, jsonPath) => spawnSync(process.execPath, [validatorPath, jsonPath], { encoding: 'utf8' });

afterEach(() => {
  while (tempDirectories.length > 0) rmSync(tempDirectories.pop(), { recursive: true, force: true });
});

test('accepts a valid package with products, artwork, attribution, and complete redemption tiers', () => {
  const { directory, jsonPath } = fixture();
  const result = validate(directory, jsonPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Set package valid/);
});

test('rejects duplicate card identities', () => {
  const { directory, data, jsonPath } = fixture();
  data.card_data.push({ ...data.card_data[0] });
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(directory, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate card ID/);
});

test('rejects duplicate product identities and boxes with unknown pack references', () => {
  const { data, jsonPath } = fixture();
  data.products.push({ ...data.products[0] });
  data.products.push({ id: 'box', name: 'Booster Box', type: 'box', packsPerBox: 24, packProductId: 'missing-pack' });
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(null, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate product ID/);
  assert.match(result.stderr, /references an unknown pack product/);
});

test('rejects value and image references to unknown cards', () => {
  const { data, jsonPath } = fixture();
  data.value.push({ cardId: 'missing-card', marketPrice: 2 });
  data.image.push({ cardId: 'missing-card', path: 'images/card.png' });
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(null, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Value data references unknown card/);
  assert.match(result.stderr, /Image data references unknown card/);
});

test('rejects missing referenced images', () => {
  const { directory, data, jsonPath } = fixture();
  data.image[0].path = 'images/missing.png';
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(directory, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Referenced image does not exist/);
});

test('rejects missing product artwork independently of immutable card artwork', () => {
  const { data, jsonPath } = fixture();
  data.products[0].image = 'images/products/missing.png';
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(null, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Referenced product image does not exist/);
});

test('rejects redemption tier totals that do not match the case count', () => {
  const { directory, data, jsonPath } = fixture();
  data.redemptions.tiers[0].quantity = 1;
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(directory, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Redemption quantities total 1, not caseCount 2/);
});

test('rejects invalid per-set redemption frequency', () => {
  const { data, jsonPath } = fixture();
  data.redemptions.packsPerCase = 0;
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(null, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /packsPerCase must be a positive integer/);
});

test('rejects invalid run size, credits, and unknown top-level properties', () => {
  const { data, jsonPath } = fixture();
  data.set.runSize = 0;
  data.credits = null;
  data.unrecognized = true;
  writeFileSync(jsonPath, JSON.stringify(data));
  const result = validate(null, jsonPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /set\.runSize must be a positive integer/);
  assert.match(result.stderr, /credits must be an object or array/);
  assert.match(result.stderr, /Unknown top-level property: unrecognized/);
});

test('exports only the validated JSON package and referenced art', () => {
  const { directory, jsonPath } = fixture();
  const output = join(directory, 'export');
  const result = spawnSync(process.execPath, [exporterPath, jsonPath, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(output, 'set.json')), true);
  assert.equal(readFileSync(join(output, 'images', 'card.png'), 'utf8'), 'test image');
  assert.equal(readFileSync(join(output, 'images', 'products', 'pack.png'), 'utf8'), 'pack image');
});
