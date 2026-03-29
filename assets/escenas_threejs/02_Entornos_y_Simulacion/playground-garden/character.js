// ══════════════════════════════════════════════
// CHARACTER — Animal Crossing style chibi character
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { 
  uv, vec2, vec3, vec4, float, color, uniform,
  smoothstep, step, length, abs, max, min,
  mix, clamp, sin, cos, time, sub, mul, add,
  normalize, dot, pow, positionLocal, normalLocal,
  Fn, If, assign, varying
} from "three/tsl";
import { getAnimState } from "./skeleton-animation.js";

// ── Shared materials ──
const _skinMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0xfad0b0),
  roughness: 0.75,
  metalness: 0.0,
});
_skinMat._shared = true;

const _shortsMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x8B6B4A),
  roughness: 0.8,
  metalness: 0.0,
});
_shortsMat._shared = true;

const _shoeMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0xd4956a),
  roughness: 0.9,
  metalness: 0.0,
});
_shoeMat._shared = true;

// ── Blink uniform — 0.0 = eyes open, 1.0 = eyes fully closed ──
const _blinkUniform = uniform(float(0.0));

// ── Mouth open uniform — 0.0 = closed smile, 1.0 = fully open oval ──
const _mouthOpenUniform = uniform(float(0.0));

// ── TSL Face Shader Material ──
function createFaceMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.65,
    metalness: 0.0,
  });

  const uvNode = uv();
  const u = uvNode.x;
  const v = uvNode.y;

  // Skin base — warm peach
  const skin = color(0xfad0b0);
  const cheekColor = color(0xe86860);

  // Blink value (0 = open, 1 = closed)
  const blink = _blinkUniform;

  // ── Eyes — tall ovals, solid black with white highlights (AC style) ──
  const eyeSpacing = 0.12;
  const eyeCenterY = 0.47;

  // Vertically elongated ellipse — Y radius shrinks with blink
  const eyeRadX = float(0.052);
  const eyeRadYOpen = float(0.078);
  // When blink=1, eye becomes a thin horizontal line
  const eyeRadY = mix(eyeRadYOpen, float(0.005), blink);

  // Left eye ellipse distance
  const eLx = u.sub(0.5 - eyeSpacing).div(eyeRadX);
  const eLy = v.sub(eyeCenterY).div(eyeRadY);
  const eyeLD = length(vec2(eLx, eLy));

  // Right eye ellipse distance
  const eRx = u.sub(0.5 + eyeSpacing).div(eyeRadX);
  const eRy = v.sub(eyeCenterY).div(eyeRadY);
  const eyeRD = length(vec2(eRx, eRy));

  // Solid black eye fill (smooth edge)
  const eyeL = smoothstep(float(1.0), float(0.92), eyeLD);
  const eyeR = smoothstep(float(1.0), float(0.92), eyeRD);
  const eyes = max(eyeL, eyeR);

  // ── Closed eye lines — curved arcs drawn when blinking ──
  // A gentle downward curve at each eye position (like "⌒")
  const closedLineHalfW = 0.052;
  // Left eye closed line
  const clLx = u.sub(0.5 - eyeSpacing);
  const clLcurve = v.sub(eyeCenterY).add(clLx.mul(clLx).mul(8.0));
  const closedL = smoothstep(float(0.006), float(0.001), abs(clLcurve))
    .mul(smoothstep(float(closedLineHalfW), float(closedLineHalfW - 0.01), abs(clLx)));
  // Right eye closed line
  const clRx = u.sub(0.5 + eyeSpacing);
  const clRcurve = v.sub(eyeCenterY).add(clRx.mul(clRx).mul(8.0));
  const closedR = smoothstep(float(0.006), float(0.001), abs(clRcurve))
    .mul(smoothstep(float(closedLineHalfW), float(closedLineHalfW - 0.01), abs(clRx)));
  const closedEyes = max(closedL, closedR);

  // Large highlight — upper-left of each eye (hidden when blinking)
  const hl1Lpos = vec2(u.sub(0.5 - eyeSpacing - 0.018), v.sub(eyeCenterY + 0.028));
  const hl1Rpos = vec2(u.sub(0.5 + eyeSpacing - 0.018), v.sub(eyeCenterY + 0.028));
  const hl1 = max(
    smoothstep(float(0.024), float(0.014), length(hl1Lpos)),
    smoothstep(float(0.024), float(0.014), length(hl1Rpos))
  );

  // Small highlight — lower-right of each eye (hidden when blinking)
  const hl2Lpos = vec2(u.sub(0.5 - eyeSpacing + 0.016), v.sub(eyeCenterY - 0.022));
  const hl2Rpos = vec2(u.sub(0.5 + eyeSpacing + 0.016), v.sub(eyeCenterY - 0.022));
  const hl2 = max(
    smoothstep(float(0.013), float(0.006), length(hl2Lpos)),
    smoothstep(float(0.013), float(0.006), length(hl2Rpos))
  );

  const highlights = max(hl1, hl2);

  // ── Nose — tiny inverted triangle, just a small shadow ──
  const noseX = u.sub(0.5);
  const noseY = v.sub(0.405);
  const noseTri = max(
    noseY.negate().add(0.012),
    abs(noseX).sub(noseY.negate().mul(0.8)).sub(0.006)
  );
  const nose = smoothstep(float(0.003), float(0.0), noseTri).mul(0.55);

  // ── Mouth — closed smile line + open oval, lerped by uniform ──
  const mouthOpen = _mouthOpenUniform;

  // Closed smile (original)
  const mouthCenterY = 0.355;
  const mouthWidth = 0.065;
  const mouthCurve = v.sub(mouthCenterY).add(u.sub(0.5).mul(u.sub(0.5)).mul(-5.0));
  const mouthDist = abs(mouthCurve);
  const smileMask = smoothstep(float(0.008), float(0.002), mouthDist)
    .mul(smoothstep(float(0.5 - mouthWidth), float(0.5 - mouthWidth + 0.015), u))
    .mul(smoothstep(float(0.5 + mouthWidth), float(0.5 + mouthWidth - 0.015), u));

  // Open mouth — oval at mouth center
  const openCX = float(0.5);
  const openCY = float(0.35);
  const openRadX = float(0.045);  // horizontal radius
  const openRadY = float(0.035);  // vertical radius
  const openDx = u.sub(openCX).div(openRadX);
  const openDy = v.sub(openCY).div(openRadY);
  const openDist = length(vec2(openDx, openDy));
  const openMask = smoothstep(float(1.0), float(0.85), openDist);

  // Interior of open mouth — dark inside with tongue hint
  const tongueD = length(vec2(u.sub(0.5).mul(18.0), v.sub(0.335).mul(22.0)));
  const tongue = smoothstep(float(1.0), float(0.5), tongueD).mul(0.4);
  const openColor = mix(color(0x2a0a0a), color(0xc85050), tongue);

  // Lerp between closed smile and open mouth
  const mouthMask = mix(smileMask, openMask, mouthOpen);
  const mouthColor = mix(color(0xc85050), openColor, mouthOpen);

  // ── Cheeks — oval rosy blush ──
  const cheekY = 0.40;
  const cheekLpos = vec2(u.sub(0.32).mul(1.0), v.sub(cheekY).mul(1.4));
  const cheekRpos = vec2(u.sub(0.68).mul(1.0), v.sub(cheekY).mul(1.4));
  const cheekL = smoothstep(float(0.055), float(0.020), length(cheekLpos)).mul(0.40);
  const cheekR = smoothstep(float(0.055), float(0.020), length(cheekRpos)).mul(0.40);
  const cheeks = cheekL.add(cheekR);

  // ── Compose face ──
  let faceColor = skin;

  // Nose shadow
  faceColor = mix(faceColor, color(0xd4a080), nose);

  // Cheek blush
  faceColor = mix(faceColor, cheekColor, cheeks);

  // Open eyes — solid black (fade out when blinking)
  const openAlpha = float(1.0).sub(blink);
  faceColor = mix(faceColor, color(0x1a1a1a), eyes.mul(openAlpha));

  // Eye highlights — white, on top of black (hidden when blinking)
  faceColor = mix(faceColor, color(0xffffff), highlights.mul(eyes).mul(openAlpha));

  // Closed eye lines — thin curved arcs (fade in when blinking)
  faceColor = mix(faceColor, color(0x1a1a1a), closedEyes.mul(blink));

  // Mouth — simple curved line
  faceColor = mix(faceColor, mouthColor, mouthMask);

  mat.colorNode = faceColor;

  return mat;
}

// ── Shirt material — Hawaiian/tropical pattern ──
function createShirtMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.8,
    metalness: 0.0,
  });

  const uvNode = uv();
  const u = uvNode.x;
  const v = uvNode.y;

  // Base yellow
  const baseColor = color(0xd4c040);

  // Blue leaf pattern — tiling
  const tileU = u.mul(4.0);
  const tileV = v.mul(6.0);
  const fu = tileU.sub(tileU.floor());
  const fv = tileV.sub(tileV.floor());

  // Leaf shape at center of each tile
  const leafD = length(vec2(fu.sub(0.5).mul(1.8), fv.sub(0.5)));
  const leaf = smoothstep(float(0.35), float(0.15), leafD);

  // Leaf spine
  const spineD = abs(fu.sub(0.5));
  const spine = smoothstep(float(0.03), float(0.005), spineD)
    .mul(smoothstep(float(0.45), float(0.2), leafD));

  const blueLeaf = color(0x4a90c8);
  const darkGreen = color(0x3a7040);

  let shirtColor = baseColor;
  shirtColor = mix(shirtColor, blueLeaf, leaf.mul(0.7));
  shirtColor = mix(shirtColor, darkGreen, spine.mul(0.4));

  mat.colorNode = shirtColor;
  return mat;
}

// ── Cap Material — sporty baseball cap ──
function createCapMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.75,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const uvNode = uv();
  const u = uvNode.x;
  const v = uvNode.y;

  // Base cap color — rich navy blue
  const baseColor = color(0x1a3a6a);
  const accentColor = color(0xc83030);  // red accent stripe
  const stitchColor = color(0x90b0d0); // light blue stitching

  // Horizontal accent stripe around band area
  const bandY = 0.18;
  const bandWidth = 0.04;
  const bandMask = smoothstep(float(bandY - bandWidth), float(bandY - bandWidth + 0.01), v)
    .mul(smoothstep(float(bandY + bandWidth), float(bandY + bandWidth - 0.01), v));

  // Panel seam lines — vertical stitch lines
  const seamCount = 6.0;
  const seamU = u.mul(seamCount);
  const seamFrac = seamU.sub(seamU.floor());
  const seamLine = smoothstep(float(0.015), float(0.005), abs(seamFrac.sub(0.5)))
    .mul(smoothstep(float(0.15), float(0.25), v)); // only above band

  // Button on top — small circle at top center
  const topBtnDist = length(vec2(u.sub(0.5), v.sub(0.95)));
  const topBtn = smoothstep(float(0.025), float(0.015), topBtnDist);

  let capColor = baseColor;
  capColor = mix(capColor, accentColor, bandMask.mul(0.85));
  capColor = mix(capColor, stitchColor, seamLine.mul(0.3));
  capColor = mix(capColor, accentColor, topBtn);

  mat.colorNode = capColor;
  return mat;
}

// ── Cap Brim Material ──
function createBrimMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x1a3a6a),
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  return mat;
}

// ── Shared geometries ──
let _headGeo, _handGeo, _bodyGeo, _legGeo, _shoeGeo, _armGeo, _capGeo, _brimGeo, _noseGeo;

function ensureGeos() {
  if (_headGeo) return;
  _headGeo = new THREE.SphereGeometry(1, 28, 20);
  _handGeo = new THREE.SphereGeometry(1, 8, 6);
  _bodyGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  _legGeo = new THREE.CylinderGeometry(1, 0.65, 1, 8, 1);
  _shoeGeo = new THREE.SphereGeometry(1, 8, 6);
  _armGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  // Cap dome — upper hemisphere shell
  _capGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.50);
  // Brim — flat curved disc extending forward
  _brimGeo = new THREE.CircleGeometry(1, 24, -Math.PI * 0.45, Math.PI * 1.9);
  // Nose — small sphere
  _noseGeo = new THREE.SphereGeometry(1, 10, 8);
}

// ══════════════════════════════════════════════
// ── BUILD CHARACTER ──
// ══════════════════════════════════════════════

export function createCharacter(opts = {}) {
  ensureGeos();

  const group = new THREE.Group();
  group.name = "character";

  // Chibi proportions — big head, tiny body
  const headRadius = 0.30;
  const bodyH = 0.22;
  const bodyRadiusTop = 0.15;
  const bodyRadiusBottom = 0.12;
  const legH = 0.14;
  const legRadius = 0.055;
  const armH = 0.18;
  const armRadius = 0.025;
  const handRadius = 0.05;
  const shoeRadius = 0.06;
  const legSpacing = 0.07;
  const armOffsetX = bodyRadiusTop + armRadius * 0.3;

  const bodyBaseY = legH + shoeRadius * 0.3;
  const headBaseY = bodyBaseY + bodyH + headRadius * 0.7;

  // Face angle — flip face from -Z to +Z (local forward)
  const faceAngle = Math.PI + Math.PI / 2;

  // ── Create all meshes (not yet parented) ──

  // Head
  const faceMat = createFaceMaterial();
  const head = new THREE.Mesh(_headGeo, faceMat);
  head.name = "char_head";
  head.scale.set(headRadius, headRadius * 0.95, headRadius * 0.92);
  head.rotation.y = faceAngle;
  head.castShadow = true;

  // Cap dome
  const capMat = createCapMaterial();
  const cap = new THREE.Mesh(_capGeo, capMat);
  cap.name = "char_cap";
  const capScale = headRadius * 1.08;
  cap.scale.set(capScale, capScale * 0.85, capScale * 0.95);
  cap.position.set(0, headRadius * 0.15, 0);
  cap.rotation.y = faceAngle;
  cap.rotation.x = -0.15;
  cap.castShadow = true;

  // Cap brim
  const brimMat = createBrimMaterial();
  const brim = new THREE.Mesh(_brimGeo, brimMat);
  brim.name = "char_brim";
  const brimScale = headRadius * 0.85;
  brim.scale.set(brimScale * 1.1, brimScale * 1.0, brimScale * 0.6);
  brim.position.set(0, headRadius * 0.12, -headRadius * 0.65);
  brim.rotation.x = -Math.PI * 0.48;
  brim.castShadow = true;

  // Nose — small sphere protruding from front of face
  const nose = new THREE.Mesh(_noseGeo, _skinMat);
  nose.name = "char_nose";
  const noseSize = headRadius * 0.15;
  nose.scale.set(noseSize, noseSize * 0.9, noseSize * 1.3);
  // Position in boneHead local space — Z forward (positive) to be on the face
  nose.position.set(0, -headRadius * 0.08, headRadius * 0.85);
  nose.castShadow = true;

  // Body (torso)
  const shirtMat = createShirtMaterial();
  const body = new THREE.Mesh(_bodyGeo, shirtMat);
  body.name = "char_body";
  body.scale.set(bodyRadiusTop, bodyH, bodyRadiusBottom);
  body.position.set(0, bodyH * 0.5, 0);
  body.castShadow = true;

  // Left leg
  const legL = new THREE.Mesh(_legGeo, _shortsMat);
  legL.name = "char_legL";
  legL.scale.set(legRadius, legH, legRadius);
  legL.position.set(0, -legH * 0.4, 0);
  legL.castShadow = true;

  // Right leg
  const legR = new THREE.Mesh(_legGeo, _shortsMat);
  legR.name = "char_legR";
  legR.scale.set(legRadius, legH, legRadius);
  legR.position.set(0, -legH * 0.4, 0);
  legR.castShadow = true;

  // Left shoe
  const shoeL = new THREE.Mesh(_shoeGeo, _shoeMat);
  shoeL.name = "char_shoeL";
  shoeL.scale.set(shoeRadius, shoeRadius * 0.6, shoeRadius * 1.2);
  shoeL.position.set(0, -shoeRadius * 0.05, 0.015);
  shoeL.castShadow = true;

  // Right shoe
  const shoeR = new THREE.Mesh(_shoeGeo, _shoeMat);
  shoeR.name = "char_shoeR";
  shoeR.scale.set(shoeRadius, shoeRadius * 0.6, shoeRadius * 1.2);
  shoeR.position.set(0, -shoeRadius * 0.05, 0.015);
  shoeR.castShadow = true;

  // Left arm
  const armL = new THREE.Mesh(_armGeo, _skinMat);
  armL.name = "char_armL";
  armL.scale.set(armRadius, armH, armRadius);
  armL.position.set(0, -armH * 0.5, 0);
  armL.castShadow = true;

  // Right arm
  const armR = new THREE.Mesh(_armGeo, _skinMat);
  armR.name = "char_armR";
  armR.scale.set(armRadius, armH, armRadius);
  armR.position.set(0, -armH * 0.5, 0);
  armR.castShadow = true;

  // Left hand
  const handL = new THREE.Mesh(_handGeo, _skinMat);
  handL.name = "char_handL";
  handL.scale.setScalar(handRadius);
  handL.position.set(0, 0, 0);
  handL.castShadow = true;

  // Right hand
  const handR = new THREE.Mesh(_handGeo, _skinMat);
  handR.name = "char_handR";
  handR.scale.setScalar(handRadius);
  handR.position.set(0, 0, 0);
  handR.castShadow = true;

  // ── Build skeleton hierarchy ──

  // Root bone at hips level
  const boneRoot = new THREE.Group();
  boneRoot.name = "bone_root";
  boneRoot.position.set(0, bodyBaseY, 0);

  // Spine
  const boneSpine = new THREE.Group();
  boneSpine.name = "bone_spine";
  boneRoot.add(boneSpine);

  // Neck (top of torso)
  const boneNeck = new THREE.Group();
  boneNeck.name = "bone_neck";
  boneNeck.position.set(0, bodyH, 0);
  boneSpine.add(boneNeck);

  // Head bone
  const boneHead = new THREE.Group();
  boneHead.name = "bone_head";
  boneHead.position.set(0, headRadius * 0.7, 0);
  boneNeck.add(boneHead);

  // ── Left arm chain ──
  const boneShoulderL = new THREE.Group();
  boneShoulderL.name = "bone_shoulderL";
  boneShoulderL.position.set(-armOffsetX, bodyH * 0.65, 0);
  boneSpine.add(boneShoulderL);

  const boneArmL = new THREE.Group();
  boneArmL.name = "bone_armL";
  boneShoulderL.add(boneArmL);

  const boneHandL = new THREE.Group();
  boneHandL.name = "bone_handL";
  boneHandL.position.set(0, -armH, 0);
  boneArmL.add(boneHandL);

  // ── Right arm chain ──
  const boneShoulderR = new THREE.Group();
  boneShoulderR.name = "bone_shoulderR";
  boneShoulderR.position.set(armOffsetX, bodyH * 0.65, 0);
  boneSpine.add(boneShoulderR);

  const boneArmR = new THREE.Group();
  boneArmR.name = "bone_armR";
  boneShoulderR.add(boneArmR);

  const boneHandR = new THREE.Group();
  boneHandR.name = "bone_handR";
  boneHandR.position.set(0, -armH, 0);
  boneArmR.add(boneHandR);

  // ── Left leg chain ──
  const boneHipL = new THREE.Group();
  boneHipL.name = "bone_hipL";
  boneHipL.position.set(-legSpacing, 0, 0);
  boneRoot.add(boneHipL);

  const boneUpperLegL = new THREE.Group();
  boneUpperLegL.name = "bone_upperLegL";
  boneHipL.add(boneUpperLegL);

  const boneFootL = new THREE.Group();
  boneFootL.name = "bone_footL";
  boneFootL.position.set(0, -legH, 0);
  boneUpperLegL.add(boneFootL);

  // ── Right leg chain ──
  const boneHipR = new THREE.Group();
  boneHipR.name = "bone_hipR";
  boneHipR.position.set(legSpacing, 0, 0);
  boneRoot.add(boneHipR);

  const boneUpperLegR = new THREE.Group();
  boneUpperLegR.name = "bone_upperLegR";
  boneHipR.add(boneUpperLegR);

  const boneFootR = new THREE.Group();
  boneFootR.name = "bone_footR";
  boneFootR.position.set(0, -legH, 0);
  boneUpperLegR.add(boneFootR);

  // ── Attach meshes to bones ──
  boneSpine.add(body);
  boneHead.add(head);
  boneHead.add(nose);
  boneHead.add(cap);
  boneHead.add(brim);
  boneArmL.add(armL);
  boneHandL.add(handL);
  boneArmR.add(armR);
  boneHandR.add(handR);
  boneUpperLegL.add(legL);
  boneFootL.add(shoeL);
  boneUpperLegR.add(legR);
  boneFootR.add(shoeR);

  // Add skeleton to group
  group.add(boneRoot);

  // ── Store refs for animation ──
  group.userData.charParts = {
    head, nose, cap, brim, body, legL, legR, armL, armR, handL, handR, shoeL, shoeR,
    headBaseY,
    bodyBaseY,
    bodyH,
    armH,
    armOffsetX,
    headRadius,
    faceAngle,
  };

  group.userData.skeleton = {
    root: boneRoot,
    spine: boneSpine,
    neck: boneNeck,
    head: boneHead,
    leftShoulder: boneShoulderL,
    leftArm: boneArmL,
    leftHand: boneHandL,
    rightShoulder: boneShoulderR,
    rightArm: boneArmR,
    rightHand: boneHandR,
    leftHip: boneHipL,
    leftUpperLeg: boneUpperLegL,
    leftFoot: boneFootL,
    rightHip: boneHipR,
    rightUpperLeg: boneUpperLegR,
    rightFoot: boneFootR,
  };

  return group;
}

// ══════════════════════════════════════════════
// ── IDLE ANIMATION (breathing + subtle sway + blink) ──
// ══════════════════════════════════════════════

// Blink state
let _nextBlinkTime = 2.0 + Math.random() * 3.0; // first blink after 2-5s
let _blinkPhase = -1; // -1 = not blinking, 0..1 = blink progress
const BLINK_DURATION = 0.15; // seconds for full close-open cycle
let _blinkStart = 0;

// ── Talk / mouth animation state ──
let _talkTarget = 0.0;       // target mouth openness (0 or 1)
let _talkCurrent = 0.0;      // current lerped value
let _nextTalkSwitch = 0;     // when to switch open/close


export function animateCharacter(scene, elapsed, delta) {
  // ── Blink logic (face shader uniform) ──
  if (_blinkPhase < 0) {
    if (elapsed >= _nextBlinkTime) {
      _blinkPhase = 0;
      _blinkStart = elapsed;
    }
  }

  if (_blinkPhase >= 0) {
    const blinkElapsed = elapsed - _blinkStart;
    const t01 = Math.min(blinkElapsed / BLINK_DURATION, 1.0);

    let blinkValue;
    if (t01 < 0.3) {
      const ct = t01 / 0.3;
      blinkValue = ct * ct;
    } else if (t01 < 0.5) {
      blinkValue = 1.0;
    } else {
      const ot = (t01 - 0.5) / 0.5;
      blinkValue = 1.0 - ot * ot;
    }

    _blinkUniform.value = blinkValue;

    if (t01 >= 1.0) {
      _blinkUniform.value = 0.0;
      _blinkPhase = -1;
      const doubleBlink = Math.random() < 0.25;
      _nextBlinkTime = elapsed + (doubleBlink ? 0.25 : 2.0 + Math.random() * 3.0);
    }
  }

  // ── Talk animation — only when waving ──
  const animState = getAnimState();
  const dt = delta || 0.016;

  if (animState.isWaving) {
    // Randomly switch between open/close mouth
    if (elapsed >= _nextTalkSwitch) {
      _talkTarget = _talkTarget < 0.5 ? 1.0 : 0.0;
      // Random interval: short open, variable close — mimics speech rhythm
      const duration = _talkTarget > 0.5
        ? 0.2 + Math.random() * 0.3    // open duration (slower)
        : 0.15 + Math.random() * 0.25; // close duration (slower)
      _nextTalkSwitch = elapsed + duration;
    }
  } else {
    // Not waving — close mouth
    _talkTarget = 0.0;
    _nextTalkSwitch = elapsed; // reset so talk starts immediately next wave
  }

  // Straight switch — no lerp
  _talkCurrent = _talkTarget;
  _mouthOpenUniform.value = _talkCurrent;
}