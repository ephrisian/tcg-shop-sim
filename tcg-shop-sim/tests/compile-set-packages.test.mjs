import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

const tempDirectories = [];
const compilerPath = resolve('scripts/compile-set-packages.mjs');

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'tcg-compiled-catalog-'));
  tempDirectories.push(directory);
  const source = join(directory, 'source');
  const output = join(directory, 'output');
  const packageRoot = join(source, 'example', 'first-set');
  mkdirSync(join(packageRoot, 'images', 'products'), { recursive: true });
  writeFileSync(join(packageRoot, 'images', 'card.png'), 'card image');
  writeFileSync(join(packageRoot, 'images', 'products', 'pack.png'), 'pack image');
  writeFileSync(join(packageRoot, 'set.json'), JSON.stringify({
    schemaVersion: 1,
    game: { id: 'example', name: 'Example TCG' },
    set: { id: 'first', code: 'EX1', name: 'First Set', runSize: 2 },
    card_data: [{ id: 'card-1', name: 'Example Card', rarity: 'Common' }],
    image: [{ cardId: 'card-1', path: 'images/card.png' }],
    products: [{
      id: 'pack',
      name: 'Booster Pack',
      type: 'pack',
      image: 'images/products/pack.png',
      cardsPerPack: 1,
      slots: [{ rarity: 'Common', count: 1 }],
    }],
    redemptions: { caseCount: 2, tiers: [{ id: 'tier-1', quantity: 2, prizeType: 'card', prizeId: 'card-1' }] },
  }));
  return { directory, source, output, packageRoot };
};

const compile = (source, output) => spawnSync(process.execPath, [compilerPath, source, output], { encoding: 'utf8' });

afterEach(() => {
  while (tempDirectories.length > 0) rmSync(tempDirectories.pop(), { recursive: true, force: true });
});

test('compiles a validated package, referenced card/product art, and catalog manifest', () => {
  const { source, output, packageRoot } = fixture();
  const result = compile(source, output);
  assert.equal(result.status, 0, result.stderr);
  const compiledPackage = join(output, 'example', 'first-set', 'set.json');
  assert.equal(existsSync(compiledPackage), true);
  assert.equal(existsSync(join(output, 'example', 'first-set', 'images', 'card.png')), true);
  assert.equal(existsSync(join(output, 'example', 'first-set', 'images', 'products', 'pack.png')), true);
  const manifest = JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.packages, [{
    path: 'compiled-set-packages/example/first-set/set.json',
    game: 'Example TCG',
    set: 'First Set',
  }]);
  assert.equal(existsSync(packageRoot), true);
});

test('compiles packages whose art is stored as remote URLs without any image files', () => {
  const { source, output, packageRoot } = fixture();
  rmSync(join(packageRoot, 'images'), { recursive: true, force: true });
  const packagePath = join(packageRoot, 'set.json');
  const data = JSON.parse(readFileSync(packagePath, 'utf8'));
  data.image = [{ cardId: 'card-1', path: 'https://example.com/cards/1.png?e=1&token=a:b=' }];
  data.products[0].image = 'https://example.com/products/pack.png';
  writeFileSync(packagePath, JSON.stringify(data));
  const result = compile(source, output);
  assert.equal(result.status, 0, result.stderr);
  const compiled = JSON.parse(readFileSync(join(output, 'example', 'first-set', 'set.json'), 'utf8'));
  assert.equal(compiled.image[0].path, data.image[0].path);
  assert.equal(existsSync(join(output, 'example', 'first-set', 'images')), false);
});

test('writes an empty manifest when the source package folder is empty', () => {
  const { directory, output } = fixture();
  const source = join(directory, 'empty-source');
  mkdirSync(source);
  const result = compile(source, output);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8')).packages, []);
});

test('rejects invalid packages rather than compiling them', () => {
  const { source, output, packageRoot } = fixture();
  writeFileSync(join(packageRoot, 'set.json'), JSON.stringify({ schemaVersion: 1 }));
  const result = compile(source, output);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Could not compile invalid set package/);
});
