import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const [sourceArgument, outputArgument] = process.argv.slice(2);
const sourceRoot = resolve(sourceArgument || 'developer-tools/set-packages');
const outputRoot = resolve(outputArgument || 'public/compiled-set-packages');
const validatorPath = resolve('scripts/validate-set-package.mjs');
const packageFiles = [];

const collectPackages = directory => {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectPackages(path);
    else if (entry.isFile() && entry.name.endsWith('.json')) packageFiles.push(path);
  }
};

const assertInside = (root, path, label) => {
  const pathRelative = relative(root, path);
  if (pathRelative === '..' || pathRelative.startsWith(`..${sep}`) || pathRelative === '') {
    throw new Error(`${label} must be inside ${root}.`);
  }
};

collectPackages(sourceRoot);
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const packages = [];
for (const packagePath of packageFiles) {
  const packageRoot = dirname(packagePath);
  const validation = spawnSync(process.execPath, [validatorPath, packagePath, packageRoot], { encoding: 'utf8' });
  if (validation.stdout) process.stdout.write(validation.stdout);
  if (validation.stderr) process.stderr.write(validation.stderr);
  if (validation.status !== 0) {
    throw new Error(`Could not compile invalid set package ${packagePath}.`);
  }

  const sourceRelative = relative(sourceRoot, packagePath);
  const packageRelative = sourceRelative.split(/[\\/]/).join('/');
  const outputPackagePath = resolve(outputRoot, packageRelative);
  assertInside(outputRoot, outputPackagePath, 'Compiled package path');
  mkdirSync(dirname(outputPackagePath), { recursive: true });
  copyFileSync(packagePath, outputPackagePath);

  const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
  for (const image of [
    ...(packageData.image || []).map(item => item.path),
    ...(packageData.products || []).map(item => item.image).filter(Boolean),
  ]) {
    const normalizedImage = image.replace(/\\/g, '/');
    const sourceImagePath = resolve(packageRoot, normalizedImage);
    const outputImagePath = resolve(dirname(outputPackagePath), normalizedImage);
    assertInside(packageRoot, sourceImagePath, `Image "${image}"`);
    assertInside(outputRoot, outputImagePath, `Compiled image "${image}"`);
    if (!existsSync(sourceImagePath)) throw new Error(`Referenced image does not exist: ${sourceImagePath}`);
    mkdirSync(dirname(outputImagePath), { recursive: true });
    copyFileSync(sourceImagePath, outputImagePath);
  }

  packages.push({
    path: `compiled-set-packages/${packageRelative}`,
    game: packageData.game.name,
    set: packageData.set.name,
  });
}

writeFileSync(resolve(outputRoot, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  buildId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  packages,
}, null, 2)}\n`);
console.log(`Compiled ${packages.length} set package(s) into ${outputRoot}.`);
