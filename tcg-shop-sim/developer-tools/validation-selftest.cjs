const assert = require('node:assert');
const fs = require('node:fs');
const mod = { exports: {} };
new Function('module', fs.readFileSync(__dirname + '/set-package-validation.js', 'utf8'))(mod);
const { validatePackage, validatePackaging } = mod.exports;
const good = {
  schemaVersion: 1, game: { id: 'g', name: 'G' }, set: { id: 's', code: 'S1', name: 'S', runSize: 2 },
  card_data: [{ id: 'a', name: 'A', rarity: 'Common' }],
  value: [{ cardId: 'a', marketPrice: 1 }], image: [{ cardId: 'a', path: 'images/a.png' }],
  products: [{ id: 'p', name: 'P', type: 'pack', cardsPerPack: 1, slots: [{ rarity: 'Common', count: 1 }] }, { id: 'b', name: 'B', type: 'box', packsPerBox: 2, packProductId: 'p' }],
  redemptions: { caseCount: 2, tiers: [{ id: 't', quantity: 2, prizeType: 'card', prizeId: 'a' }] }, credits: { companies: ['X'] }
};
assert.deepStrictEqual(validatePackage(good).errors, []);
const bad = JSON.parse(JSON.stringify(good));
bad.image[0].path = '../x.png'; bad.value.push({ cardId: 'zz' }); bad.products[0].cardsPerPack = 3; bad.redemptions.tiers[0].quantity = 1;
const e = validatePackage(bad).errors.join('\n');
for (const s of ['Image path', 'unknown card zz', 'slot total', 'total 1']) assert.ok(e.includes(s), s);
assert.ok(validatePackage(bad).errors.length >= 4);
const packaging = {
  schemaVersion: 1,
  packageType: 'product-packaging',
  game: { id: 'lorcana', name: 'Disney Lorcana' },
  set: { id: '1st', code: '1st', name: 'The First Chapter' },
  products: [
    { id: 'pack', name: 'Booster Pack', type: 'pack', image: 'images/products/pack.png', cardsPerPack: 1, slots: [{ rarity: 'Common', count: 1 }] },
    { id: 'box', name: 'Booster Box', type: 'box', image: 'images/products/box.png', packsPerBox: 24, packProductId: 'pack' }
  ]
};
assert.deepStrictEqual(validatePackaging(packaging).errors, []);
const withCardData = { ...packaging, card_data: [{ id: 'card', name: 'Card' }] };
assert.ok(validatePackaging(withCardData).errors.some(error => /Unknown top-level property: card_data/.test(error)));
console.log('validation self-test passed');

