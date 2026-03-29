const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCENES_ROOT = path.join(ROOT_DIR, '05_Escenas_ThreeJS');

const SCENE_MAP = {
  'remix-3d-game': { slug: 'game-3d', title: '3D Game' },
  'remix-3d-website-the-digital-o': {
    slug: 'website-3d-digital-oasis',
    title: '3D Website - The Digital Oasis',
  },
  'remix-blink-voice-react': { slug: 'blink-voice-react', title: 'Blink Voice React' },
  'remix-car-game': { slug: 'car-game', title: 'Car Game' },
  'remix-forest-camp-game': { slug: 'forest-camp-game', title: 'Forest Camp Game' },
  'remix-gpu-terrain-forge': { slug: 'gpu-terrain-forge', title: 'GPU Terrain Forge' },
  'remix-interactive-3d-skatepark': {
    slug: 'interactive-3d-skatepark-editor',
    title: 'Interactive 3D Skatepark Editor',
  },
  'remix-matcap-generator-v25': { slug: 'matcap-generator-v25', title: 'Matcap Generator v25' },
  'remix-matcap-generator-v28': { slug: 'matcap-generator-v28', title: 'Matcap Generator v28' },
  'remix-minimalist-3d-business-c': {
    slug: 'minimalist-3d-business-card',
    title: 'Minimalist 3D Business Card',
  },
  'remix-platform-game-3d-scene': {
    slug: 'platform-game-3d-scene',
    title: 'Platform Game 3D Scene',
  },
  'remix-playground-garden': { slug: 'playground-garden', title: 'Playground Garden' },
  'remix-sci-fi-shooter-with-tech': {
    slug: 'scifi-shooter-tech-helmets',
    title: 'Sci-fi Shooter With Tech Helmets',
  },
  'remix-sunny-block-planner': { slug: 'sunny-block-planner', title: 'Sunny Block Planner' },
  'remix-water-simulation-above-a': {
    slug: 'water-simulation-above-below',
    title: 'Water Simulation Above and Below',
  },
  'scene-variation-with-new-conte': {
    slug: 'scene-variation-new-content',
    title: 'Scene Variation With New Content',
  },
};

function walkDirectories(startPath, callback) {
  if (!fs.existsSync(startPath)) {
    return;
  }

  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const fullPath = path.join(startPath, entry.name);
    callback(fullPath, entry.name);
    walkDirectories(fullPath, callback);
  }
}

function findScenePath(folderName) {
  let match = null;
  walkDirectories(SCENES_ROOT, (dirPath, entryName) => {
    if (!match && entryName === folderName) {
      match = dirPath;
    }
  });
  return match;
}

function writeIfChanged(filePath, nextContent) {
  const currentContent = fs.readFileSync(filePath, 'utf8');
  if (currentContent !== nextContent) {
    fs.writeFileSync(filePath, nextContent, 'utf8');
  }
}

function cleanReadme(filePath, title) {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/^#\s*Remix:\s*.*$/im, `# ${title}`);
  text = text.replace(/^Created with \[Omma\]\(https:\/\/omma\.build\)\s*$/gim, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  writeIfChanged(filePath, text.trimEnd() + '\n');
}

function cleanIndexHtml(filePath, title) {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/<title>\s*Remix:\s*[^<]+<\/title>/i, `<title>${title}</title>`);
  text = text.replace(/OmmaAI/g, 'MaterialLab');
  writeIfChanged(filePath, text);
}

function cleanJavaScript(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/OmmaAI/g, 'MaterialLab');
  writeIfChanged(filePath, text);
}

function cleanPackageJson(filePath, slug) {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (json.name) {
    json.name = slug;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

function sceneFiles(sceneDir) {
  return fs.readdirSync(sceneDir).filter((name) => fs.statSync(path.join(sceneDir, name)).isFile());
}

function processScene(sceneDir, config) {
  const files = sceneFiles(sceneDir);
  for (const fileName of files) {
    const fullPath = path.join(sceneDir, fileName);
    if (fileName === 'README.md') {
      cleanReadme(fullPath, config.title);
    } else if (fileName === 'index.html') {
      cleanIndexHtml(fullPath, config.title);
    } else if (fileName === 'package.json') {
      cleanPackageJson(fullPath, config.slug);
    } else if (fileName.endsWith('.js')) {
      cleanJavaScript(fullPath);
    }
  }
}

function renameSceneFolder(sceneDir, newSlug) {
  const parentDir = path.dirname(sceneDir);
  const nextPath = path.join(parentDir, newSlug);
  if (sceneDir === nextPath) {
    return nextPath;
  }
  if (fs.existsSync(nextPath)) {
    throw new Error(`Destination already exists: ${nextPath}`);
  }
  fs.renameSync(sceneDir, nextPath);
  return nextPath;
}

function main() {
  const summary = [];

  for (const [oldName, config] of Object.entries(SCENE_MAP)) {
    const sceneDir = findScenePath(oldName);
    if (!sceneDir) {
      continue;
    }

    processScene(sceneDir, config);
    const finalPath = renameSceneFolder(sceneDir, config.slug);
    summary.push({ from: oldName, to: path.basename(finalPath), title: config.title });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
