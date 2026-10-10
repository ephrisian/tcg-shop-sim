import assert from 'node:assert/strict';
import test from 'node:test';
import { cardFunImageKey, parseCardFunUrl } from '../scripts/cardfun-scraper.mjs';

test('Card.fun image keys ignore expiring signed query parameters', () => {
  const first = cardFunImageKey('https://goodso.card.fun/cards/example.webp?signature=first');
  const second = cardFunImageKey('https://goodso.card.fun/cards/example.webp?signature=second');

  assert.equal(first, second);
});

test('Card.fun image keys resolve relative image URLs', () => {
  assert.equal(
    cardFunImageKey('/cards/example.webp?signature=current', 'https://card.fun/products/301'),
    'https://card.fun/cards/example.webp',
  );
});

test('Card.fun product URLs require a numeric product ID', () => {
  assert.equal(parseCardFunUrl('https://card.fun/products/301?source=importer').href, 'https://card.fun/products/301');
  assert.throws(() => parseCardFunUrl('https://card.fun/products/not-a-number'), /products/);
});
