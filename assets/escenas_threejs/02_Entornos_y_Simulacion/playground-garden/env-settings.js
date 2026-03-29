// ══════════════════════════════════════════════
// ENV SETTINGS — Lighting, Shadows, AO, SSGI
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import {
  pass, mrt, output, diffuseColor, normalView, velocity,
  metalness, roughness, directionToColor, colorToDirection,
  vec2, vec4, sample,
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.10));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.30;
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
  scene.fog = new THREE.Fog(0x85ecf9, 8, 20);
  scene.environmentIntensity = 0.45;
  return scene;
}

// ══════════════════════════════════════════════
// ── SETUP CAMERA ──
// ══════════════════════════════════════════════

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(3.2, 2.0, 4.0);
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
  const ambientLight = new THREE.AmbientLight(0xffa861, 2.35);
  ambientLight.name = "ambientLight";
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffe53d, 3.55);
  sunLight.name = "sunLight";
  sunLight.position.set(2.5, 15.5, -6.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(512, 512);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 10;
  sunLight.shadow.camera.top = 15;
  sunLight.shadow.camera.bottom = -15;
  sunLight.shadow.radius = 0.6;
  sunLight.shadow.blurSamples = 2;
  sunLight.shadow.bias = -0.01;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xf5c619, 2.20);
  fillLight.name = "fillLight";
  fillLight.position.set(-3.9, 6.0, -3.5);
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
      diffuseColor: diffuseColor,
      normal: directionToColor(normalView),
      velocity: velocity,
      metalrough: vec2(metalness, roughness),
    }),
  );

  const scenePassColor   = scenePass.getTextureNode("output");
  const scenePassDiffuse = scenePass.getTextureNode("diffuseColor");
  const scenePassDepth   = scenePass.getTextureNode("depth");
  const scenePassNormal  = scenePass.getTextureNode("normal");
  const scenePassVelocity = scenePass.getTextureNode("velocity");

  const sceneNormal = sample((uvCoord) => {
    return colorToDirection(scenePassNormal.sample(uvCoord));
  });

  // AO pass
  const aoPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
  aoPass.sliceCount.value = 1;
  aoPass.stepCount.value = 4;
  aoPass.radius.value = 7;
  aoPass.expFactor.value = 2.7;
  aoPass.thickness.value = 0.82;
  aoPass.backfaceLighting.value = 0.06;
  aoPass.aoIntensity.value = 2.1;
  aoPass.giIntensity.value = 0;
  aoPass.useLinearThickness.value = false;
  aoPass.useScreenSpaceSampling.value = false;
  aoPass.useTemporalFiltering = true;
  aoPass.giEnabled = false;
  aoPass.aoEnabled = true;

  const ao = aoPass.a;

  // AO composite
  const compositeAo = vec4(scenePassColor.rgb.mul(ao), scenePassColor.a);

  // TRAA
  const traaAo = traa(compositeAo, scenePassDepth, scenePassVelocity, camera);

  // Render pipeline
  const renderPipeline = new THREE.RenderPipeline(renderer);
  renderPipeline.outputNode = traaAo;

  function updateOutputPipeline() {
    const node = aoPass.aoEnabled ? traaAo : scenePassColor;
    renderPipeline.outputNode = node;
    renderPipeline.needsUpdate = true;
  }
  updateOutputPipeline();

  return { renderPipeline, aoPass, updateOutputPipeline };
}