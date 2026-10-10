import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCardData, detailFields, marvelImageKey, parseMarvelTcgUrl } from '../scripts/marvel-tcg-scraper.mjs';

test('Marvel TCG image keys ignore expiring signed query parameters', () => {
  assert.equal(
    marvelImageKey('https://marvel-tcg.janime.cn/abc123?e=1&token=a'),
    marvelImageKey('https://marvel-tcg.janime.cn/abc123?e=2&token=b'),
  );
});

test('Marvel TCG URL parsing only accepts https', () => {
  assert.equal(parseMarvelTcgUrl().href, 'https://www.marvelherorush.com/en/cards');
  assert.equal(parseMarvelTcgUrl('https://example.com/en/cards').hostname, 'example.com');
  assert.throws(() => parseMarvelTcgUrl('http://www.marvelherorush.com/en/cards'), /Enter a URL/);
});

test('detail fields become snake_case keys with numeric values', () => {
  assert.deepEqual(
    detailFields([
      { label: 'Battle Power', value: '500' },
      { label: 'Color', value: 'Yellow' },
      { label: 'Empty', value: '' },
    ]),
    { battle_power: 500, color: 'Yellow' },
  );
});

test('card data uses card numbers as unique ids and keeps every detail', () => {
  const cards = buildCardData([
    { name: 'Ultron', number: 'SD02-001', effect: 'AUTO', info: [{ label: 'Rarity', value: 'MR' }, { label: 'Level', value: '6' }, { label: 'Trait', value: 'Machine' }] },
    { name: 'Ultron', number: 'SD02-001', effect: '', info: [] },
  ]);
  assert.deepEqual(cards[0], { id: 'sd02-001', name: 'Ultron', number: 'SD02-001', rarity: 'MR', level: 6, trait: 'Machine', effect: 'AUTO' });
  assert.equal(cards[1].id, 'sd02-001-2');
  assert.equal(cards[1].rarity, 'Base');
});
