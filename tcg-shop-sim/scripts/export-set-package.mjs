import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const [packageArgument, outputArgument, imageRootArgument] = process.argv.slice(2);
if (!packageArgument || !outputArgument) {
  console.error('Usage: npm run export:set -- <set-package.json> <output-folder> [image-folder]');
  process.exit(2);
}

const packagePath = resolve(packageArgument);
const outputRoot = resolve(outputArgument);
const imageRoot = resolve(imageRootArgument || dirname(packagePath));
const validation = spawnSync(process.execPath, [resolve('scripts/validate-set-package.mjs'), packagePath, imageRoot], { encoding: 'utf8' });
if (validation.stdout) process.stdout.write(validation.stdout);
if (validation.stderr) process.stderr.write(validation.stderr);
if (validation.status !== 0) process.exit(validation.status || 1);

const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
const imageReferences = [
  ...(packageData.image || []).map(image => ({ path: image.path, description: `card image ${image.cardId}` })),
  ...(packageData.products || []).filter(product => product.image).map(product => ({ path: product.image, description: `product image ${product.id}` })),
];
for (const image of imageReferences) {
  const normalizedPath = image.path.replace(/\\/g, '/');
  if (!normalizedPath || isAbsolute(normalizedPath) || normalizedPath.split('/').includes('..')) {
    console.error(`Refusing to export ${image.description} path outside the package: ${image.path}`);
    process.exit(1);
  }
  const sourcePath = resolve(imageRoot, normalizedPath);
  const sourceRelative = relative(imageRoot, sourcePath);
  if (sourceRelative === '..' || sourceRelative.startsWith(`..${sep}`)) {
    console.error(`Refusing to export ${image.description} path outside the source folder: ${image.path}`);
    process.exit(1);
  }
  const destinationPath = resolve(outputRoot, normalizedPath);
  const destinationRelative = relative(outputRoot, destinationPath);
  if (destinationRelative === '..' || destinationRelative.startsWith(`..${sep}`)) {
    console.error(`Refusing to write ${image.description} outside the package export folder: ${image.path}`);
    process.exit(1);
  }
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}

mkdirSync(outputRoot, { recursive: true });
copyFileSync(packagePath, resolve(outputRoot, 'set.json'));
console.log(`Exported set JSON and ${imageReferences.length} image reference(s) to ${outputRoot}`);
