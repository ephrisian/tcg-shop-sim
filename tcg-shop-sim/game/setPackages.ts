import { idbGetAll, idbPutSetPackage, idbUpdateSetProducts, STORE_SETS } from './database';
import type { CardData, ImportedSet, SetProduct } from './types';

interface SetPackageCard {
  id: string;
  name: string;
  rarity?: string;
  version?: string;
  type?: string;
  marketPrice?: number;
  path?: string;
  [key: string]: unknown;
}

interface SetPackage {
  schemaVersion: number;
  game: { id: string; name: string; providerId?: string };
  set: { id: string; code: string; name: string; company?: string; runSize?: number; caseSize?: number; caseHitRates?: Record<string, number> };
  card_data: SetPackageCard[];
  value?: { cardId: string; marketPrice?: number; [key: string]: unknown }[];
  image?: { cardId: string; path: string }[];
  products?: SetProduct[];
  redemptions?: {
    caseCount: number;
    packsPerCase?: number;
    tiers: { id: string; quantity: number; prizeType: 'card' | 'binder'; prizeId: string }[];
  };
  credits?: unknown;
}

interface ProductPackaging {
  schemaVersion: 1;
  packageType: 'product-packaging';
  game: { id: string; name: string; providerId?: string };
  set: { id: string; code: string; name: string };
  products: SetProduct[];
}

const imageFileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error || new Error(`Could not read image ${file.name}`));
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      reject(new Error(`Image ${file.name} did not produce a data URL.`));
      return;
    }
    resolve(reader.result);
  };
  reader.readAsDataURL(file);
});

const parsePackage = (text: string): SetPackage => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Set package is not valid JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('Set package must be a JSON object.');
  const candidate = parsed as Partial<SetPackage>;
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported set package schema version.');
  if (typeof candidate.game?.id !== 'string' || !candidate.game.id || typeof candidate.game.name !== 'string' || !candidate.game.name) {
    throw new Error('Set package must define string game.id and game.name values.');
  }
  if (candidate.game.providerId !== undefined &&
    (typeof candidate.game.providerId !== 'string' || candidate.game.providerId.trim().length === 0)) {
    throw new Error('game.providerId must be a non-empty string when provided.');
  }
  if (typeof candidate.set?.id !== 'string' || !candidate.set.id ||
    typeof candidate.set.code !== 'string' || !candidate.set.code ||
    typeof candidate.set.name !== 'string' || !candidate.set.name) {
    throw new Error('Set package must define set.id, set.code, and set.name.');
  }
  if (candidate.set.runSize !== undefined && (!Number.isInteger(candidate.set.runSize) || candidate.set.runSize <= 0)) {
    throw new Error('Set runSize must be a positive integer.');
  }
  if (!Array.isArray(candidate.card_data) || candidate.card_data.length === 0) {
    throw new Error('Set package must include a non-empty card_data array.');
  }
  if (candidate.card_data.some(card => !card || typeof card !== 'object')) throw new Error('card_data entries must be objects.');
  const cardIds = candidate.card_data.map(card => card?.id);
  if (cardIds.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new Error('Every card_data entry must have a non-empty id.');
  }
  if (new Set(cardIds).size !== cardIds.length) throw new Error('Card IDs must be unique within a set package.');
  const knownCardIds = new Set(cardIds as string[]);
  if (candidate.card_data.some(card => typeof card.name !== 'string' || card.name.length === 0)) {
    throw new Error('Every card_data entry must have a non-empty name.');
  }
  if (candidate.value && !Array.isArray(candidate.value)) throw new Error('The value section must be an array.');
  if (candidate.image && !Array.isArray(candidate.image)) throw new Error('The image section must be an array.');
  if (candidate.products && !Array.isArray(candidate.products)) throw new Error('The products section must be an array.');
  const valueIds = new Set<string>();
  for (const value of candidate.value || []) {
    if (!value || typeof value.cardId !== 'string') throw new Error('Every value entry must reference a cardId.');
    if (!knownCardIds.has(value.cardId)) throw new Error(`Value data references unknown card ${value.cardId}.`);
    if (valueIds.has(value.cardId)) throw new Error('Value data must contain at most one record per card ID.');
    valueIds.add(value.cardId);
    if (value.marketPrice !== undefined && (typeof value.marketPrice !== 'number' || !Number.isFinite(value.marketPrice) || value.marketPrice < 0)) {
      throw new Error(`Market price for card ${value.cardId} must be a non-negative number.`);
    }
  }
  const imageIds = new Set<string>();
  for (const image of candidate.image || []) {
    if (!image || typeof image.cardId !== 'string' || typeof image.path !== 'string') {
      throw new Error('Every image entry must define cardId and path.');
    }
    if (!knownCardIds.has(image.cardId)) throw new Error(`Image data references unknown card ${image.cardId}.`);
    if (imageIds.has(image.cardId)) throw new Error('Image data must contain at most one record per card ID.');
    imageIds.add(image.cardId);
  }
  for (const card of candidate.card_data) {
    if (card.marketPrice !== undefined && (typeof card.marketPrice !== 'number' || !Number.isFinite(card.marketPrice) || card.marketPrice < 0)) {
      throw new Error(`Market price for card ${card.id} must be a non-negative number.`);
    }
    if (card.path !== undefined && (typeof card.path !== 'string' || !card.path)) {
      throw new Error(`Image path for card ${card.id} must be a non-empty string.`);
    }
  }
  // Older packages kept prices and image paths in separate top-level arrays; fold them into card_data.
  const cardsById = new Map(candidate.card_data.map(card => [card.id, card]));
  for (const value of candidate.value || []) {
    const card = cardsById.get(value.cardId);
    if (card && card.marketPrice === undefined && value.marketPrice !== undefined) card.marketPrice = value.marketPrice;
  }
  for (const image of candidate.image || []) {
    const card = cardsById.get(image.cardId);
    if (card && card.path === undefined) card.path = image.path;
  }
  delete candidate.value;
  delete candidate.image;
  if (candidate.set.caseSize !== undefined && (!Number.isInteger(candidate.set.caseSize) || candidate.set.caseSize <= 0)) {
    throw new Error('Set caseSize must be a positive integer.');
  }
  for (const [rarity, rate] of Object.entries(candidate.set.caseHitRates || {})) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
      throw new Error(`Case hit rate for ${rarity} must be a non-negative number.`);
    }
  }
  const rarities = new Set(candidate.card_data.map(card => String(card.rarity || 'Common').toLowerCase()));
  const productIds = new Set<string>();
  for (const product of candidate.products || []) {
    if (!product || typeof product !== 'object' || !product.id || !product.name || !['pack', 'box'].includes(product.type)) {
      throw new Error('Every product requires an id, name, and supported pack or box type.');
    }
    if (productIds.has(product.id)) throw new Error(`Duplicate product ID: ${product.id}.`);
    productIds.add(product.id);
    if (product.image && (product.image.startsWith('/') || /^[a-z]:/i.test(product.image) ||
      product.image.replace(/\\/g, '/').split('/').includes('..'))) {
      throw new Error(`Product image paths must be relative paths within the package: ${product.image}`);
    }
    if (product.type === 'pack') {
      if (!Array.isArray(product.slots) || product.slots.length === 0) {
        throw new Error(`Pack product ${product.id} must define pack composition slots.`);
      }
      const composedCount = product.slots.reduce((sum, slot) => {
        if (!Number.isInteger(slot.count) || slot.count <= 0) {
          throw new Error(`Pack product ${product.id} has a slot with an invalid card count.`);
        }
        const slotRarities = Array.isArray(slot.rarity) ? slot.rarity : [slot.rarity];
        if (slotRarities.length === 0 || slotRarities.some(rarity => !rarities.has(rarity.toLowerCase()))) {
          throw new Error(`Pack product ${product.id} references an unknown rarity.`);
        }
        return sum + slot.count;
      }, 0);
      if (product.cardsPerPack !== undefined && product.cardsPerPack !== composedCount) {
        throw new Error(`Pack product ${product.id} cardsPerPack does not match its slot counts.`);
      }
    }
    if (product.price !== undefined && (!Number.isFinite(product.price) || product.price < 0)) {
      throw new Error(`Product ${product.id} price must be a non-negative number.`);
    }
    if (product.type === 'box' && (!Number.isInteger(product.packsPerBox) || (product.packsPerBox || 0) <= 0)) {
      throw new Error(`Box product ${product.id} must define a positive packsPerBox value.`);
    }
    if (product.runSize !== undefined && (!Number.isInteger(product.runSize) || product.runSize <= 0)) {
      throw new Error(`Product ${product.id} runSize must be a positive integer.`);
    }
  }
  if (candidate.redemptions) {
    if (typeof candidate.redemptions !== 'object' || !Array.isArray(candidate.redemptions.tiers)) {
      throw new Error('Redemptions must define a tiers array.');
    }
    const { caseCount, packsPerCase, tiers } = candidate.redemptions;
    if (!Number.isInteger(caseCount) || caseCount <= 0 || !Array.isArray(tiers)) {
      throw new Error('Redemptions must define a positive caseCount and a tiers array.');
    }
    if (packsPerCase !== undefined && (!Number.isInteger(packsPerCase) || packsPerCase <= 0)) {
      throw new Error('Redemptions packsPerCase must be a positive integer.');
    }
    if (tiers.some(tier => !tier || typeof tier !== 'object' || !tier.id || !Number.isInteger(tier.quantity) || tier.quantity < 0 ||
      !['card', 'binder'].includes(tier.prizeType) || !tier.prizeId)) {
      throw new Error('Every redemption tier must define a valid ID, quantity, and card or binder prize.');
    }
    const redemptionTotal = tiers.reduce((sum, tier) => sum + tier.quantity, 0);
    if (redemptionTotal !== caseCount) throw new Error(`Redemption tier quantities total ${redemptionTotal}; expected ${caseCount} cases.`);
    if (candidate.set.runSize !== undefined && candidate.set.runSize !== caseCount) {
      throw new Error('Redemption case count must match the set runSize.');
    }
    if (tiers.some(tier => tier.prizeType === 'card' && !cardIds.includes(tier.prizeId))) {
      throw new Error('A redemption tier references a card ID that is not in card_data.');
    }
    if (tiers.some(tier => tier.prizeType === 'binder' &&
      !['classic-25', 'portfolio-35', 'showcase-45'].includes(tier.prizeId))) {
      throw new Error('A redemption tier references an unsupported binder design.');
    }
    if (new Set(tiers.map(tier => tier.id)).size !== tiers.length) {
      throw new Error('Redemption tier IDs must be unique.');
    }
  }
  if (candidate.products && new Set(candidate.products.map(product => product?.id)).size !== candidate.products.length) {
    throw new Error('Product IDs must be unique within a set package.');
  }
  for (const product of candidate.products || []) {
    if (product.type === 'box' && product.packProductId &&
      !candidate.products?.some(pack => pack.id === product.packProductId && pack.type === 'pack')) {
      throw new Error(`Box product ${product.id} references a missing pack product.`);
    }
  }
  const knownIds = new Set(cardIds as string[]);
  for (const entry of [...(candidate.value || []), ...(candidate.image || [])]) {
    if (!knownIds.has(entry.cardId)) {
      throw new Error(`Set package references an unknown card ID: ${entry.cardId}`);
    }
  }
  if ((candidate.image || []).some(entry => {
    const path = entry.path.replace(/\\/g, '/');
    return !path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').includes('..');
  })) {
    throw new Error('Image paths must be relative paths within the set images folder.');
  }
  return candidate as SetPackage;
};

export const importSetPackage = async (
  jsonFile: File,
  imageFiles: File[],
  preloadedImageData: Record<string, string> = {},
): Promise<ImportedSet> => {
  const setPackage = parsePackage(await jsonFile.text());
  const encodedGameId = encodeURIComponent(setPackage.game.id);
  const providerId = setPackage.game.providerId || setPackage.set.company || 'default';
  const encodedProviderId = encodeURIComponent(providerId);
  const encodedSetId = encodeURIComponent(setPackage.set.id);
  const catalogSetId = `${encodedGameId}:${encodedProviderId}:${encodedSetId}`;
  const legacyCatalogSetId = `${encodedGameId}:${encodedSetId}`;
  const existingSets = await idbGetAll(STORE_SETS);
  const existingSet = existingSets.find(set =>
    set.id === catalogSetId ||
    (set.id === legacyCatalogSetId && set.gameId === setPackage.game.id &&
      set.sourceId === setPackage.set.id && set.company === setPackage.set.company));
  if (existingSet) {
    throw new Error(`${setPackage.set.name} is already imported. Imported set definitions are immutable.`);
  }
  const imagesByPath = new Map<string, File>();
  for (const file of imageFiles) {
    const relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    imagesByPath.set(relativePath, file);
    imagesByPath.set(relativePath.split('/').slice(1).join('/') || file.name, file);
    imagesByPath.set(file.name, file);
  }

  const cardImages = new Map<string, string>();
  for (const card of setPackage.card_data) {
    if (!card.path) continue;
    const imagePath = card.path.replace(/\\/g, '/');
    if (preloadedImageData[imagePath]) {
      cardImages.set(card.id, preloadedImageData[imagePath]);
    } else {
      const file = imagesByPath.get(imagePath);
      if (!file) throw new Error(`Image file is missing from import: ${card.path}`);
      cardImages.set(card.id, await imageFileToDataUrl(file));
    }
  }
  const productImages = new Map<string, string>();
  for (const product of setPackage.products || []) {
    if (!product.image) continue;
    const imagePath = product.image.replace(/\\/g, '/');
    if (preloadedImageData[imagePath]) {
      productImages.set(product.id, preloadedImageData[imagePath]);
    } else {
      const file = imagesByPath.get(imagePath);
      if (!file) throw new Error(`Product image file is missing from import: ${product.image}`);
      productImages.set(product.id, await imageFileToDataUrl(file));
    }
  }

  const cards: CardData[] = setPackage.card_data.map(card => {
    const namespacedId = `${catalogSetId}:${encodeURIComponent(card.id)}`;
    const price = typeof card.marketPrice === 'number' ? card.marketPrice : 0;
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Market price for card ${card.id} must be a non-negative number.`);
    }
    return {
      id: namespacedId,
      sourceId: card.id,
      gameId: setPackage.game.id,
      setId: catalogSetId,
      name: card.name,
      version: typeof card.version === 'string' ? card.version : '',
      rarity: typeof card.rarity === 'string' ? card.rarity : 'Common',
      marketPrice: price,
      imageUrl: cardImages.get(card.id) || '',
      type: typeof card.type === 'string' ? card.type : undefined,
      cardData: card,
    };
  });
  const set: ImportedSet = {
    id: catalogSetId,
    sourceId: setPackage.set.id,
    code: setPackage.set.code,
    name: setPackage.set.name,
    company: setPackage.set.company,
    gameId: setPackage.game.id,
    gameName: setPackage.game.name,
    providerId,
    cardCount: cards.length,
    runSize: setPackage.set.runSize,
    caseSize: setPackage.set.caseSize,
    caseHitRates: setPackage.set.caseHitRates,
    schemaVersion: setPackage.schemaVersion,
    products: (setPackage.products || []).map(product => ({
      ...product,
      imageUrl: productImages.get(product.id),
    })),
    redemptions: setPackage.redemptions || [],
    credits: setPackage.credits,
  };

  await idbPutSetPackage(set, cards);
  return set;
};

const parseProductPackaging = (text: string): ProductPackaging => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Packaging definition is not valid JSON: ${message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Packaging definition must be a JSON object.');
  }
  const data = parsed as Partial<ProductPackaging>;
  if (data.schemaVersion !== 1 || data.packageType !== 'product-packaging') {
    throw new Error('Unsupported product packaging format.');
  }
  const allowedKeys = new Set(['schemaVersion', 'packageType', 'game', 'set', 'products']);
  const unknownKeys = Object.keys(parsed).filter(key => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Product packaging cannot include set/card data: ${unknownKeys.join(', ')}.`);
  }
  if (typeof data.game?.id !== 'string' || !data.game.id ||
    typeof data.game.name !== 'string' || !data.game.name ||
    (data.game.providerId !== undefined && (typeof data.game.providerId !== 'string' || !data.game.providerId.trim())) ||
    typeof data.set?.id !== 'string' || !data.set.id ||
    typeof data.set.code !== 'string' || !data.set.code ||
    typeof data.set.name !== 'string' || !data.set.name) {
    throw new Error('Packaging definition must identify its game and set.');
  }
  if (!Array.isArray(data.products) || data.products.length === 0) {
    throw new Error('Packaging definition must include at least one product.');
  }

  const ids = new Set<string>();
  for (const product of data.products) {
    if (!product || typeof product.id !== 'string' || !product.id ||
      typeof product.name !== 'string' || !product.name || !['pack', 'box'].includes(product.type)) {
      throw new Error('Every product needs an ID, name, and pack or box type.');
    }
    if (ids.has(product.id)) throw new Error(`Duplicate product ID "${product.id}".`);
    ids.add(product.id);
    if (product.image !== undefined) {
      if (typeof product.image !== 'string' || !product.image || product.image.startsWith('/') ||
        /^[a-z]:/i.test(product.image) || product.image.replace(/\\/g, '/').split('/').includes('..')) {
        throw new Error(`Product image path must be relative and stay inside the package: ${product.image}`);
      }
    }
    if (product.price !== undefined && (!Number.isFinite(product.price) || product.price < 0)) {
      throw new Error(`Product ${product.id} price must be a non-negative number.`);
    }
    if (product.type === 'pack') {
      if (!Array.isArray(product.slots) || product.slots.length === 0 ||
        product.slots.some(slot => !slot || typeof slot !== 'object' || !Number.isInteger(slot.count) || slot.count < 1 ||
          (Array.isArray(slot.rarity)
            ? slot.rarity.length === 0 || slot.rarity.some(rarity => typeof rarity !== 'string' || !rarity)
            : typeof slot.rarity !== 'string' || !slot.rarity))) {
        throw new Error(`Pack ${product.id} needs valid composition slots.`);
      }
      if (product.cardsPerPack !== undefined &&
        product.cardsPerPack !== product.slots.reduce((sum, slot) => sum + slot.count, 0)) {
        throw new Error(`Pack ${product.id} cardsPerPack must equal its slot total.`);
      }
    }
    if (product.type === 'box' && (!Number.isInteger(product.packsPerBox) || product.packsPerBox < 1)) {
      throw new Error(`Box ${product.id} must have a positive packsPerBox.`);
    }
  }
  for (const product of data.products) {
    if (product.type === 'box' && product.packProductId &&
      !data.products.some(candidate => candidate.type === 'pack' && candidate.id === product.packProductId)) {
      throw new Error(`Box ${product.id} references an unknown pack product.`);
    }
  }
  return data as ProductPackaging;
};

export const importProductPackaging = async (
  jsonFile: File,
  imageFiles: File[],
  preloadedImageData: Record<string, string> = {},
): Promise<ImportedSet> => {
  const packaging = parseProductPackaging(await jsonFile.text());
  const sets = await idbGetAll(STORE_SETS) as ImportedSet[];
  const normalizedCode = packaging.set.code.toLocaleLowerCase();
  const matches = sets.filter(set => {
    const matchesSet = [set.sourceId, set.code, set.id].some(value => value?.toLocaleLowerCase() === normalizedCode) ||
      [set.sourceId, set.id].some(value => value === packaging.set.id);
    if (!matchesSet) return false;
    if (set.gameId && set.gameId !== packaging.game.id) return false;
    if (set.gameName && set.gameName.toLocaleLowerCase() !== packaging.game.name.toLocaleLowerCase()) return false;
    if (packaging.game.providerId && set.providerId && set.providerId !== packaging.game.providerId) return false;
    return true;
  });
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `No imported ${packaging.game.name} set matches code "${packaging.set.code}". Fetch/import that set first and check the game/set identifiers.`
      : `More than one imported set matches code "${packaging.set.code}"; packaging was not changed.`);
  }

  const imagesByPath = new Map<string, File>();
  for (const file of imageFiles) {
    const relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    imagesByPath.set(relativePath, file);
    imagesByPath.set(relativePath.split('/').slice(1).join('/') || file.name, file);
    imagesByPath.set(file.name, file);
  }
  const products = await Promise.all(packaging.products.map(async product => {
    if (!product.image) return { ...product, imageUrl: undefined };
    const imagePath = product.image.replace(/\\/g, '/');
    if (preloadedImageData[imagePath]) return { ...product, imageUrl: preloadedImageData[imagePath] };
    const image = imagesByPath.get(imagePath);
    if (!image) throw new Error(`Product image file is missing from import: ${product.image}`);
    return { ...product, imageUrl: await imageFileToDataUrl(image) };
  }));
  const matched = matches[0];
  await idbUpdateSetProducts(matched.id, products);
  return { ...matched, products };
};
