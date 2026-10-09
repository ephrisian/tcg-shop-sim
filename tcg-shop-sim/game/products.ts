import { GAME_CONFIG } from './config';
import type { ImportedSet, SetProduct } from './types';

const defaultProducts: SetProduct[] = [
  { id: 'default-pack', name: 'Booster Pack', type: 'pack', price: GAME_CONFIG.economy.retailPrices.pack },
  { id: 'default-box', name: 'Booster Box', type: 'box', price: GAME_CONFIG.economy.retailPrices.box, packsPerBox: GAME_CONFIG.packConfiguration.packsPerBox, packProductId: 'default-pack' },
];

export const productsForSet = (set: ImportedSet | undefined): SetProduct[] => set?.products?.length
  ? set.products
  : defaultProducts;

export const packProductFor = (set: ImportedSet | undefined, productId?: string): SetProduct => {
  const packProducts = productsForSet(set).filter(product => product.type === 'pack');
  const product = packProducts.find(item => item.id === productId) || packProducts[0];
  if (product) return product;
  return defaultProducts[0];
};

export const boxPackProductFor = (set: ImportedSet | undefined, box: SetProduct): SetProduct => {
  return packProductFor(set, box.packProductId);
};
