import { idbGetAll } from './database';
import { importProductPackaging, importSetPackage } from './setPackages';
import { STORE_SETS } from './database';

interface CompiledPackageManifest {
  schemaVersion: number;
  buildId: string;
  packages: { path: string }[];
}

const responseFile = async (response: Response, name: string): Promise<File> =>
  new File([await response.blob()], name, { type: response.headers.get('content-type') || 'application/octet-stream' });

export const loadCompiledPackageManifest = async (): Promise<CompiledPackageManifest> => {
  const manifestUrl = new URL('compiled-set-packages/manifest.json', document.baseURI);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Could not load compiled set catalog (${manifestResponse.status}). Rebuild the application to generate it.`);
  }
  const manifest = await manifestResponse.json() as CompiledPackageManifest;
  if (manifest.schemaVersion !== 1 || typeof manifest.buildId !== 'string' || !manifest.buildId ||
    !Array.isArray(manifest.packages)) {
    throw new Error('Compiled set catalog manifest is invalid.');
  }
  return manifest;
};

let installQueue: Promise<unknown> = Promise.resolve();

// Serialized so concurrent callers (e.g. StrictMode double effects) can't race the import check.
export const installCompiledSetPackages = (
  suppliedManifest?: CompiledPackageManifest,
  onProgress?: (done: number, total: number) => void,
): Promise<void> => {
  const run = installQueue.then(() => installCompiledSetPackagesUnsafe(suppliedManifest, onProgress));
  installQueue = run.catch(() => undefined);
  return run;
};

const installCompiledSetPackagesUnsafe = async (
  suppliedManifest?: CompiledPackageManifest,
  onProgress?: (done: number, total: number) => void,
): Promise<void> => {
  const manifest = suppliedManifest || await loadCompiledPackageManifest();
  const existingSets = await idbGetAll(STORE_SETS);
  const existingSetIds = new Set(existingSets.map(set => set.id));

  for (const [index, entry] of manifest.packages.entries()) {
    onProgress?.(index, manifest.packages.length);
    if (!entry || typeof entry.path !== 'string' || entry.path.startsWith('/') ||
      entry.path.split(/[\\/]/).includes('..')) {
      throw new Error('Compiled set catalog contains an invalid package path.');
    }
    const packageUrl = new URL(entry.path, document.baseURI);
    const response = await fetch(packageUrl);
    if (!response.ok) throw new Error(`Could not load compiled set package ${entry.path} (${response.status}).`);
    const packageFile = await responseFile(response, 'set.json');
    const packageData = JSON.parse(await packageFile.text()) as {
      game: { id: string; providerId?: string };
      set: { id: string; company?: string };
      image?: { path: string }[];
      card_data?: { path?: string }[];
      products?: { image?: string }[];
    };
    const providerId = packageData.game.providerId || packageData.set.company || 'default';
    const setId = `${encodeURIComponent(packageData.game.id)}:${encodeURIComponent(providerId)}:${encodeURIComponent(packageData.set.id)}`;
    const legacySetId = `${encodeURIComponent(packageData.game.id)}:${encodeURIComponent(packageData.set.id)}`;
    const alreadyInstalled = existingSetIds.has(setId) || existingSets.some(set =>
      set.id === legacySetId && set.gameId === packageData.game.id &&
      set.sourceId === packageData.set.id && set.company === packageData.set.company);
    const imageReferences = [
      ...(alreadyInstalled ? [] : [
        ...(packageData.card_data || []).map(card => card.path),
        ...(packageData.image || []).map(image => image.path),
      ].filter((path): path is string => typeof path === 'string' && path.length > 0)),
      ...(packageData.products || []).map(product => product.image).filter((path): path is string => Boolean(path)),
    ];
    const imageData: Record<string, string> = {};
    for (const imagePath of imageReferences) {
      if (/^https:\/\//i.test(imagePath)) {
        imageData[imagePath] = imagePath;
        continue;
      }
      if (imagePath.startsWith('/') || imagePath.split(/[\\/]/).includes('..')) {
        throw new Error(`Compiled set ${entry.path} references an unsafe image path: ${imagePath}`);
      }
      const imageUrl = new URL(imagePath.replace(/\\/g, '/'), packageUrl);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Could not load compiled image ${imagePath} for ${entry.path} (${imageResponse.status}).`);
      }
      const imageFile = await responseFile(imageResponse, imagePath.split(/[\\/]/).pop() || 'image');
      imageData[imagePath.replace(/\\/g, '/')] = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error(`Could not read compiled image ${imagePath}.`));
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error(`Compiled image ${imagePath} did not produce a data URL.`));
        reader.readAsDataURL(imageFile);
      });
    }
    if (alreadyInstalled) {
      if (!packageData.products?.length) continue;
      const packagingFile = new File([JSON.stringify({
        schemaVersion: 1,
        packageType: 'product-packaging',
        game: packageData.game,
        set: packageData.set,
        products: packageData.products || [],
      })], 'product-packaging.json', { type: 'application/json' });
      await importProductPackaging(packagingFile, [], imageData);
      continue;
    }
    await importSetPackage(packageFile, [], imageData);
    existingSetIds.add(setId);
  }
  onProgress?.(manifest.packages.length, manifest.packages.length);
};
