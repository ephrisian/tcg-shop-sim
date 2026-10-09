import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
const packagePath = process.argv[2];
if (!packagePath) {
  console.error('Usage: npm run validate:set -- <set-package.json> [image-folder]');
  process.exit(2);
}

const resolvedPackagePath = resolve(packagePath);
let data;
try {
  data = JSON.parse(readFileSync(resolvedPackagePath, 'utf8'));
} catch (error) {
  console.error(`Cannot read set package JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
if (!data || typeof data !== 'object' || Array.isArray(data)) {
  console.error('Set package must be a JSON object.');
  process.exit(1);
}
if (data.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
if (!data.game?.id || !data.game?.name) errors.push('game.id and game.name are required.');
if (data.game?.providerId !== undefined && (typeof data.game.providerId !== 'string' || !data.game.providerId.trim())) {
  errors.push('game.providerId must be a non-empty string when provided.');
}
if (!data.set?.id || !data.set?.code || !data.set?.name) errors.push('set.id, set.code, and set.name are required.');
if (data.set?.runSize !== undefined && (!Number.isInteger(data.set.runSize) || data.set.runSize < 1)) {
  errors.push('set.runSize must be a positive integer.');
}
if (!Array.isArray(data.card_data) || data.card_data.length === 0) errors.push('card_data must contain at least one card.');
for (const section of ['value', 'image', 'products']) {
  if (data[section] !== undefined && !Array.isArray(data[section])) errors.push(`${section} must be an array when provided.`);
}
if (data.redemptions !== undefined && (!data.redemptions || typeof data.redemptions !== 'object' || Array.isArray(data.redemptions))) {
  errors.push('redemptions must be an object when provided.');
}
if (data.credits !== undefined && (!data.credits || typeof data.credits !== 'object')) {
  errors.push('credits must be an object or array.');
}
const allowedProperties = ['schemaVersion', 'game', 'set', 'card_data', 'value', 'image', 'products', 'redemptions', 'credits'];
for (const property of Object.keys(data)) {
  if (!allowedProperties.includes(property)) errors.push(`Unknown top-level property: ${property}`);
}

const cardIds = new Set();
for (const card of Array.isArray(data.card_data) ? data.card_data : []) {
  if (!card?.id || !card?.name) errors.push('Each card_data entry needs an id and name.');
  else if (cardIds.has(card.id)) errors.push(`Duplicate card ID: ${card.id}`);
  else cardIds.add(card.id);
}

const valueIds = new Set();
for (const value of Array.isArray(data.value) ? data.value : []) {
  if (!value || typeof value !== 'object') {
    errors.push('Every value record must be an object.');
    continue;
  }
  if (!cardIds.has(value.cardId)) errors.push(`Value data references unknown card ${value.cardId}.`);
  if (valueIds.has(value.cardId)) errors.push(`Duplicate value record for card ${value.cardId}.`);
  valueIds.add(value.cardId);
  if (value.marketPrice !== undefined && (!Number.isFinite(value.marketPrice) || value.marketPrice < 0)) {
    errors.push(`Invalid marketPrice for ${value.cardId}.`);
  }
}

const imageRoot = process.argv[3] ? resolve(process.argv[3]) : dirname(resolvedPackagePath);
const imageIds = new Set();
for (const image of Array.isArray(data.image) ? data.image : []) {
  if (!image || typeof image !== 'object') {
    errors.push('Every image record must be an object.');
    continue;
  }
  if (!cardIds.has(image.cardId)) errors.push(`Image data references unknown card ${image.cardId}.`);
  if (imageIds.has(image.cardId)) errors.push(`Duplicate image record for card ${image.cardId}.`);
  imageIds.add(image.cardId);
  if (typeof image.path !== 'string' || !image.path || isAbsolute(image.path) || image.path.split(/[\\/]/).includes('..')) {
    errors.push(`Image path must be relative and stay inside its image folder: ${image.path}`);
  } else if (!existsSync(resolve(imageRoot, image.path))) {
    errors.push(`Referenced image does not exist: ${image.path}`);
  }
}

const rarities = new Set((Array.isArray(data.card_data) ? data.card_data : []).map(card => String(card?.rarity || 'Common').toLowerCase()));
const productIds = new Set();
const products = Array.isArray(data.products) ? data.products : [];
for (const product of products) {
  if (!product || typeof product !== 'object') {
    errors.push('Every product must be an object.');
    continue;
  }
  if (!product?.id || !product?.name || !['pack', 'box'].includes(product.type)) errors.push('Each product needs an id, name, and pack/box type.');
  if (product.image !== undefined && (typeof product.image !== 'string' || !product.image || isAbsolute(product.image) || product.image.split(/[\\/]/).includes('..'))) {
    errors.push(`Product image path must be relative and stay inside its image folder: ${product.image}`);
  } else if (product.image && !existsSync(resolve(imageRoot, product.image))) {
    errors.push(`Referenced product image does not exist: ${product.image}`);
  }
  if (productIds.has(product.id)) errors.push(`Duplicate product ID: ${product.id}`);
  productIds.add(product.id);
  if (product.type === 'pack') {
    if (!Array.isArray(product.slots) || product.slots.length === 0) errors.push(`Pack ${product.id} must define slots.`);
    const cardTotal = (Array.isArray(product.slots) ? product.slots : []).reduce((sum, slot) => {
      if (!slot || typeof slot !== 'object') {
        errors.push(`Pack ${product.id} has an invalid slot.`);
        return sum;
      }
      const slotRarities = Array.isArray(slot.rarity) ? slot.rarity : [slot.rarity];
      if (!Number.isInteger(slot.count) || slot.count < 1) errors.push(`Pack ${product.id} has an invalid slot count.`);
      if (slotRarities.some(rarity => !rarities.has(String(rarity).toLowerCase()))) errors.push(`Pack ${product.id} uses a rarity absent from card_data.`);
      return sum + (Number.isInteger(slot.count) ? slot.count : 0);
    }, 0);
    if (product.cardsPerPack !== undefined && product.cardsPerPack !== cardTotal) errors.push(`Pack ${product.id} cardsPerPack does not equal its slot total.`);
  }
  if (product.type === 'box' && (!Number.isInteger(product.packsPerBox) || product.packsPerBox < 1)) errors.push(`Box ${product.id} must have a positive packsPerBox.`);
}
for (const product of products) {
  if (!product || typeof product !== 'object') continue;
  if (product.type === 'box' && product.packProductId &&
    !products.some(candidate => candidate?.id === product.packProductId && candidate?.type === 'pack')) {
    errors.push(`Box ${product.id} references an unknown pack product.`);
  }
}

if (data.redemptions) {
  const { caseCount, packsPerCase, tiers } = data.redemptions;
  if (!Number.isInteger(caseCount) || caseCount < 1 || !Array.isArray(tiers)) errors.push('redemptions needs positive caseCount and tiers.');
  if (packsPerCase !== undefined && (!Number.isInteger(packsPerCase) || packsPerCase < 1)) {
    errors.push('redemptions packsPerCase must be a positive integer.');
  }
  const tierIds = new Set();
  const tierTotal = (Array.isArray(tiers) ? tiers : []).reduce((sum, tier) => {
    if (!tier || typeof tier !== 'object') {
      errors.push('Each redemption tier must be an object.');
      return sum;
    }
    if (!tier.id || !Number.isInteger(tier.quantity) || tier.quantity < 0) errors.push('Each redemption tier needs an ID and non-negative integer quantity.');
    if (tierIds.has(tier.id)) errors.push(`Duplicate redemption tier ID: ${tier.id}.`);
    tierIds.add(tier.id);
    if (!['card', 'binder'].includes(tier.prizeType) || !tier.prizeId) errors.push(`Invalid prize definition for redemption tier ${tier.id}.`);
    if (tier.prizeType === 'card' && !cardIds.has(tier.prizeId)) errors.push(`Unknown redemption prize card ${tier.prizeId}.`);
    if (tier.prizeType === 'binder' && !['classic-25', 'portfolio-35', 'showcase-45'].includes(tier.prizeId)) {
      errors.push(`Unknown redemption prize binder ${tier.prizeId}.`);
    }
    return sum + (Number.isInteger(tier.quantity) ? tier.quantity : 0);
  }, 0);
  if (tierTotal !== caseCount) errors.push(`Redemption quantities total ${tierTotal}, not caseCount ${caseCount}.`);
  if (data.set?.runSize !== undefined && caseCount !== data.set.runSize) errors.push('Redemption caseCount must match set.runSize.');
}

if (errors.length > 0) {
  console.error(`Set package invalid (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Set package valid: ${data.game.name} / ${data.set.name} (${data.card_data.length} cards).`);
