// ══════════════════════════════════════════════
// SKELETON ANIMATION — Walk, Run, Jump, Idle
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";

// ── Keyboard state ──
const keys = {
  w: false, a: false, s: false, d: false,
  z: false, q: false,
  up: false, down: false, left: false, right: false,
  shift: false, space: false,
};

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "w" || key === "arrowup") { keys.w = true; keys.up = true; }
  if (key === "s" || key === "arrowdown") { keys.s = true; keys.down = true; }
  if (key === "a" || key === "arrowleft") { keys.a = true; keys.left = true; }
  if (key === "d" || key === "arrowright") { keys.d = true; keys.right = true; }
  if (key === "z") keys.z = true;
  if (key === "q") keys.q = true;
  if (key === " ") keys.space = true;
  if (e.key === "Shift") keys.shift = true;
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "w" || key === "arrowup") { keys.w = false; keys.up = false; }
  if (key === "s" || key === "arrowdown") { keys.s = false; keys.down = false; }
  if (key === "a" || key === "arrowleft") { keys.a = false; keys.left = false; }
  if (key === "d" || key === "arrowright") { keys.d = false; keys.right = false; }
  if (key === "z") keys.z = false;
  if (key === "q") keys.q = false;
  if (key === " ") keys.space = false;
  if (e.key === "Shift") keys.shift = false;
});

// ── Jump state ──
let isJumping = false;
let jumpVelocity = 0;
let jumpHeight = 0;
const JUMP_FORCE = 4.5;
const GRAVITY = -12.0;

// ── Character movement state ──
// No face offset on root — face correction is baked into the head mesh only
const initialFacing = Math.atan2(3.2, 4.0);
let characterRotation = initialFacing;
let characterRotationTarget = initialFacing;
const characterPos = new THREE.Vector3(0, 0, 0);
let currentAnim = "idle";

// ── Forced animation state (set externally, e.g. by InteractionBox) ──
let forcedAnim = null; // e.g. "sitdown", "sitjump"

// ── Walk-to-target system ──
// When set, the character auto-walks to walkTarget, then calls walkTargetCb.
let walkTarget = null;            // THREE.Vector3 — destination point
let walkTargetFacing = null;      // number — final Y rotation when arrived
let walkTargetCb = null;          // function — called when character reaches target
const WALK_TO_ARRIVE_DIST = 0.08; // distance threshold to "arrive"

// ── Sit-jump transition system ──
let sitJumpActive = false;
let sitJumpTimer = 0;
const SIT_JUMP_DURATION = 0.7;    // total jump-sit duration in seconds (longer for visible hop)
let sitJumpStartY = 0;            // character Y at start of jump-sit
let sitJumpStartPos = null;       // THREE.Vector3 — position where jump begins (walk arrival)
let sitLockPos = null;            // THREE.Vector3 — locked position while seated (seat center)

// ── Stand-jump transition system (getting off the bench) ──
let standJumpActive = false;
let standJumpTimer = 0;
const STAND_JUMP_DURATION = 0.6;  // total stand-up jump duration in seconds

// ── Fence leap transition system (lamb-like hop over a fence) ──
let fenceLeapActive = false;
let fenceLeapTimer = 0;
const FENCE_LEAP_DURATION = 1.6; // total leap-over duration in seconds
let fenceLeapStartPos = null;     // THREE.Vector3 — position where leap begins
let fenceLeapEndPos = null;       // THREE.Vector3 — position where leap lands (other side of fence)
let fenceLeapFacing = 0;          // facing angle during leap
let fenceLeapCooldown = 0;        // cooldown timer to prevent re-triggering immediately

// ── Input lockout — temporarily ignores movement keys after auto-sit ──
let inputLockoutTimer = 0;
const INPUT_LOCKOUT_DURATION = 1.0; // seconds to ignore movement keys after sit trigger

// ── Seat level — world-space Y of the seat surface ──
// Set externally via setSeatLevel(). When sitting, the root bone is placed
// so the character's hips rest exactly on this level.
let seatLevelY = null;            // null = use default offset, number = exact world Y

// ── Character AABB (for box-vs-box intersection tests) ──
// Half-extents are in WORLD space (NOT scaled by charGroup) so they stay
// a consistent size regardless of character scale.
const CHAR_HALF_W = 0.12;  // X half-width  (total ~0.24)
const CHAR_HALF_H = 0.20;  // Y half-height (total ~0.40)
const CHAR_HALF_D = 0.12;  // Z half-depth  (total ~0.24)
const charAABB = new THREE.Box3();

// ── Idle wave timer ──
let idleTimer = 0;
const WAVE_DELAY = 3.0; // seconds idle before waving
let isWaving = false;

// ── Pose blending ──
let blendFactor = 1.0;
const BLEND_SPEED = 6.0;
let prevPoseSnapshot = null;
let lastAnim = "idle";

// ── Reset all bone rotations to rest pose ──
function resetPose(sk) {
  sk.spine.rotation.set(0, 0, 0);
  sk.neck.rotation.set(0, 0, 0);
  sk.head.rotation.set(0, 0, 0);
  sk.leftShoulder.rotation.set(0, 0, 0);
  sk.leftArm.rotation.set(0, 0, 0);
  sk.rightShoulder.rotation.set(0, 0, 0);
  sk.rightArm.rotation.set(0, 0, 0);
  sk.leftUpperLeg.rotation.set(0, 0, 0);
  sk.leftFoot.rotation.set(0, 0, 0);
  sk.rightUpperLeg.rotation.set(0, 0, 0);
  sk.rightFoot.rotation.set(0, 0, 0);
}

// ── Animation poses ──

function poseIdle(sk, t) {
  const breath = Math.sin(t * 1.8);
  sk.root.position.y += breath * 0.005;

  sk.spine.rotation.z = Math.sin(t * 0.8) * 0.01;

  sk.head.rotation.x = Math.sin(t * 0.7) * 0.03;
  sk.head.rotation.y = Math.sin(t * 0.4) * 0.04;

  // Left arm rests slightly out
  sk.leftArm.rotation.z = -0.45 + Math.sin(t * 1.2) * 0.06;
  sk.leftArm.rotation.x = 0;

  // Right arm rests slightly out
  sk.rightArm.rotation.z = 0.45 + Math.sin(t * 1.2 + 1.0) * 0.06;
  sk.rightArm.rotation.x = 0;
}

function poseWave(sk, t) {
  // Base idle body motion
  const breath = Math.sin(t * 1.8);
  sk.root.position.y += breath * 0.005;

  sk.spine.rotation.z = Math.sin(t * 0.8) * 0.01;

  sk.head.rotation.x = Math.sin(t * 0.7) * 0.03;
  sk.head.rotation.y = Math.sin(t * 0.4) * 0.04;

  // Left arm rests normally
  sk.leftArm.rotation.z = -0.45 + Math.sin(t * 1.2) * 0.06;
  sk.leftArm.rotation.x = 0;

  // Right arm — raised wave
  sk.rightShoulder.rotation.x = -1.5;   // raise arm up
  sk.rightShoulder.rotation.z = 0.5;    // out to the side
  // Forearm waves back and forth
  sk.rightArm.rotation.x = -0.6;
  sk.rightArm.rotation.z = Math.sin(t * 5.0) * 0.5;  // waving motion
}

function poseWalk(sk, t) {
  const speed = 6.0;
  const amp = 0.4;

  // Vertical bounce
  sk.root.position.y += Math.abs(Math.sin(t * speed * 2)) * 0.025;

  // Torso sway
  sk.spine.rotation.y = Math.sin(t * speed) * 0.04;
  sk.spine.rotation.z = Math.sin(t * speed) * 0.02;

  // Head counter-bob
  sk.head.rotation.x = Math.sin(t * speed * 2) * 0.04;

  // Arms swing opposite to legs
  sk.leftArm.rotation.x = Math.sin(t * speed) * amp * 0.7;
  sk.leftArm.rotation.z = -0.35;
  sk.rightArm.rotation.x = -Math.sin(t * speed) * amp * 0.7;
  sk.rightArm.rotation.z = 0.35;

  // Legs
  sk.leftUpperLeg.rotation.x = -Math.sin(t * speed) * amp;
  sk.rightUpperLeg.rotation.x = Math.sin(t * speed) * amp;

  // Feet follow through
  sk.leftFoot.rotation.x = Math.sin(t * speed + 0.5) * 0.15;
  sk.rightFoot.rotation.x = -Math.sin(t * speed + 0.5) * 0.15;
}

function poseRun(sk, t) {
  const speed = 7.6;
  const amp = 0.5;

  // Bigger bounce
  sk.root.position.y += Math.abs(Math.sin(t * speed * 2)) * 0.05;

  // Forward lean
  sk.spine.rotation.x = 0.15;
  sk.spine.rotation.y = Math.sin(t * speed) * 0.06;
  sk.spine.rotation.z = Math.sin(t * speed) * 0.03;

  // Head stabilization
  sk.head.rotation.x = -0.10 + Math.sin(t * speed * 2) * 0.05;

  // Arms pump hard
  sk.leftArm.rotation.x = Math.sin(t * speed) * amp * 1.1;
  sk.leftArm.rotation.z = -0.3;
  sk.rightArm.rotation.x = -Math.sin(t * speed) * amp * 1.1;
  sk.rightArm.rotation.z = 0.3;

  // Legs wide stride
  sk.leftUpperLeg.rotation.x = -Math.sin(t * speed) * amp * 1.1;
  sk.rightUpperLeg.rotation.x = Math.sin(t * speed) * amp * 1.1;

  // Feet push-off
  sk.leftFoot.rotation.x = Math.sin(t * speed + 0.8) * 0.3;
  sk.rightFoot.rotation.x = -Math.sin(t * speed + 0.8) * 0.3;
}

function poseSitDown(sk, t, charGroup) {
  // Sitting pose — knees bent forward, back slightly reclined, arms resting on thighs
  const breath = Math.sin(t * 1.5);

  // ── Compute root Y so hips rest exactly on seatLevelY ──
  if (seatLevelY !== null && charGroup) {
    const s = charGroup.scale.x; // uniform scale
    const parentY = charGroup.parent ? charGroup.parent.position.y : 0;
    // We want: root.y_local * scale + parentY = seatLevelY
    // root.y_local = (seatLevelY - parentY) / scale
    sk.root.position.y = (seatLevelY - parentY) / s;
  } else {
    // Fallback: hardcoded drop
    sk.root.position.y -= 0.06;
  }

  // Spine leans back slightly
  sk.spine.rotation.x = -0.15 + breath * 0.01;
  sk.spine.rotation.z = Math.sin(t * 0.6) * 0.008;

  // Head gentle idle motion
  sk.head.rotation.x = 0.05 + Math.sin(t * 0.7) * 0.03;
  sk.head.rotation.y = Math.sin(t * 0.4) * 0.05;

  // Upper legs rotated forward (thighs horizontal)
  sk.leftUpperLeg.rotation.x = -1.3;
  sk.rightUpperLeg.rotation.x = -1.3;

  // Feet angled down (shins vertical)
  sk.leftFoot.rotation.x = 1.3;
  sk.rightFoot.rotation.x = 1.3;

  // Arms resting — slightly forward and down, hands on thighs
  sk.leftArm.rotation.z = -0.35;
  sk.leftArm.rotation.x = 0.4;
  sk.rightArm.rotation.z = 0.35;
  sk.rightArm.rotation.x = 0.4;

  // Shoulders slightly relaxed
  sk.leftShoulder.rotation.x = 0.1;
  sk.rightShoulder.rotation.x = 0.1;
}

/**
 * poseSitJump — transition animation: character hops from walk-arrival point
 * toward the bench, turns mid-air, and lands seated.
 * progress goes from 0 → 1 over SIT_JUMP_DURATION.
 *   0..0.35  = launch phase — crouch then spring up, legs tuck
 *   0.35..0.65 = in-air phase — high arc, body rotates, legs begin to extend
 *   0.65..1.0 = landing phase — legs fold into sit, body settles onto seat
 */
function poseSitJump(sk, t, progress, charGroup) {
  // Full parabolic arc peaking at 0.4
  const jumpPeak = 0.4;
  let arc;
  if (progress < jumpPeak) {
    const p = progress / jumpPeak;
    arc = Math.sin(p * Math.PI * 0.5); // 0→1 going up
  } else {
    const p = (progress - jumpPeak) / (1.0 - jumpPeak);
    arc = Math.cos(p * Math.PI * 0.5); // 1→0 coming down
  }

  // Bigger hop height so it's clearly visible while travelling to the bench
  sk.root.position.y += arc * 0.18;

  // Sit blend — starts blending into sit pose during landing phase
  const sitBlend = progress < 0.6 ? 0 : Math.min(1, (progress - 0.6) / 0.4);

  // ── Legs ──
  // During launch+air: tuck up (knees to chest). During landing: fold into sit.
  const tuckAngle = arc * 1.0;          // strong tuck during flight
  const sitLegAngle = sitBlend * 1.3;   // sit angle
  const legX = -Math.max(tuckAngle, sitLegAngle);
  sk.leftUpperLeg.rotation.x = legX;
  sk.rightUpperLeg.rotation.x = legX;

  // Feet: tuck up during flight, extend down for sit
  const footTuck = -arc * 0.6;
  const footSit = sitBlend * 1.3;
  sk.leftFoot.rotation.x = footTuck + footSit;
  sk.rightFoot.rotation.x = footTuck + footSit;

  // ── Arms ──
  // During launch: swing up for momentum. During air: spread. During land: rest on thighs.
  const armRaise = arc * 0.9;
  const armSitX = sitBlend * 0.4;
  sk.leftArm.rotation.x = -armRaise + armSitX;
  sk.leftArm.rotation.z = -0.35 - arc * 0.35;
  sk.rightArm.rotation.x = -armRaise + armSitX;
  sk.rightArm.rotation.z = 0.35 + arc * 0.35;

  sk.leftShoulder.rotation.x = -arc * 0.6 + sitBlend * 0.1;
  sk.rightShoulder.rotation.x = -arc * 0.6 + sitBlend * 0.1;

  // ── Spine ──
  // Slight forward lean during launch, arch during flight, lean back for sit
  const launchLean = progress < 0.2 ? progress / 0.2 * 0.15 : 0.15 * (1 - arc);
  sk.spine.rotation.x = launchLean - arc * 0.12 + sitBlend * (-0.15);

  // ── Head ──
  // Look up during jump arc, settle forward during sit
  sk.head.rotation.x = -arc * 0.2 + sitBlend * 0.05;

  // ── Root Y: blend toward seat level during landing ──
  if (seatLevelY !== null && charGroup && sitBlend > 0) {
    const s = charGroup.scale.x;
    const parentY = charGroup.parent ? charGroup.parent.position.y : 0;
    const seatRootY = (seatLevelY - parentY) / s;
    sk.root.position.y = sk.root.position.y + (seatRootY - sk.root.position.y) * sitBlend;
  } else {
    sk.root.position.y -= sitBlend * 0.06;
  }
}

/**
 * poseStandJump — transition from sitting to standing.
 * progress 0 → 1:
 *   0..0.3  = push off: hands push on bench, lean forward, unfold legs
 *   0.3..0.6 = hop up: body lifts, legs straighten, arms swing up
 *   0.6..1.0 = land: settle into standing idle pose
 */
function poseStandJump(sk, t, progress, charGroup) {
  // Phase helpers
  const pushPhase = Math.min(1, progress / 0.3);              // 0→1 over 0..0.3
  const hopPhase = progress < 0.3 ? 0 : Math.min(1, (progress - 0.3) / 0.3); // 0→1 over 0.3..0.6
  const landPhase = progress < 0.6 ? 0 : Math.min(1, (progress - 0.6) / 0.4); // 0→1 over 0.6..1.0

  // Jump arc — bigger hop for visibility
  const hopArc = progress < 0.2 ? 0 : Math.sin(Math.min(1, (progress - 0.2) / 0.55) * Math.PI);

  // ── Root Y: blend from seat level up to standing with a visible hop ──
  if (seatLevelY !== null && charGroup) {
    const s = charGroup.scale.x;
    const parentY = charGroup.parent ? charGroup.parent.position.y : 0;
    const seatRootY = (seatLevelY - parentY) / s;
    const standRootY = charGroup.userData.charParts ? charGroup.userData.charParts.bodyBaseY : 0;
    // Blend from seat to standing, plus a visible hop arc on top
    const baseY = seatRootY + (standRootY - seatRootY) * Math.min(1, progress / 0.5);
    sk.root.position.y = baseY + hopArc * 0.15;
  } else {
    sk.root.position.y += hopArc * 0.15;
  }

  // ── Legs: from bent (sitting) to straight ──
  const sitLeg = -1.3 * (1 - pushPhase);   // unfold from -1.3 to 0
  const tuckLeg = -hopArc * 0.4;           // tuck during hop
  sk.leftUpperLeg.rotation.x = sitLeg + tuckLeg;
  sk.rightUpperLeg.rotation.x = sitLeg + tuckLeg;

  // Feet: from bent (sitting) to straight
  const sitFoot = 1.3 * (1 - pushPhase);
  const tuckFoot = -hopArc * 0.2;
  sk.leftFoot.rotation.x = sitFoot + tuckFoot;
  sk.rightFoot.rotation.x = sitFoot + tuckFoot;

  // ── Spine: lean forward during push, straighten during hop+land ──
  sk.spine.rotation.x = pushPhase * 0.2 - hopPhase * 0.2 - landPhase * 0.05;

  // ── Arms: push down during push phase, swing up during hop, relax on land ──
  const armPush = pushPhase * 0.6;  // push down
  const armSwing = -hopArc * 0.8;   // swing up
  const armRelax = landPhase * 0.45; // relax to idle
  sk.leftArm.rotation.x = armPush + armSwing;
  sk.leftArm.rotation.z = -0.35 - hopArc * 0.3 + landPhase * 0.1;
  sk.rightArm.rotation.x = armPush + armSwing;
  sk.rightArm.rotation.z = 0.35 + hopArc * 0.3 - landPhase * 0.1;

  sk.leftShoulder.rotation.x = -hopArc * 0.5;
  sk.rightShoulder.rotation.x = -hopArc * 0.5;

  // ── Head: look up during hop, settle ──
  sk.head.rotation.x = -hopArc * 0.15 + landPhase * 0.03;
}

/**
 * poseFenceLeap — lamb-like leap over a fence.
 * progress 0 → 1:
 *   0..0.2   = crouch & gather — knees bend, body lowers, arms pull back
 *   0.2..0.55 = launch & soar — spring up high, legs tuck, arms spread wide
 *   0.55..0.8 = clear & extend — peak of arc, legs extend forward for landing
 *   0.8..1.0  = land & absorb — touch down, knees bend to absorb, straighten up
 */
function poseFenceLeap(sk, t, progress) {
  // Phase helpers
  const crouch = progress < 0.2 ? progress / 0.2 : 1;
  const launch = progress < 0.2 ? 0 : progress < 0.55 ? (progress - 0.2) / 0.35 : 1;
  const soar = progress < 0.2 ? 0 : progress < 0.8 ? Math.sin(((progress - 0.2) / 0.6) * Math.PI) : 0;
  const land = progress < 0.8 ? 0 : (progress - 0.8) / 0.2;

  // Jump arc — high parabolic hop like a lamb
  const arcRaw = progress < 0.15 ? 0 : progress > 0.9 ? 0
    : Math.sin(((progress - 0.15) / 0.75) * Math.PI);
  const arc = arcRaw * arcRaw; // squash for sharper peak

  // Root Y: big hop (0.35 units at peak)
  sk.root.position.y += arc * 0.35;

  // ── Crouch phase: lower body, bend knees ──
  const crouchDrop = crouch * (1 - launch) * 0.08;
  sk.root.position.y -= crouchDrop;

  // ── Legs ──
  // Crouch: bend knees deeply. Soar: tuck legs up (lamb-like). Land: bend to absorb.
  const crouchLeg = crouch * (1 - launch) * 0.8;    // deep bend during crouch
  const tuckLeg = soar * 1.1;                        // strong tuck during flight
  const landBend = land * 0.5;                        // absorption bend on landing
  sk.leftUpperLeg.rotation.x = -crouchLeg - tuckLeg - landBend;
  sk.rightUpperLeg.rotation.x = -crouchLeg - tuckLeg - landBend;

  // Feet: curl up during flight, straighten on land
  const footTuck = -soar * 0.7;                       // curl up in flight
  const footCrouch = crouch * (1 - launch) * 0.4;
  const footLand = land * 0.3;
  sk.leftFoot.rotation.x = footCrouch + footTuck + footLand;
  sk.rightFoot.rotation.x = footCrouch + footTuck + footLand;

  // Stagger legs slightly for a more natural galloping look
  sk.leftUpperLeg.rotation.x += soar * 0.15;
  sk.rightUpperLeg.rotation.x -= soar * 0.15;

  // ── Arms ──
  // Crouch: pull back. Soar: spread wide and up (joyful lamb). Land: bring down.
  const armBack = crouch * (1 - launch) * 0.5;       // pull back during crouch
  const armSpread = soar * 1.2;                        // spread wide in flight
  const armDown = land * 0.45;                         // bring down on landing

  sk.leftArm.rotation.x = armBack - armSpread;
  sk.leftArm.rotation.z = -0.35 - armSpread * 0.6 + armDown * 0.25;
  sk.rightArm.rotation.x = armBack - armSpread;
  sk.rightArm.rotation.z = 0.35 + armSpread * 0.6 - armDown * 0.25;

  sk.leftShoulder.rotation.x = -soar * 0.8;
  sk.leftShoulder.rotation.z = -soar * 0.3;
  sk.rightShoulder.rotation.x = -soar * 0.8;
  sk.rightShoulder.rotation.z = soar * 0.3;

  // ── Spine ──
  // Crouch: lean forward. Soar: arch back (lamb joy). Land: straighten.
  const spineCrouch = crouch * (1 - launch) * 0.2;
  const spineArch = -soar * 0.2;
  const spineLand = land * 0.05;
  sk.spine.rotation.x = spineCrouch + spineArch + spineLand;

  // ── Head ──
  // Look down during crouch, up during soar, settle on land
  sk.head.rotation.x = crouch * (1 - launch) * 0.15 - soar * 0.25 + land * 0.05;
}

function poseJump(sk, t, progress) {
  const air = Math.sin(progress * Math.PI);

  // Tuck legs
  sk.leftUpperLeg.rotation.x = -air * 0.6;
  sk.rightUpperLeg.rotation.x = -air * 0.6;
  sk.leftFoot.rotation.x = -air * 0.3;
  sk.rightFoot.rotation.x = -air * 0.3;

  // Arms raise up high — hands reaching for the sky
  sk.leftShoulder.rotation.x = -air * 1.2;
  sk.leftShoulder.rotation.z = -air * 0.3;
  sk.leftArm.rotation.x = -air * 0.8;
  sk.leftArm.rotation.z = -0.45 - air * 0.5;
  sk.leftHand.rotation.x = -air * 0.4;

  sk.rightShoulder.rotation.x = -air * 1.2;
  sk.rightShoulder.rotation.z = air * 0.3;
  sk.rightArm.rotation.x = -air * 0.8;
  sk.rightArm.rotation.z = 0.45 + air * 0.5;
  sk.rightHand.rotation.x = -air * 0.4;

  // Slight arch
  sk.spine.rotation.x = -air * 0.10;
  sk.head.rotation.x = air * 0.08;
}

// ── Pose snapshot for blending ──
const POSE_PROPS = [
  "spine.rotation.x", "spine.rotation.y", "spine.rotation.z",
  "head.rotation.x", "head.rotation.y", "head.rotation.z",
  "leftShoulder.rotation.x", "leftShoulder.rotation.z",
  "rightShoulder.rotation.x", "rightShoulder.rotation.z",
  "leftArm.rotation.x", "leftArm.rotation.z",
  "rightArm.rotation.x", "rightArm.rotation.z",
  "leftHand.rotation.x", "rightHand.rotation.x",
  "leftUpperLeg.rotation.x", "rightUpperLeg.rotation.x",
  "leftFoot.rotation.x", "rightFoot.rotation.x",
  "neck.rotation.x", "neck.rotation.y", "neck.rotation.z",
];

function getPropValue(sk, prop) {
  const parts = prop.split(".");
  let obj = sk[parts[0]];
  for (let i = 1; i < parts.length; i++) obj = obj[parts[i]];
  return obj;
}

function setPropValue(sk, prop, val) {
  const parts = prop.split(".");
  let obj = sk[parts[0]];
  for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]];
  obj[parts[parts.length - 1]] = val;
}

function captureSnapshot(sk) {
  const snap = {};
  POSE_PROPS.forEach((p) => (snap[p] = getPropValue(sk, p)));
  snap["_rootY"] = sk.root.position.y;
  return snap;
}

function applyBlend(sk, snapA, snapB, t) {
  POSE_PROPS.forEach((p) => {
    const a = snapA[p] !== undefined ? snapA[p] : 0;
    const b = snapB[p] !== undefined ? snapB[p] : 0;
    setPropValue(sk, p, a + (b - a) * t);
  });
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// ══════════════════════════════════════════════
// Main update — called each frame from scene.js
// ══════════════════════════════════════════════

export function updateSkeletonAnimation(charGroup, elapsed, delta, camera) {
  const sk = charGroup.userData.skeleton;
  if (!sk) return;

  const bodyBaseY = charGroup.userData.charParts.bodyBaseY;

  // ── Input lockout countdown ──
  if (inputLockoutTimer > 0) {
    inputLockoutTimer -= delta;
    if (inputLockoutTimer < 0) inputLockoutTimer = 0;
  }

  // ── Input detection ──
  const moveForward = keys.w || keys.z || keys.up;
  const moveBack = keys.s || keys.down;
  const moveLeft = keys.a || keys.q || keys.left;
  const moveRight = keys.d || keys.right;
  const rawManualMoving = moveForward || moveBack || moveLeft || moveRight;
  // During input lockout, ignore movement keys (so sit-jump from walking isn't immediately cancelled)
  const manualMoving = inputLockoutTimer > 0 ? false : rawManualMoving;
  const isRunning = manualMoving && keys.shift;

  // ── Cancel walk-to-target / sit if user presses movement keys or jump ──
  if (manualMoving || (inputLockoutTimer <= 0 && keys.space)) {
    if (walkTarget) {
      walkTarget = null;
      walkTargetFacing = null;
      walkTargetCb = null;
    }
    // If seated → trigger stand-jump instead of instantly cancelling
    if (forcedAnim === "sitdown") {
      triggerStandJump();
      // Don't process further movement until stand-jump finishes
    }
    // If mid sit-jump, cancel it
    if (forcedAnim === "sitjump") {
      forcedAnim = null;
      sitJumpActive = false;
      sitJumpTimer = 0;
      sitJumpStartPos = null;
      sitLockPos = null;
    }
    if (forcedAnim === "standjump" || forcedAnim === "fenceleap") {
      // Don't abruptly cancel stand-jump or fence leap — let them finish
      // so the character lands properly. Movement resumes after.
    }
  }

  // ── Sit-jump transition — overrides everything while active ──
  if (sitJumpActive) {
    // Capture snapshot on the very first frame for smooth blending
    if (sitJumpTimer === 0 && !prevPoseSnapshot) {
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
    }

    sitJumpTimer += delta;
    const progress = Math.min(sitJumpTimer / SIT_JUMP_DURATION, 1.0);

    // ── Move character from start position to seat position during the jump ──
    // Uses a smooth ease-in-out curve so the character arcs toward the bench
    if (sitJumpStartPos && sitLockPos) {
      const moveCurve = smoothstep(Math.min(1, progress / 0.85)); // arrive before anim ends
      characterPos.x = sitJumpStartPos.x + (sitLockPos.x - sitJumpStartPos.x) * moveCurve;
      characterPos.z = sitJumpStartPos.z + (sitLockPos.z - sitJumpStartPos.z) * moveCurve;
    } else if (sitLockPos) {
      characterPos.x = sitLockPos.x;
      characterPos.z = sitLockPos.z;
    }

    // Fast rotation toward target facing during the jump
    let rotDiffSJ = characterRotationTarget - characterRotation;
    while (rotDiffSJ > Math.PI) rotDiffSJ -= Math.PI * 2;
    while (rotDiffSJ < -Math.PI) rotDiffSJ += Math.PI * 2;
    characterRotation += rotDiffSJ * Math.min(1, 14 * delta);

    currentAnim = "sitjump";

    if (progress >= 1.0) {
      // Transition complete → lock at seat center, switch to seated idle
      if (sitLockPos) {
        characterPos.x = sitLockPos.x;
        characterPos.z = sitLockPos.z;
      }
      sitJumpActive = false;
      sitJumpTimer = 0;
      sitJumpStartPos = null;
      forcedAnim = "sitdown";
      currentAnim = "sitdown";
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
      lastAnim = "sitdown";
    }

    // Apply sit-jump pose
    sk.root.position.y = bodyBaseY;
    resetPose(sk);
    poseSitJump(sk, elapsed, progress, charGroup);

    // Blend from previous
    if (blendFactor < 1.0 && prevPoseSnapshot) {
      blendFactor = Math.min(1.0, blendFactor + delta * BLEND_SPEED);
      const targetSnap = captureSnapshot(sk);
      applyBlend(sk, prevPoseSnapshot, targetSnap, smoothstep(blendFactor));
    }

    // Apply position/rotation
    charGroup.position.x = characterPos.x;
    charGroup.position.z = characterPos.z;
    sk.root.rotation.y = characterRotation;

    // Compute AABB (fixed world-space extents, not scaled)
    const wx = characterPos.x;
    const wy = (charGroup.parent ? charGroup.parent.position.y : 0) + CHAR_HALF_H;
    const wz = characterPos.z;
    charAABB.min.set(wx - CHAR_HALF_W, wy - CHAR_HALF_H, wz - CHAR_HALF_D);
    charAABB.max.set(wx + CHAR_HALF_W, wy + CHAR_HALF_H, wz + CHAR_HALF_D);
    return; // skip the rest of the update
  }

  // ── Stand-jump transition — overrides everything while active ──
  if (standJumpActive) {
    if (standJumpTimer === 0 && !prevPoseSnapshot) {
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
    }

    standJumpTimer += delta;
    const progress = Math.min(standJumpTimer / STAND_JUMP_DURATION, 1.0);

    // During stand-jump, hop forward away from the bench
    if (sitLockPos) {
      // Hop further so the jump is clearly visible
      const hopCurve = Math.min(1, progress / 0.7);
      const hopForward = hopCurve * 0.3; // linear forward displacement
      const facingAngle = characterRotation;
      characterPos.x = sitLockPos.x + Math.sin(facingAngle) * hopForward;
      characterPos.z = sitLockPos.z + Math.cos(facingAngle) * hopForward;
    }

    currentAnim = "standjump";

    if (progress >= 1.0) {
      // Transition complete → back to idle
      standJumpActive = false;
      standJumpTimer = 0;
      forcedAnim = null;
      currentAnim = "idle";
      sitLockPos = null;
      seatLevelY = null;
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
      lastAnim = "idle";
    }

    // Apply stand-jump pose
    sk.root.position.y = bodyBaseY;
    resetPose(sk);
    poseStandJump(sk, elapsed, progress, charGroup);

    // Blend from previous
    if (blendFactor < 1.0 && prevPoseSnapshot) {
      blendFactor = Math.min(1.0, blendFactor + delta * BLEND_SPEED);
      const targetSnap = captureSnapshot(sk);
      applyBlend(sk, prevPoseSnapshot, targetSnap, smoothstep(blendFactor));
    }

    // Apply position/rotation
    charGroup.position.x = characterPos.x;
    charGroup.position.z = characterPos.z;
    sk.root.rotation.y = characterRotation;

    // Compute AABB (fixed world-space extents, not scaled)
    const wx = characterPos.x;
    const wy = (charGroup.parent ? charGroup.parent.position.y : 0) + CHAR_HALF_H;
    const wz = characterPos.z;
    charAABB.min.set(wx - CHAR_HALF_W, wy - CHAR_HALF_H, wz - CHAR_HALF_D);
    charAABB.max.set(wx + CHAR_HALF_W, wy + CHAR_HALF_H, wz + CHAR_HALF_D);
    return; // skip the rest of the update
  }

  // ── Fence leap cooldown ──
  if (fenceLeapCooldown > 0) {
    fenceLeapCooldown -= delta;
    if (fenceLeapCooldown < 0) fenceLeapCooldown = 0;
  }

  // ── Fence leap transition — overrides everything while active ──
  if (fenceLeapActive) {
    if (fenceLeapTimer === 0 && !prevPoseSnapshot) {
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
    }

    fenceLeapTimer += delta;
    const progress = Math.min(fenceLeapTimer / FENCE_LEAP_DURATION, 1.0);

    // Move character from start to end along the leap arc
    if (fenceLeapStartPos && fenceLeapEndPos) {
      const moveCurve = smoothstep(Math.min(1, progress / 0.9));
      characterPos.x = fenceLeapStartPos.x + (fenceLeapEndPos.x - fenceLeapStartPos.x) * moveCurve;
      characterPos.z = fenceLeapStartPos.z + (fenceLeapEndPos.z - fenceLeapStartPos.z) * moveCurve;
    }

    // Keep facing the leap direction
    characterRotation = fenceLeapFacing;
    characterRotationTarget = fenceLeapFacing;

    currentAnim = "fenceleap";

    if (progress >= 1.0) {
      // Leap complete — resume normal movement
      fenceLeapActive = false;
      fenceLeapTimer = 0;
      forcedAnim = null;
      currentAnim = "idle";
      fenceLeapStartPos = null;
      fenceLeapEndPos = null;
      fenceLeapCooldown = 1.0; // 1 second cooldown before re-triggering
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
      lastAnim = "idle";
    }

    // Apply fence leap pose
    sk.root.position.y = bodyBaseY;
    resetPose(sk);
    poseFenceLeap(sk, elapsed, progress);

    // Blend from previous
    if (blendFactor < 1.0 && prevPoseSnapshot) {
      blendFactor = Math.min(1.0, blendFactor + delta * BLEND_SPEED);
      const targetSnap = captureSnapshot(sk);
      applyBlend(sk, prevPoseSnapshot, targetSnap, smoothstep(blendFactor));
    }

    // Apply position/rotation
    charGroup.position.x = characterPos.x;
    charGroup.position.z = characterPos.z;
    sk.root.rotation.y = characterRotation;

    // Compute AABB
    const wx = characterPos.x;
    const wy = (charGroup.parent ? charGroup.parent.position.y : 0) + CHAR_HALF_H;
    const wz = characterPos.z;
    charAABB.min.set(wx - CHAR_HALF_W, wy - CHAR_HALF_H, wz - CHAR_HALF_D);
    charAABB.max.set(wx + CHAR_HALF_W, wy + CHAR_HALF_H, wz + CHAR_HALF_D);
    return; // skip the rest of the update
  }

  // ── Walk-to-target auto-movement ──
  let autoWalking = false;
  if (walkTarget && !forcedAnim) {
    const dx = walkTarget.x - characterPos.x;
    const dz = walkTarget.z - characterPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < WALK_TO_ARRIVE_DIST) {
      // Arrived — snap position, set final facing, fire callback
      characterPos.x = walkTarget.x;
      characterPos.z = walkTarget.z;
      if (walkTargetFacing !== null) {
        characterRotationTarget = walkTargetFacing;
      }
      const cb = walkTargetCb;
      walkTarget = null;
      walkTargetFacing = null;
      walkTargetCb = null;
      if (cb) cb();
    } else {
      // Walk toward target
      autoWalking = true;
      const speed = 0.35;
      const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
      characterPos.x += moveDir.x * speed * delta;
      characterPos.z += moveDir.z * speed * delta;
      characterRotationTarget = Math.atan2(moveDir.x, moveDir.z);
    }
  }

  // ── Lock position while seated ──
  if (forcedAnim === "sitdown" && sitLockPos) {
    characterPos.x = sitLockPos.x;
    characterPos.z = sitLockPos.z;
  }

  const isMoving = manualMoving || autoWalking;

  // ── Determine animation state ──
  let newAnim;
  if (forcedAnim === "sitdown") {
    newAnim = "sitdown";
  } else if (isRunning) {
    newAnim = "run";
  } else if (autoWalking) {
    newAnim = "walk";
  } else if (manualMoving) {
    newAnim = isRunning ? "run" : "walk";
  } else {
    newAnim = "idle";
  }

  // ── Jump trigger ──
  if (keys.space && !isJumping && newAnim !== "sitdown") {
    isJumping = true;
    jumpVelocity = JUMP_FORCE;
    jumpHeight = 0;
  }

  // ── Jump physics ──
  if (isJumping) {
    jumpVelocity += GRAVITY * delta;
    jumpHeight += jumpVelocity * delta;
    if (jumpHeight <= 0) {
      jumpHeight = 0;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // ── Idle wave timer ──
  if (newAnim === "idle") {
    idleTimer += delta;
    if (idleTimer >= WAVE_DELAY && !isWaving) {
      isWaving = true;
      prevPoseSnapshot = captureSnapshot(sk);
      blendFactor = 0;
    }
  } else {
    idleTimer = 0;
    isWaving = false;
  }

  // ── Blend on animation change ──
  if (newAnim !== lastAnim && !isJumping) {
    prevPoseSnapshot = captureSnapshot(sk);
    blendFactor = 0;
    lastAnim = newAnim;
  }
  currentAnim = newAnim;

  // ── Movement direction relative to camera (manual input only, not auto-walk) ──
  if (manualMoving && newAnim !== "sitdown" && !autoWalking) {
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();
    const cameraRight = new THREE.Vector3().crossVectors(
      cameraDir,
      new THREE.Vector3(0, 1, 0)
    ).normalize();

    const moveDir = new THREE.Vector3();
    if (moveForward) moveDir.add(cameraDir);
    if (moveBack) moveDir.sub(cameraDir);
    if (moveRight) moveDir.add(cameraRight);
    if (moveLeft) moveDir.sub(cameraRight);
    moveDir.normalize();

    const speed = isRunning ? 0.84 : 0.35;
    characterPos.x += moveDir.x * speed * delta;
    characterPos.z += moveDir.z * speed * delta;

    // Face movement direction
    characterRotationTarget = Math.atan2(moveDir.x, moveDir.z);
  }

  // ── Smooth rotation ──
  let rotDiff = characterRotationTarget - characterRotation;
  while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  // Faster rotation when sitting (snapping to final direction)
  const rotSpeed = forcedAnim === "sitdown" ? 14 : 8;
  characterRotation += rotDiff * Math.min(1, rotSpeed * delta);

  // ── Apply animation pose ──
  sk.root.position.y = bodyBaseY + jumpHeight;
  resetPose(sk);

  if (currentAnim === "sitdown") {
    poseSitDown(sk, elapsed, charGroup);
  } else if (isJumping) {
    const maxH = (JUMP_FORCE * JUMP_FORCE) / (2 * Math.abs(GRAVITY));
    const progress = jumpHeight / maxH;
    if (currentAnim === "run") poseRun(sk, elapsed);
    else if (currentAnim === "walk") poseWalk(sk, elapsed);
    else poseIdle(sk, elapsed);
    poseJump(sk, elapsed, progress);
  } else if (currentAnim === "run") {
    poseRun(sk, elapsed);
  } else if (currentAnim === "walk") {
    poseWalk(sk, elapsed);
  } else if (isWaving) {
    poseWave(sk, elapsed);
  } else {
    poseIdle(sk, elapsed);
  }

  // ── Blend from previous pose ──
  if (blendFactor < 1.0 && prevPoseSnapshot) {
    blendFactor = Math.min(1.0, blendFactor + delta * BLEND_SPEED);
    const targetSnap = captureSnapshot(sk);
    applyBlend(sk, prevPoseSnapshot, targetSnap, smoothstep(blendFactor));
  }

  // ── Clamp position to landscape bounds ──
  const BOUNDS = 2.7; // half-size of landscape walkable area
  characterPos.x = Math.max(-BOUNDS, Math.min(BOUNDS, characterPos.x));
  characterPos.z = Math.max(-BOUNDS, Math.min(BOUNDS, characterPos.z));

  // ── Apply world position and rotation ──
  charGroup.position.x = characterPos.x;
  charGroup.position.z = characterPos.z;
  sk.root.rotation.y = characterRotation;

  // ── Compute character AABB in world space ──
  // Fixed world-space extents (not scaled by character scale)
  const wx = characterPos.x;
  const wy = (charGroup.parent ? charGroup.parent.position.y : 0) + CHAR_HALF_H;
  const wz = characterPos.z;
  charAABB.min.set(wx - CHAR_HALF_W, wy - CHAR_HALF_H, wz - CHAR_HALF_D);
  charAABB.max.set(wx + CHAR_HALF_W, wy + CHAR_HALF_H, wz + CHAR_HALF_D);
}

// ── Reset character position (e.g. when switching slides) ──
export function resetCharacterPosition(startX, startZ) {
  characterPos.set(startX ?? 0, 0, startZ ?? 0);
  characterRotation = initialFacing;
  characterRotationTarget = initialFacing;
  isJumping = false;
  jumpVelocity = 0;
  jumpHeight = 0;
  currentAnim = "idle";
  lastAnim = "idle";
  blendFactor = 1.0;
  prevPoseSnapshot = null;
  idleTimer = 0;
  isWaving = false;
  forcedAnim = null;
  walkTarget = null;
  walkTargetFacing = null;
  walkTargetCb = null;
  sitJumpStartPos = null;
  sitLockPos = null;
  sitJumpActive = false;
  sitJumpTimer = 0;
  standJumpActive = false;
  standJumpTimer = 0;
  seatLevelY = null;
  fenceLeapActive = false;
  fenceLeapTimer = 0;
  fenceLeapStartPos = null;
  fenceLeapEndPos = null;
  fenceLeapCooldown = 0;
  inputLockoutTimer = 0;
}

// ── Force a specific animation state (called externally) ──
export function setForcedAnimation(animName) {
  forcedAnim = animName;
}

// ── Set walk-to-target (called externally, e.g. by InteractionBox click) ──
export function setWalkTarget(targetPos, facingAngle, onArrive) {
  // Cancel any existing sit state
  if (forcedAnim === "sitdown" || forcedAnim === "sitjump") {
    forcedAnim = null;
    sitJumpActive = false;
    sitJumpTimer = 0;
    sitLockPos = null;
  }
  walkTarget = targetPos.clone();
  walkTargetFacing = facingAngle !== undefined ? facingAngle : null;
  walkTargetCb = onArrive || null;
}

// ── Set the world-space seat level Y (called externally) ──
export function setSeatLevel(y) {
  seatLevelY = (y !== undefined && y !== null) ? y : null;
}

// ── Lock input temporarily (called when auto-sit triggers from walking into bench) ──
export function lockInput(duration) {
  inputLockoutTimer = duration !== undefined ? duration : INPUT_LOCKOUT_DURATION;
}

// ── Trigger the sit-jump transition (mini hop → rotate → land into sit) ──
// startPos = where the character is when the jump begins (walk arrival point)
// lockPos  = where the character should land (seat center)
export function triggerSitJump(lockPos, facingAngle, startPos) {
  sitJumpStartPos = startPos ? startPos.clone() : characterPos.clone();
  sitLockPos = lockPos ? lockPos.clone() : characterPos.clone();
  sitJumpActive = true;
  sitJumpTimer = 0;
  sitJumpStartY = 0;
  forcedAnim = "sitjump";
  if (facingAngle !== undefined) {
    characterRotationTarget = facingAngle;
  }
  prevPoseSnapshot = null;
  blendFactor = 0;
}

// ── Trigger fence leap (lamb-like hop over a fence) ──
// startPos = where the character is when the leap begins
// endPos = landing position on the other side of the fence
// facing = angle the character faces during the leap
export function triggerFenceLeap(startPos, endPos, facing) {
  // Respect cooldown
  if (fenceLeapCooldown > 0) return;
  // Don't leap if already in a forced animation
  if (forcedAnim) return;

  fenceLeapStartPos = startPos.clone();
  fenceLeapEndPos = endPos.clone();
  fenceLeapFacing = facing;
  fenceLeapActive = true;
  fenceLeapTimer = 0;
  forcedAnim = "fenceleap";
  characterRotationTarget = facing;
  characterRotation = facing;
  // Cancel any walk-to-target
  walkTarget = null;
  walkTargetFacing = null;
  walkTargetCb = null;
  // Lock input during leap
  lockInput(FENCE_LEAP_DURATION + 0.2);
  prevPoseSnapshot = null;
  blendFactor = 0;
}

// ── Trigger the stand-jump transition (hop off bench → land standing) ──
export function triggerStandJump() {
  standJumpActive = true;
  standJumpTimer = 0;
  forcedAnim = "standjump";
  // sitLockPos stays set so we can hop forward from it
  prevPoseSnapshot = null; // will be captured on next frame
  blendFactor = 0;
}

// ── Get current animation state (for external use) ──
export function getAnimState() {
  const moveForward = keys.w || keys.z || keys.up;
  const moveBack = keys.s || keys.down;
  const moveLeft = keys.a || keys.q || keys.left;
  const moveRight = keys.d || keys.right;
  const isMoving = moveForward || moveBack || moveLeft || moveRight;
  const moveForwardOnly = moveForward && !moveBack && !moveLeft && !moveRight;
  return { currentAnim, isJumping, isWaving, isMoving, moveBack, moveLeft, moveRight, moveForwardOnly, characterPos, characterRotation, forcedAnim, isSitting: forcedAnim === "sitdown", isLeaping: forcedAnim === "fenceleap", fenceLeapCooldown, charAABB };
}