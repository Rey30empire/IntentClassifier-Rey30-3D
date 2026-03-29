// ─── Player Controller ───
import * as THREE from 'three/webgpu';

export class PlayerController {
  constructor(scene, startPos) {
    this.scene = scene;
    const s = window.CELL_SIZE || 0.6;

    // Simple sphere character
    const geo = new THREE.SphereGeometry(0.25 * s, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xffeedd,
      emissiveIntensity: 0.15
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(startPos.x * s, (startPos.y + 0.25) * s, startPos.z * s);
    scene.add(this.mesh);

    // Hat (cone on top — monument valley style)
    const hatGeo = new THREE.ConeGeometry(0.15 * s, 0.35 * s, 8);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.05 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 0.35;
    this.mesh.add(hat);

    this.gridPos = { x: startPos.x, y: startPos.y, z: startPos.z };
    this.path = [];
    this.moving = false;
    this.moveSpeed = 4.0;
    this.targetPos = null;
    this.bobTime = 0;

    // Hop animation state
    this.hopProgress = 0;     // 0..1 progress through current hop
    this.hopStartPos = null;  // world position at hop start
    this.hopEndPos = null;    // world position at hop end
    this.hopHeight = 0.18 * s; // peak height of the hop arc
    this.squashTime = 0;      // squash-and-stretch timer
    this.landing = false;     // true during landing squash
    this.ridingBlock = false; // true when riding a movable block during drag

    // Dust puff particle pool
    this.dustPuffs = [];
    const dustCount = 8; // particles per puff
    const dustGeo = new THREE.PlaneGeometry(0.12 * s, 0.12 * s);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xddccaa,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    for (let i = 0; i < dustCount; i++) {
      const p = new THREE.Mesh(dustGeo, dustMat.clone());
      p.name = 'dustPuff_' + i;
      p.visible = false;
      p.userData = { life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, active: false };
      scene.add(p);
      this.dustPuffs.push(p);
    }
    this.dustIndex = 0; // round-robin index into pool

    // ── Subtle hop / land sounds (Web Audio API) ──
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.08; // very quiet overall
      this.masterGain.connect(this.audioCtx.destination);
    } catch (_) {
      this.audioCtx = null;
    }
  }

  /** Resume audio context on first interaction (browsers require user gesture) */
  _resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /** Soft "pop" when starting a hop */
  _playHopSound() {
    if (!this.audioCtx) return;
    this._resumeAudio();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const hopVar = (Math.random() - 0.5) * 100; // ±50Hz variation
    osc.frequency.setValueAtTime(520 + hopVar, now);
    osc.frequency.exponentialRampToValueAtTime(780 + hopVar, now + 0.06);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Gentle thud when landing */
  _playLandSound() {
    if (!this.audioCtx) return;
    this._resumeAudio();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Low thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const landVar = (Math.random() - 0.5) * 100; // ±50Hz variation
    osc.frequency.setValueAtTime(180 + landVar, now);
    osc.frequency.exponentialRampToValueAtTime(60 + landVar, now + 0.1);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Tiny noise burst for texture
    const bufSize = ctx.sampleRate * 0.05;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.12, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  followPath(path, cs) {
    this.cellSize = cs || window.CELL_SIZE || 0.6;
    this.path = path.slice();
    this.moving = true;
    this.hopHeight = 0.18 * this.cellSize;
    this.nextTarget();
  }

  spawnDustPuff(pos) {
    const s = this.cellSize || window.CELL_SIZE || 0.6;
    const count = this.dustPuffs.length;
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex + i) % count;
      const p = this.dustPuffs[idx];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (0.3 + Math.random() * 0.5) * s;
      p.position.set(pos.x, pos.y + 0.02 * s, pos.z);
      p.userData.vx = Math.cos(angle) * speed;
      p.userData.vy = (0.2 + Math.random() * 0.4) * s;
      p.userData.vz = Math.sin(angle) * speed;
      p.userData.life = 0;
      p.userData.maxLife = 0.3 + Math.random() * 0.2;
      p.userData.active = true;
      p.material.opacity = 0.6;
      p.scale.setScalar(0.6 + Math.random() * 0.6);
      p.visible = true;
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    }
    this.dustIndex = (this.dustIndex + count) % count;
  }

  nextTarget() {
    if (this.path.length === 0) {
      this.moving = false;
      this.landing = true;
      this.squashTime = 0;
      this.mesh.scale.set(1, 1, 1);
      this.spawnDustPuff(this.mesh.position);
      return;
    }
    const next = this.path.shift();
    const s = this.cellSize || window.CELL_SIZE || 0.6;

    this.hopStartPos = this.mesh.position.clone();
    this.hopEndPos = new THREE.Vector3(next.x * s, (next.y + 0.25) * s, next.z * s);
    this.hopProgress = 0;
    this.gridPos = { x: next.x, y: next.y, z: next.z };

    // Adjust hop height based on elevation change
    const dy = this.hopEndPos.y - this.hopStartPos.y;
    this.hopHeight = (0.18 + Math.abs(dy) * 0.3) * s;

    // Play subtle hop sound
    this._playHopSound();
  }

  update(dt) {
    this.bobTime += dt;
    const s = this.cellSize || window.CELL_SIZE || 0.6;

    if (this.moving && this.hopStartPos && this.hopEndPos) {
      // Advance hop progress
      const hopDist = this.hopStartPos.distanceTo(this.hopEndPos);
      const hopDuration = Math.max(hopDist / this.moveSpeed, 0.12);
      this.hopProgress += dt / hopDuration;

      if (this.hopProgress >= 1.0) {
        // Land at exact target
        this.hopProgress = 1.0;
        this.mesh.position.copy(this.hopEndPos);
        this.mesh.scale.set(1, 1, 1);

        // Trigger landing squash + dust + sound
        this.landing = true;
        this.squashTime = 0;
        this.spawnDustPuff(this.hopEndPos);
        this._playLandSound();

        this.nextTarget();
      } else {
        // Smooth ease-in-out
        const t = this.hopProgress;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Interpolate XZ position
        const x = this.hopStartPos.x + (this.hopEndPos.x - this.hopStartPos.x) * ease;
        const z = this.hopStartPos.z + (this.hopEndPos.z - this.hopStartPos.z) * ease;

        // Y: linear interpolation + parabolic arc for hop
        const baseY = this.hopStartPos.y + (this.hopEndPos.y - this.hopStartPos.y) * ease;
        const arc = 4 * t * (1 - t); // parabola peaking at t=0.5
        const y = baseY + arc * this.hopHeight;

        this.mesh.position.set(x, y, z);

        // Squash and stretch during hop
        const stretch = 1 + arc * 0.2;  // stretch up at peak
        const squash = 1 - arc * 0.1;   // squash width at peak
        this.mesh.scale.set(squash, stretch, squash);

        // Slight forward tilt during hop
        const tilt = Math.sin(t * Math.PI) * 0.15;
        const dir = new THREE.Vector3().subVectors(this.hopEndPos, this.hopStartPos).normalize();
        this.mesh.rotation.x = tilt * dir.z;
        this.mesh.rotation.z = -tilt * dir.x;
      }
    }

    // Landing squash recovery
    if (this.landing) {
      this.squashTime += dt;
      const landDur = 0.2;
      const lt = Math.min(this.squashTime / landDur, 1.0);
      // Quick squash then bounce back
      const squashCurve = Math.sin(lt * Math.PI);
      this.mesh.scale.set(1 + squashCurve * 0.12, 1 - squashCurve * 0.15, 1 + squashCurve * 0.12);
      this.mesh.rotation.x *= (1 - lt);
      this.mesh.rotation.z *= (1 - lt);
      if (lt >= 1.0) {
        this.landing = false;
        this.mesh.scale.set(1, 1, 1);
        this.mesh.rotation.set(0, 0, 0);
      }
    }

    // Animate dust puffs
    for (let i = 0; i < this.dustPuffs.length; i++) {
      const p = this.dustPuffs[i];
      if (!p.userData.active) continue;
      p.userData.life += dt;
      const t = p.userData.life / p.userData.maxLife;
      if (t >= 1.0) {
        p.visible = false;
        p.userData.active = false;
        continue;
      }
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy *= 0.92; // slow down vertical rise
      p.material.opacity = 0.6 * (1 - t) * (1 - t); // fade out
      const grow = 1 + t * 1.5; // expand as it fades
      p.scale.setScalar((0.6 + Math.random() * 0.1) * grow);
      p.rotation.z += dt * 1.5; // gentle spin
    }

    // Gentle idle bob when stationary (skip if riding a movable block)
    if (!this.moving && !this.landing && !this.ridingBlock) {
      this.mesh.position.y = (this.gridPos.y + 0.25) * s + Math.sin(this.bobTime * 2) * 0.04 * s;
      this.mesh.rotation.set(0, 0, 0);
    }
  }
}