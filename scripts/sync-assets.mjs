import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceRoot = path.join(repoRoot, 'assets');
const publicRoot = path.join(repoRoot, 'public', 'assets');
const registryFile = 'registro_motor.json';
const runtimeFolders = ['personajes', 'entornos', 'props', 'animaciones'];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfPresent(sourceFile, destinationFile) {
  if (!fs.existsSync(sourceFile)) {
    return false;
  }

  ensureDir(path.dirname(destinationFile));
  fs.copyFileSync(sourceFile, destinationFile);
  return true;
}

function removeDirectoryIfPresent(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function copyRuntimeAsset(assetRecord) {
  if (!assetRecord.runtime_ready || !assetRecord.preferred_runtime_entry) {
    return false;
  }

  const relativeEntry = assetRecord.preferred_runtime_entry.replaceAll('/', path.sep);
  const sourceFile = path.join(sourceRoot, relativeEntry);
  const destinationFile = path.join(publicRoot, relativeEntry);

  if (!fs.existsSync(sourceFile)) {
    console.warn(`- Aviso: no se encontro ${assetRecord.preferred_runtime_entry}`);
    return false;
  }

  ensureDir(path.dirname(destinationFile));
  fs.copyFileSync(sourceFile, destinationFile);
  return true;
}

ensureDir(sourceRoot);
ensureDir(publicRoot);

console.log('Sincronizando biblioteca de assets...');
console.log(`Origen: ${sourceRoot}`);
console.log(`Destino web: ${publicRoot}`);

for (const folder of runtimeFolders) {
  removeDirectoryIfPresent(path.join(publicRoot, folder));
  ensureDir(path.join(publicRoot, folder));
}

const registrySourcePath = path.join(sourceRoot, registryFile);
if (!fs.existsSync(registrySourcePath)) {
  throw new Error(`No existe ${registrySourcePath}`);
}

const registry = JSON.parse(fs.readFileSync(registrySourcePath, 'utf8'));
let copiedAssets = 0;

for (const assetRecord of registry.assets ?? []) {
  if (copyRuntimeAsset(assetRecord)) {
    copiedAssets += 1;
  }
}

const registryCopied = copyFileIfPresent(registrySourcePath, path.join(publicRoot, registryFile));

console.log(
  registryCopied
    ? `- ${registryFile}: sincronizado`
    : `- ${registryFile}: no existe en assets/, omitido`
);
console.log(`- runtime assets publicados: ${copiedAssets}`);

console.log('Sincronizacion completada.');
