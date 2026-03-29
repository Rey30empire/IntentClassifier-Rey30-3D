const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function registryPath(rootDir) {
  return path.join(rootDir, '00_DOCUMENTACION', 'REGISTRO_MOTOR.json');
}

function loadEngineRegistry(rootDir) {
  return loadJson(registryPath(rootDir));
}

function buildIndex(items, keyField) {
  return new Map(items.map((item) => [item[keyField], item]));
}

function resolveRelativePath(rootDir, relativePath) {
  if (!relativePath) {
    return null;
  }
  return path.join(rootDir, ...relativePath.split('/'));
}

function getAssetById(registry, assetId) {
  return registry.assets.find((asset) => asset.asset_id === assetId) || null;
}

function getSceneById(registry, sceneId) {
  return registry.scenes.find((scene) => scene.scene_id === sceneId) || null;
}

function getAssetRuntimePath(rootDir, registry, assetId) {
  const asset = getAssetById(registry, assetId);
  if (!asset || !asset.preferred_runtime_entry) {
    return null;
  }
  return resolveRelativePath(rootDir, asset.preferred_runtime_entry);
}

function getSceneLaunchInfo(rootDir, registry, sceneId) {
  const scene = getSceneById(registry, sceneId);
  if (!scene) {
    return null;
  }

  return {
    sceneId: scene.scene_id,
    title: scene.title,
    buildMode: scene.launch.build_mode,
    entryHtml: resolveRelativePath(rootDir, scene.launch.entry_html),
    packageJson: resolveRelativePath(rootDir, scene.launch.package_json),
    primaryScript: resolveRelativePath(rootDir, scene.launch.primary_script),
    recommendedCommand: scene.launch.recommended_command,
  };
}

module.exports = {
  buildIndex,
  getAssetById,
  getAssetRuntimePath,
  getSceneById,
  getSceneLaunchInfo,
  loadEngineRegistry,
  registryPath,
  resolveRelativePath,
};
