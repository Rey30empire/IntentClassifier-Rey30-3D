import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const assetsRoot = path.join(repoRoot, 'assets');
const legacyRoot = path.join(assetsRoot, 'Modelos_3D_Comentados_Lexury');

const directoryMappings = [
  { source: '00_DOCUMENTACION', destination: 'documentacion', mode: 'rename' },
  { source: '01_Personajes', destination: 'personajes', mode: 'merge' },
  { source: '02_Entornos', destination: 'entornos', mode: 'merge' },
  { source: '03_Props', destination: 'props', mode: 'merge' },
  { source: '04_Animaciones', destination: 'animaciones', mode: 'merge' },
  { source: '05_Escenas_ThreeJS', destination: 'escenas_threejs', mode: 'rename' },
  { source: '99_Por_Clasificar', destination: 'por_clasificar', mode: 'rename' },
  { source: 'tools', destination: 'tools', mode: 'rename' },
];

const pathReplacements = [
  ['01_Personajes/', 'personajes/'],
  ['02_Entornos/', 'entornos/'],
  ['03_Props/', 'props/'],
  ['04_Animaciones/', 'animaciones/'],
  ['05_Escenas_ThreeJS/', 'escenas_threejs/'],
  ['99_Por_Clasificar/', 'por_clasificar/'],
  ['01_Personajes', 'personajes'],
  ['02_Entornos', 'entornos'],
  ['03_Props', 'props'],
  ['04_Animaciones', 'animaciones'],
  ['05_Escenas_ThreeJS', 'escenas_threejs'],
  ['99_Por_Clasificar', 'por_clasificar'],
];

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function removePlaceholder(targetPath) {
  const placeholderPath = path.join(targetPath, '.gitkeep');
  if (exists(placeholderPath)) {
    fs.unlinkSync(placeholderPath);
  }
}

function moveChildren(sourceDir, destinationDir) {
  ensureDir(destinationDir);
  removePlaceholder(destinationDir);

  const entries = fs.readdirSync(sourceDir);
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const destinationPath = path.join(destinationDir, entry);

    if (exists(destinationPath)) {
      throw new Error(`No se puede mover "${sourcePath}" porque ya existe "${destinationPath}"`);
    }

    fs.renameSync(sourcePath, destinationPath);
  }

  fs.rmdirSync(sourceDir);
}

function renameDirectory(sourceDir, destinationDir) {
  if (exists(destinationDir)) {
    throw new Error(`No se puede renombrar "${sourceDir}" a "${destinationDir}" porque el destino ya existe`);
  }

  fs.renameSync(sourceDir, destinationDir);
}

function replaceTextContent(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!['.json', '.md', '.csv'].includes(extension)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of pathReplacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function walkFiles(rootDir) {
  const results = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

if (!exists(legacyRoot)) {
  console.log('No se encontro la carpeta legacy de Lexury. Nada que organizar.');
  process.exit(0);
}

console.log(`Organizando biblioteca Lexury desde ${legacyRoot}`);

for (const mapping of directoryMappings) {
  const sourceDir = path.join(legacyRoot, mapping.source);
  const destinationDir = path.join(assetsRoot, mapping.destination);

  if (!exists(sourceDir)) {
    console.log(`- Omitido ${mapping.source}: no existe`);
    continue;
  }

  if (mapping.mode === 'merge') {
    moveChildren(sourceDir, destinationDir);
  } else {
    renameDirectory(sourceDir, destinationDir);
  }

  console.log(`- ${mapping.source} -> assets/${mapping.destination}`);
}

const remainingEntries = fs.readdirSync(legacyRoot);
if (remainingEntries.length === 0) {
  fs.rmdirSync(legacyRoot);
  console.log('- Carpeta legacy vacia eliminada');
}

const documentationDir = path.join(assetsRoot, 'documentacion');
if (exists(documentationDir)) {
  const documentationFiles = walkFiles(documentationDir);
  for (const filePath of documentationFiles) {
    replaceTextContent(filePath);
  }

  const canonicalRegistry = path.join(documentationDir, 'REGISTRO_MOTOR.json');
  if (exists(canonicalRegistry)) {
    fs.copyFileSync(canonicalRegistry, path.join(assetsRoot, 'registro_motor.json'));
    console.log('- assets/registro_motor.json actualizado con el registro canonico');
  }
}

console.log('Organizacion completada.');
