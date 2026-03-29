// ══════════════════════════════════════════════
// ENV SETTINGS — Lighting, Shadows
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import {
  pass, mrt, output, normalView,
  directionToColor,
} from "three/tsl";

// ── HDR ──
const HDR_ID = "sunflowers_puresky";
const hdrCache = new Map();
const hdrLoader = new HDRLoader();

// ══════════════════════════════════════════════
// ── SETUP RENDERER ──
// ══════════════════════════════════════════════

export async function createRenderer() {
  const renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;
  const root = document.getElementById("root") ?? document.body;
  root.appendChild(renderer.domElement);
  await renderer.init();
  return renderer;
}

// ══════════════════════════════════════════════
// ── SETUP SCENE (background, fog, env) ──
// ══════════════════════════════════════════════

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x85ecf9);
  scene.fog = new THREE.Fog(0x85ecf9, 11, 27);
  scene.environmentIntensity = 0.45;
  return scene;
}

// ══════════════════════════════════════════════
// ── SETUP CAMERA ──
// ══════════════════════════════════════════════

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(-6.1, 6.7, 5.2);
  return camera;
}

// ══════════════════════════════════════════════
// ── HDR ENVIRONMENT LOADER ──
// ══════════════════════════════════════════════

export function loadHDR(scene) {
  if (hdrCache.has(HDR_ID)) {
    scene.environment = hdrCache.get(HDR_ID);
    return;
  }
  const url = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${HDR_ID}_1k.hdr`;
  hdrLoader.load(url, (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    hdrCache.set(HDR_ID, hdrTexture);
    scene.environment = hdrTexture;
  });
}

// ══════════════════════════════════════════════
// ── LIGHTING ──
// ══════════════════════════════════════════════

export function setupLighting(scene) {
  const ambientLight = new THREE.AmbientLight(0xffdbdf, 1.35);
  ambientLight.name = "ambientLight";
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffe53d, 1.50);
  sunLight.name = "sunLight";
  sunLight.position.set(-7.2, 11.6, -7.3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(256, 256);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 25;
  sunLight.shadow.camera.left = -12;
  sunLight.shadow.camera.right = 10;
  sunLight.shadow.camera.top = 10;
  sunLight.shadow.camera.bottom = -10;
  sunLight.shadow.radius = 0.5;
  sunLight.shadow.blurSamples = 1;
  sunLight.shadow.bias = -0.01;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xf5c619, 0.80);
  fillLight.name = "fillLight";
  fillLight.position.set(-3.1, 6.0, -3.5);
  fillLight.castShadow = false;
  scene.add(fillLight);

  return { ambientLight, sunLight, fillLight };
}

// ══════════════════════════════════════════════
// ── POST-PROCESSING (SSGI + TRAA) ──
// ══════════════════════════════════════════════

export function setupPostProcessing(renderer, scene, camera) {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(
    mrt({
      output: output,
      normal: directionToColor(normalView),
    }),
  );

  const scenePassColor = scenePass.getTextureNode("output");

  // Render pipeline — straight scene pass, no AO or vignette
  const renderPipeline = new THREE.RenderPipeline(renderer);
  renderPipeline.outputNode = scenePassColor;

  return { renderPipeline };
}