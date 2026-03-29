const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, '00_DOCUMENTACION');
const SCENES_ROOT = path.join(ROOT_DIR, '05_Escenas_ThreeJS');
const ASSET_MANIFEST_NAME = 'asset_manifest.json';
const SCENE_MANIFEST_NAME = 'scene_manifest.json';
const IGNORED_DIRS = new Set(['.git', 'node_modules']);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function relFromRoot(fullPath) {
  return toPosix(path.relative(ROOT_DIR, fullPath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escapeCell = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const text = Array.isArray(value) ? value.join(' | ') : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ];

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function walkDirectories(startPath, onDirectory) {
  if (!fs.existsSync(startPath)) {
    return;
  }

  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(startPath, entry.name);
    onDirectory(fullPath);
    walkDirectories(fullPath, onDirectory);
  }
}

function findFilesByName(startPath, fileName) {
  const matches = [];

  walkDirectories(startPath, (dirPath) => {
    const candidate = path.join(dirPath, fileName);
    if (fs.existsSync(candidate)) {
      matches.push(candidate);
    }
  });

  return matches;
}

function firstExistingFile(sceneDir, names) {
  for (const name of names) {
    const fullPath = path.join(sceneDir, name);
    if (fs.existsSync(fullPath)) {
      return relFromRoot(fullPath);
    }
  }
  return null;
}

function listFiles(sceneDir, extensions) {
  const results = [];

  walkDirectories(sceneDir, (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        results.push(path.join(dirPath, entry.name));
      }
    }
  });

  for (const entry of fs.readdirSync(sceneDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (extensions.has(ext)) {
      results.push(path.join(sceneDir, entry.name));
    }
  }

  return Array.from(new Set(results)).sort();
}

function sceneTitleFromReadme(sceneDir, fallback) {
  const readmePath = path.join(sceneDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return fallback;
  }

  const firstLine = fs.readFileSync(readmePath, 'utf8').split(/\r?\n/).find(Boolean);
  if (!firstLine) {
    return fallback;
  }

  return firstLine.replace(/^#\s*/, '').trim() || fallback;
}

function detectRuntime(sceneDir, packageJson) {
  const packageText = packageJson ? JSON.stringify(packageJson).toLowerCase() : '';
  if (packageText.includes('three')) {
    return 'threejs';
  }

  const codeFiles = listFiles(sceneDir, new Set(['.js', '.ts', '.html']));
  for (const filePath of codeFiles.slice(0, 8)) {
    const text = fs.readFileSync(filePath, 'utf8').toLowerCase();
    if (text.includes('three')) {
      return 'threejs';
    }
  }

  return 'web';
}

function detectBuildMode(packageJson) {
  if (!packageJson) {
    return 'static-html';
  }

  const scripts = packageJson.scripts || {};
  const scriptText = Object.values(scripts).join(' ').toLowerCase();
  if (scriptText.includes('vite')) {
    return 'vite';
  }

  return 'npm';
}

function categoryLabelFromPath(sceneDir) {
  return relFromRoot(path.dirname(sceneDir));
}

function categoryKind(sceneDir) {
  const category = path.basename(path.dirname(sceneDir)).toLowerCase();
  if (category.includes('juegos')) {
    return 'gameplay';
  }
  if (category.includes('simulacion')) {
    return 'simulation';
  }
  if (category.includes('herramientas') || category.includes('editores')) {
    return 'tooling';
  }
  if (category.includes('web')) {
    return 'web-experience';
  }
  return 'prototype';
}

function loadPackageJson(sceneDir) {
  const filePath = path.join(sceneDir, 'package.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return readJson(filePath);
  } catch (error) {
    return null;
  }
}

function buildSceneManifest(sceneDir) {
  const packageJson = loadPackageJson(sceneDir);
  const runtime = detectRuntime(sceneDir, packageJson);
  const binaryExtensions = new Set([
    '.glb',
    '.gltf',
    '.fbx',
    '.obj',
    '.stl',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.hdr',
  ]);
  const codeExtensions = new Set(['.js', '.ts', '.html', '.css']);
  const binaryAssets = listFiles(sceneDir, binaryExtensions).map(relFromRoot);
  const codeFiles = listFiles(sceneDir, codeExtensions).map(relFromRoot);
  const packagePath = path.join(sceneDir, 'package.json');
  const entryHtml = firstExistingFile(sceneDir, ['index.html']);
  const primaryScript = firstExistingFile(sceneDir, [
    'main.js',
    'scene.js',
    'game.js',
    'app.js',
    'editor.js',
    'sceneBuilder.js',
  ]);
  const title = sceneTitleFromReadme(sceneDir, path.basename(sceneDir));
  const buildMode = detectBuildMode(packageJson);
  const scripts = packageJson && packageJson.scripts ? packageJson.scripts : {};
  const command =
    buildMode === 'vite'
      ? 'npm install && npm run dev'
      : entryHtml
        ? `open ${entryHtml}`
        : null;

  return {
    scene_id: path.basename(sceneDir),
    title,
    scene_path: relFromRoot(sceneDir),
    category: categoryLabelFromPath(sceneDir),
    scene_kind: categoryKind(sceneDir),
    runtime,
    source_type: binaryAssets.length ? 'mixed' : 'procedural_code',
    launch: {
      build_mode: buildMode,
      package_json: fs.existsSync(packagePath) ? relFromRoot(packagePath) : null,
      entry_html: entryHtml,
      primary_script: primaryScript,
      npm_scripts: scripts,
      recommended_command: command,
    },
    stats: {
      code_files: codeFiles.length,
      binary_assets: binaryAssets.length,
    },
    binary_assets: binaryAssets,
    code_files: codeFiles,
    uses_external_asset_catalog: false,
  };
}

function writeSceneManifest(sceneDir, manifest) {
  const metaDir = path.join(sceneDir, 'meta');
  ensureDir(metaDir);
  writeJson(path.join(metaDir, SCENE_MANIFEST_NAME), manifest);
}

function sceneDirectories() {
  const results = [];
  walkDirectories(SCENES_ROOT, (dirPath) => {
    const hasIndex = fs.existsSync(path.join(dirPath, 'index.html'));
    const hasPackage = fs.existsSync(path.join(dirPath, 'package.json'));
    if (hasIndex || hasPackage) {
      results.push(dirPath);
    }
  });
  return results.sort();
}

function buildSceneCatalog() {
  const manifests = [];
  for (const sceneDir of sceneDirectories()) {
    const manifest = buildSceneManifest(sceneDir);
    writeSceneManifest(sceneDir, manifest);
    manifests.push(manifest);
  }

  return manifests.sort((a, b) => {
    const keyA = `${a.category}/${a.scene_id}`;
    const keyB = `${b.category}/${b.scene_id}`;
    return keyA.localeCompare(keyB);
  });
}

function buildAssetCatalog() {
  const manifests = findFilesByName(ROOT_DIR, ASSET_MANIFEST_NAME)
    .map((filePath) => readJson(filePath))
    .filter((manifest) => manifest.asset_id)
    .map((manifest) => ({
      asset_id: manifest.asset_id,
      asset_path: manifest.asset_path,
      category: manifest.category,
      preferred_runtime_entry: manifest.preferred_runtime_entry,
      source_archives: manifest.counts ? manifest.counts.source_archives : 0,
      geometry_glb: manifest.counts ? manifest.counts.geometry_glb : 0,
      geometry_fbx: manifest.counts ? manifest.counts.geometry_fbx : 0,
      geometry_stl: manifest.counts ? manifest.counts.geometry_stl : 0,
      textures: manifest.counts ? manifest.counts.textures : 0,
      imports: manifest.counts ? manifest.counts.imports : 0,
      duplicate_variants: Array.isArray(manifest.duplicate_variants_detected)
        ? manifest.duplicate_variants_detected.length
        : 0,
      runtime_ready: Boolean(manifest.preferred_runtime_entry),
    }))
    .sort((a, b) => {
      const keyA = `${a.category}/${a.asset_id}`;
      const keyB = `${b.category}/${b.asset_id}`;
      return keyA.localeCompare(keyB);
    });

  return manifests;
}

function writeDocumentation(assetCatalog, sceneCatalog) {
  ensureDir(DOCS_DIR);

  writeJson(path.join(DOCS_DIR, 'CATALOGO_ASSETS.json'), assetCatalog);
  writeCsv(path.join(DOCS_DIR, 'CATALOGO_ASSETS.csv'), assetCatalog);
  writeJson(path.join(DOCS_DIR, 'CATALOGO_ESCENAS.json'), sceneCatalog);
  writeCsv(path.join(DOCS_DIR, 'CATALOGO_ESCENAS.csv'), sceneCatalog);

  const runtimeRegistry = {
    generated_at: new Date().toISOString(),
    stats: {
      assets: assetCatalog.length,
      scenes: sceneCatalog.length,
      runtime_ready_assets: assetCatalog.filter((asset) => asset.runtime_ready).length,
      procedural_scenes: sceneCatalog.filter((scene) => scene.source_type === 'procedural_code').length,
    },
    assets: assetCatalog,
    scenes: sceneCatalog.map((scene) => ({
      scene_id: scene.scene_id,
      title: scene.title,
      scene_path: scene.scene_path,
      category: scene.category,
      scene_kind: scene.scene_kind,
      runtime: scene.runtime,
      source_type: scene.source_type,
      launch: scene.launch,
      stats: scene.stats,
    })),
  };

  writeJson(path.join(DOCS_DIR, 'REGISTRO_MOTOR.json'), runtimeRegistry);

  const summaryLines = [
    '# Registro del motor',
    '',
    `- Assets catalogados: ${assetCatalog.length}`,
    `- Escenas catalogadas: ${sceneCatalog.length}`,
    `- Assets listos para runtime: ${runtimeRegistry.stats.runtime_ready_assets}`,
    `- Escenas procedurales: ${runtimeRegistry.stats.procedural_scenes}`,
    '',
    '## Archivos generados',
    '',
    '- `CATALOGO_ASSETS.json` y `CATALOGO_ASSETS.csv`',
    '- `CATALOGO_ESCENAS.json` y `CATALOGO_ESCENAS.csv`',
    '- `REGISTRO_MOTOR.json`',
    '',
    '## Convenciones',
    '',
    '- Los assets se leen desde `meta/asset_manifest.json`.',
    '- Las escenas generan `meta/scene_manifest.json` automaticamente.',
    '- Las rutas del registro usan `/` para facilitar el consumo desde herramientas y runtime.',
  ];

  fs.writeFileSync(path.join(DOCS_DIR, 'REGISTRO_MOTOR.md'), `${summaryLines.join('\n')}\n`, 'utf8');
}

function main() {
  const assetCatalog = buildAssetCatalog();
  const sceneCatalog = buildSceneCatalog();
  writeDocumentation(assetCatalog, sceneCatalog);

  console.log(
    JSON.stringify(
      {
        assets: assetCatalog.length,
        scenes: sceneCatalog.length,
        output: relFromRoot(path.join(DOCS_DIR, 'REGISTRO_MOTOR.json')),
      },
      null,
      2
    )
  );
}

main();
