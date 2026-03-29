// ══════════════════════════════════════════════
// GAME — Level system, scoring, lives, tile effects
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';
import { createCharacter } from './character.js';
import { createTile } from './tile.js';
import { TILE_SIZE, TILE_GAP, TILE_HEIGHT } from './grid.js';

// ── Sound FX via Web Audio API ──
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  switch (type) {
    case 'move':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'coin':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      { const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
        o2.connect(g2); g2.connect(audioCtx.destination); o2.type = 'sine';
        o2.frequency.setValueAtTime(1320, now + 0.1);
        g2.gain.setValueAtTime(0.15, now + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        o2.start(now + 0.1); o2.stop(now + 0.35); }
      break;
    case 'hurt':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'star':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
      break;
    case 'gameover':
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.6);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
      break;
    case 'teleport':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
      break;
    case 'bonus':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'gem':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
      break;
    case 'levelup':
      { const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
          o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.12);
          g.gain.setValueAtTime(0.18, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.3);
        }); }
      break;
    case 'portal':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    case 'ice':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'shield':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      break;
  }
}

// ══════════════════════════════════════════════
// ── LEVEL DEFINITIONS ──
// ══════════════════════════════════════════════

const LEVELS = [
  { name: 'Meadow Path', gemsRequired: 2, maxTurns: 60, bonusThreshold: 30,
    dist: { star:4, green:3, blue:7, white:9, orange:2, skull:1, arrow:2, gem:2, ice:1, portal:1, dice:2 } },
  { name: 'Frozen Woods', gemsRequired: 3, maxTurns: 55, bonusThreshold: 28,
    dist: { star:3, green:2, blue:5, white:7, orange:2, skull:3, arrow:2, gem:3, ice:3, portal:1, dice:2 } },
  { name: 'Skull Cavern', gemsRequired: 4, maxTurns: 50, bonusThreshold: 25,
    dist: { star:2, green:2, blue:4, white:6, orange:3, skull:5, arrow:2, gem:4, ice:2, portal:1, dice:2 } },
  { name: 'Crystal Peak', gemsRequired: 5, maxTurns: 45, bonusThreshold: 22,
    dist: { star:2, green:1, blue:3, white:5, orange:2, skull:4, arrow:3, gem:5, ice:5, portal:1, dice:2 } },
  { name: "Dragon's Lair", gemsRequired: 6, maxTurns: 40, bonusThreshold: 20,
    dist: { star:2, green:1, blue:2, white:4, orange:2, skull:6, arrow:3, gem:6, ice:4, portal:1, dice:2 } },
];

// ══════════════════════════════════════════════
// ── GAME CLASS ──
// ══════════════════════════════════════════════

export class Game {
  constructor(scene, grid, boardPath, animatedObjects) {
    this.scene = scene;
    this.grid = grid;
    this.boardPath = boardPath;
    this.animatedObjects = animatedObjects;

    this.score = 0;
    this.lives = 3;
    this.maxLives = 5;
    this.coins = 0;
    this.moving = false;
    this.gameOver = false;
    this.turnCount = 0;
    this.visitedTiles = new Set();
    this.combo = 0;
    this.shield = 0;
    this.levelTransitioning = false;

    this.currentLevel = 0;
    this.gemsCollected = 0;
    this.portalActive = false;
    this.portalTiles = [];
    this.currentTileIdx = 0;
    this.lastDr = 0;
    this.lastDc = 0;

    // Assign tile types based on level
    this._assignTileTypes();
    this._rebuildTileMeshes();
    this._removeCoinsOnSkullTiles();

    // Create character
    this.character = createCharacter();
    const startTile = this.boardPath[0];
    const startPos = this.grid.worldPos(startTile.r, startTile.c);
    const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;
    this.character.position.set(startPos.x, tileTopY, startPos.z);
    this.character.scale.setScalar(1.3);
    this.grid.group.add(this.character);
    this.animatedObjects.push(this.character);

    this.currentR = startTile.r;
    this.currentC = startTile.c;

    this.depressedTiles = new Map();
    this.tileAnimations = [];
    this._depressTile(startTile.r, startTile.c);

    // Dice roll state
    this.diceRolling = false;
    this.diceObjects = [];    // the two 3D dice groups placed near the dice tile
    this.diceAnimStart = 0;
    this.diceResult = 0;
    this.diceCallback = null;

    this.keys = {};
    this._setupKeyboard();
    this._updateHUD();

    const lvl = LEVELS[0];
    this._showMessage(`Level 1: ${lvl.name} — Collect ${lvl.gemsRequired} 💎`, 3000);
  }

  _assignTileTypes() {
    const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
    const pool = [];
    for (const [type, count] of Object.entries(lvl.dist)) {
      for (let i = 0; i < count; i++) pool.push(type);
    }
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // First tile is always safe blue
    this.boardPath[0].type = 'blue';
    for (let i = 1; i < this.boardPath.length; i++) {
      this.boardPath[i].type = pool[(i - 1) % pool.length];
    }
    // Ensure portal exists
    if (!this.boardPath.some(t => t.type === 'portal')) {
      const cands = this.boardPath.filter((t, i) => i > 0 && t.type !== 'skull' && t.type !== 'gem');
      if (cands.length > 0) cands[Math.floor(Math.random() * cands.length)].type = 'portal';
    }
    this.portalTiles = this.boardPath.filter(t => t.type === 'portal');
  }

  _rebuildTileMeshes() {
    this.boardPath.forEach(({ r, c, type }) => {
      const oldTile = this.grid.get(r, c);
      if (oldTile) {
        oldTile.removeFromParent();
        oldTile.traverse(ch => { if (ch.geometry) ch.geometry.dispose(); });
      }
      const newTile = createTile(type);
      const pos = this.grid.worldPos(r, c);
      newTile.position.copy(pos);
      this.grid.set(r, c, newTile);
      this.grid.group.add(newTile);
    });
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.keys[e.key]) return;
      this.keys[e.key] = true;

      if ((e.key === 'r' || e.key === 'R') && this.gameOver) {
        this._fullRestart();
        return;
      }
      if (this.gameOver || this.levelTransitioning || this.diceRolling) return;

      let dr = 0, dc = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dr = -1;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dr = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dc = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dc = 1;

      if ((dr !== 0 || dc !== 0) && !this.moving) this._tryMove(dr, dc);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
  }

  _tryMove(dr, dc) {
    const targetR = this.currentR + dr;
    const targetC = this.currentC + dc;
    const tileIdx = this.boardPath.findIndex(t => t.r === targetR && t.c === targetC);
    if (tileIdx === -1) return;

    this.moving = true;
    this.turnCount++;
    this.lastDr = dr;
    this.lastDc = dc;
    if (this.shield > 0) this.shield--;

    // Raise the tile the character is leaving
    this._raiseTile(this.currentR, this.currentC);

    const targetPos = this.grid.worldPos(targetR, targetC);
    const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;
    this._faceDirection(dc, dr);

    const startX = this.character.position.x;
    const startZ = this.character.position.z;
    const endX = targetPos.x;
    const endZ = targetPos.z;
    const duration = 220;
    const startTime = performance.now();

    const animateMove = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = 1 - Math.pow(1 - progress, 3);
      const hop = Math.sin(progress * Math.PI) * 0.25;
      this.character.position.x = startX + (endX - startX) * ease;
      this.character.position.z = startZ + (endZ - startZ) * ease;
      this.character.position.y = tileTopY + hop;

      if (progress < 1.0) {
        requestAnimationFrame(animateMove);
      } else {
        this.character.position.set(endX, tileTopY, endZ);
        this.currentR = targetR;
        this.currentC = targetC;
        this.currentTileIdx = tileIdx;
        this._depressTile(targetR, targetC);
        playSound('move');

        // Check if tile triggers dice — if so, don't reset moving (dice system owns it)
        const tileType = this.boardPath[tileIdx].type;
        this._processTileEffect(this.boardPath[tileIdx]);

        // Check turns limit
        const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
        const left = lvl.maxTurns - this.turnCount;
        if (left <= 0 && !this.gameOver) {
          this.lives--;
          if (this.lives <= 0) { this._gameOver(); }
          else { this._showMessage('⏰ Out of turns! -1 Life', 2000); playSound('hurt'); this._flashCharacter(); }
        } else if (left === 10) {
          this._showMessage('⚠️ 10 turns remaining!', 1500);
        }
        // Only reset moving if dice roll didn't take over
        if (!this.diceRolling) this.moving = false;
      }
    };
    requestAnimationFrame(animateMove);
  }

  _faceDirection(dc, dr) {
    // dc = column delta (world X), dr = row delta (world Z)
    // Eyes face +Z local, rotation.y rotates around Y axis
    const targetY = Math.atan2(dc, dr);
    // Smoothly rotate toward the target angle
    let current = this.character.rotation.y;
    // Shortest-path angle difference
    let diff = targetY - current;
    diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    this.character.rotation.y = current + diff;
  }

  _depressTile(r, c) {
    const tile = this.grid.get(r, c);
    if (!tile) return;
    const key = `${r},${c}`;
    if (this.depressedTiles.has(key)) return;
    tile.matrixAutoUpdate = true;
    const origY = tile.position.y;
    const targetY = origY - 0.06;
    const info = { tile, origY, targetY, progress: 0, depressing: true, raising: false };
    this.depressedTiles.set(key, info);
    this.tileAnimations.push(info);
  }

  _raiseTile(r, c) {
    const key = `${r},${c}`;
    const info = this.depressedTiles.get(key);
    if (!info) return;
    info.raising = true;
    info.raiseProgress = 0;
  }

  _processTileEffect(tileDef) {
    const type = tileDef.type;
    const key = `${tileDef.r},${tileDef.c}`;
    const firstVisit = !this.visitedTiles.has(key);
    this.visitedTiles.add(key);
    let isGood = false;

    switch (type) {
      case 'star':
        if (firstVisit) {
          this.score += 50; this.coins += 5;
          playSound('star');
          this._showMessage('⭐ Star! +50 pts +5 coins', 1200);
          this._collectCoinsOnTile(tileDef.r, tileDef.c);
          isGood = true;
        }
        break;
      case 'blue':
        if (firstVisit) {
          this.score += 20; this.coins += 2;
          playSound('bonus');
          this._showMessage('💙 Blue! +20 pts +2 coins', 1000);
          this._collectCoinsOnTile(tileDef.r, tileDef.c);
          isGood = true;
        }
        break;
      case 'green':
        if (firstVisit) {
          this.score += 10;
          this.shield = 3;
          if (this.lives < this.maxLives) {
            this.lives++;
            playSound('shield');
            this._showMessage('💚 +1 Life + 🛡️ Shield (3 turns)!', 1500);
          } else {
            playSound('shield');
            this._showMessage('🛡️ Shield active (3 turns)!', 1200);
          }
          isGood = true;
        }
        break;
      case 'white':
        if (firstVisit) {
          this.score += 5;
          this._collectCoinsOnTile(tileDef.r, tileDef.c);
          isGood = true;
        }
        break;
      case 'orange':
        if (firstVisit) {
          this.score += 30; this.coins += 3;
          playSound('coin');
          this._showMessage('🟠 Orange Bonus! +30 pts +3 coins', 1200);
          this._collectCoinsOnTile(tileDef.r, tileDef.c);
          isGood = true;
        }
        break;
      case 'skull':
        if (firstVisit) {
          if (this.shield > 0) {
            this.shield = 0;
            playSound('bonus');
            this._showMessage('🛡️ Shield blocked the skull!', 1200);
            this.score += 5;
            isGood = true;
          } else {
            this.lives--;
            this.score = Math.max(0, this.score - 25);
            this.combo = 0;
            playSound('hurt');
            this._showMessage('💀 Skull! -1 Life -25 pts', 1500);
            this._flashCharacter();
            if (this.lives <= 0) { this._gameOver(); return; }
          }
        }
        break;
      case 'arrow':
        playSound('teleport');
        { const targets = this.boardPath.filter(t =>
            (t.type === 'star' || t.type === 'gem' || t.type === 'orange') &&
            !(t.r === tileDef.r && t.c === tileDef.c));
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            this._showMessage('🏹 Teleporting!', 1000);
            setTimeout(() => {
              const pos = this.grid.worldPos(target.r, target.c);
              const ty = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;
              const tpDc = target.c - this.currentC;
              const tpDr = target.r - this.currentR;
              if (tpDc !== 0 || tpDr !== 0) this._faceDirection(tpDc, tpDr);
              this._raiseTile(this.currentR, this.currentC);
              this.character.position.set(pos.x, ty, pos.z);
              this.currentR = target.r; this.currentC = target.c;
              this._depressTile(target.r, target.c);
              this.score += 15; playSound('star'); this._updateHUD();
            }, 400);
          }
        }
        isGood = true;
        break;
      case 'gem':
        if (firstVisit) {
          this.gemsCollected++;
          this.score += 100; this.coins += 10;
          playSound('gem');
          { const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
            this._showMessage(`💜 GEM! ${this.gemsCollected}/${lvl.gemsRequired} — +100 pts`, 1800);
            this._collectCoinsOnTile(tileDef.r, tileDef.c);
            if (this.gemsCollected >= lvl.gemsRequired && !this.portalActive) {
              this.portalActive = true;
              playSound('portal');
              setTimeout(() => this._showMessage('🌀 PORTAL ACTIVATED! Find the portal tile!', 2500), 1200);
            }
          }
          isGood = true;
        }
        break;
      case 'ice':
        playSound('ice');
        this._showMessage('🧊 ICE! Sliding...', 800);
        if (firstVisit) { this.score += 5; }
        { const dr = this.lastDr; const dc = this.lastDc;
          setTimeout(() => {
            const nextR = this.currentR + dr;
            const nextC = this.currentC + dc;
            const nextIdx = this.boardPath.findIndex(t => t.r === nextR && t.c === nextC);
            if (nextIdx !== -1 && !this.moving) { this._tryMove(dr, dc); }
          }, 300);
        }
        break;
      case 'portal':
        if (this.portalActive) {
          this._levelComplete();
          return;
        } else {
          if (firstVisit) { this.score += 5; }
          const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
          this._showMessage(`🌀 Dormant — collect ${lvl.gemsRequired - this.gemsCollected} more 💎`, 1500);
        }
        break;
      case 'dice':
        playSound('bonus');
        this._rollDice(tileDef);
        isGood = true;
        // Safety: if dice rolling gets stuck, force-recover after 15 seconds
        setTimeout(() => {
          if (this.diceRolling || this.moving) {
            console.warn('Dice safety timeout: forcing state recovery');
            this.diceRolling = false;
            this.moving = false;
            this._updateHUD();
          }
        }, 15000);
        return; // skip combo/HUD update — dice callback handles it
    }

    // Combo
    if (isGood) {
      this.combo++;
      if (this.combo >= 5) {
        const cb = this.combo * 5;
        this.score += cb;
        this._showMessage(`🔥 ${this.combo}x COMBO! +${cb} pts`, 1000);
      }
    }

    this._updateHUD();
  }

  // ══════════════════════════════════════════════
  // ── DICE ROLL SYSTEM ──
  // ══════════════════════════════════════════════

  _rollDice(tileDef) {
    if (this.diceRolling) return;
    this.diceRolling = true;
    this.moving = true; // block movement during roll

    // Reuse the existing decorative dice instead of creating new ones
    // This avoids WebGPU pipeline errors from dynamically adding new meshes
    const decorDice1 = this.grid.group.getObjectByName('decor-dice-1');
    const decorDice2 = this.grid.group.getObjectByName('decor-dice-2');
    if (!decorDice1 || !decorDice2) {
      this.diceRolling = false;
      this.moving = false;
      return;
    }

    // Save originals to restore later
    const orig1 = { pos: decorDice1.position.clone(), rot: decorDice1.rotation.clone() };
    const orig2 = { pos: decorDice2.position.clone(), rot: decorDice2.rotation.clone() };

    // Roll two dice values
    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = Math.floor(Math.random() * 6) + 1;
    const total = val1 + val2;

    const faceRotations = {
      1: { x: 0, z: 0 },
      2: { x: 0, z: -Math.PI / 2 },
      3: { x: -Math.PI / 2, z: 0 },
      4: { x: 0, z: Math.PI / 2 },
      5: { x: Math.PI / 2, z: 0 },
      6: { x: Math.PI, z: 0 },
    };
    const targetRot1 = faceRotations[val1];
    const targetRot2 = faceRotations[val2];

    this._showMessage('🎲 Rolling dice...', 2000);
    playSound('teleport');

    // Count as a turn
    this.turnCount++;

    const startTime = performance.now();
    const duration = 1400;
    const jumpHeight = 1.8;
    const startY1 = orig1.pos.y;
    const startY2 = orig2.pos.y;

    const spinSpeedX1 = (Math.random() * 2 + 3) * Math.PI * 2;
    const spinSpeedZ1 = (Math.random() * 2 + 2) * Math.PI * 2;
    const spinSpeedX2 = (Math.random() * 2 + 3) * Math.PI * 2;
    const spinSpeedZ2 = (Math.random() * 2 + 2) * Math.PI * 2;

    const animateDice = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(elapsed / duration, 1.0);

      // Jump arc with bounce
      const jumpArc = Math.sin(p * Math.PI) * jumpHeight * Math.pow(1 - p * 0.3, 1);
      const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * Math.pow(1 - p, 2) * 0.6;
      const yOffset = jumpArc * (1 - p * 0.5) + bounce;

      decorDice1.position.y = startY1 + yOffset;
      decorDice2.position.y = startY2 + yOffset * 0.9;

      // Spin: fast early, settle to target
      const spinBlend = Math.pow(1 - p, 1.5);
      decorDice1.rotation.x = targetRot1.x + spinSpeedX1 * spinBlend;
      decorDice1.rotation.z = targetRot1.z + spinSpeedZ1 * spinBlend;
      decorDice1.rotation.y = orig1.rot.y;

      decorDice2.rotation.x = targetRot2.x + spinSpeedX2 * spinBlend;
      decorDice2.rotation.z = targetRot2.z + spinSpeedZ2 * spinBlend;
      decorDice2.rotation.y = orig2.rot.y;

      if (p < 1.0) {
        requestAnimationFrame(animateDice);
      } else {
        // Settle precisely
        decorDice1.rotation.set(targetRot1.x, orig1.rot.y, targetRot1.z);
        decorDice1.position.y = startY1;
        decorDice2.rotation.set(targetRot2.x, orig2.rot.y, targetRot2.z);
        decorDice2.position.y = startY2;

        playSound('star');
        this._showMessage(`🎲 Rolled ${val1} + ${val2} = ${total}! Moving ${total} tiles!`, 2500);

        setTimeout(() => {
          // Restore decorative dice to original pose
          decorDice1.position.copy(orig1.pos);
          decorDice1.rotation.copy(orig1.rot);
          decorDice2.position.copy(orig2.pos);
          decorDice2.rotation.copy(orig2.rot);

          this._diceMove(total);
        }, 1200);
      }
    };
    requestAnimationFrame(animateDice);
  }

  _diceMove(steps) {
    // Move the player forward along the board path by `steps` tiles
    const currentIdx = this.boardPath.findIndex(
      t => t.r === this.currentR && t.c === this.currentC
    );
    if (currentIdx === -1) {
      this.moving = false;
      this.diceRolling = false;
      return;
    }

    // Calculate target index (wrap around)
    const targetIdx = (currentIdx + steps) % this.boardPath.length;
    const targetTile = this.boardPath[targetIdx];

    // Animate step-by-step movement
    let stepIdx = 0;
    const stepsToMove = [];
    for (let i = 1; i <= steps; i++) {
      stepsToMove.push(this.boardPath[(currentIdx + i) % this.boardPath.length]);
    }

    const moveNextStep = () => {
      if (stepIdx >= stepsToMove.length) {
        // Arrived at final destination
        this.diceRolling = false;
        this.moving = false;
        // Process the final tile effect (but not as 'dice' again to avoid infinite loop)
        const finalTile = stepsToMove[stepsToMove.length - 1];
        const finalIdx = this.boardPath.findIndex(t => t.r === finalTile.r && t.c === finalTile.c);
        this.currentTileIdx = finalIdx;
        if (finalTile.type !== 'dice') {
          this._processTileEffect(finalTile);
          // If processTileEffect triggered another dice roll, don't override moving
          // Otherwise ensure moving is false
          if (!this.diceRolling) this.moving = false;
        } else {
          // Landed on another dice tile — just award points
          this.score += 10;
          this._showMessage('🎲 Landed on dice! +10 pts', 1000);
          this._updateHUD();
        }
        return;
      }

      const nextTile = stepsToMove[stepIdx];
      const targetPos = this.grid.worldPos(nextTile.r, nextTile.c);
      const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;

      this._raiseTile(this.currentR, this.currentC);

      const startX = this.character.position.x;
      const startZ = this.character.position.z;
      const endX = targetPos.x;
      const endZ = targetPos.z;
      const duration = 160; // faster per-step movement
      const startTime = performance.now();

      const dc = nextTile.c - this.currentR;
      const dr = nextTile.r - this.currentR;

      const animateStep = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        const ease = 1 - Math.pow(1 - progress, 3);
        const hop = Math.sin(progress * Math.PI) * 0.3;
        this.character.position.x = startX + (endX - startX) * ease;
        this.character.position.z = startZ + (endZ - startZ) * ease;
        this.character.position.y = tileTopY + hop;

        if (progress < 1.0) {
          requestAnimationFrame(animateStep);
        } else {
          this.character.position.set(endX, tileTopY, endZ);
          this.currentR = nextTile.r;
          this.currentC = nextTile.c;
          this._depressTile(nextTile.r, nextTile.c);
          playSound('move');
          stepIdx++;
          // Brief delay between steps for visible hop effect
          setTimeout(moveNextStep, 80);
        }
      };
      requestAnimationFrame(animateStep);
    };

    moveNextStep();
  }

  _cleanupDiceObjects() {
    this.diceObjects.forEach(d => {
      d.removeFromParent();
      d.traverse(ch => {
        if (ch.geometry && !ch.geometry._shared) ch.geometry.dispose();
      });
    });
    this.diceObjects = [];
  }

  // ══════════════════════════════════════════════
  // ── ROLL DICE FROM BUTTON (bottom-right 🎲) ──
  // ══════════════════════════════════════════════

  rollDiceFromButton() {
    if (this.diceRolling || this.moving || this.gameOver || this.levelTransitioning) return;
    this.diceRolling = true;
    this.moving = true;

    // Visual feedback on button
    const btn = document.querySelector('.roll-btn');
    if (btn) btn.classList.add('rolling');

    // Find the two decorative dice in the scene
    const decorDice1 = this.grid.group.getObjectByName('decor-dice-1');
    const decorDice2 = this.grid.group.getObjectByName('decor-dice-2');
    if (!decorDice1 || !decorDice2) {
      // Fallback: just do a normal dice roll at current position
      const curTile = this.boardPath[this.currentTileIdx];
      this.diceRolling = false;
      this.moving = false;
      this._rollDice(curTile);
      return;
    }

    // Save original positions/rotations so we can restore them after
    const orig1 = {
      pos: decorDice1.position.clone(),
      rot: decorDice1.rotation.clone(),
      scale: decorDice1.scale.clone(),
    };
    const orig2 = {
      pos: decorDice2.position.clone(),
      rot: decorDice2.rotation.clone(),
      scale: decorDice2.scale.clone(),
    };

    // Roll values
    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = Math.floor(Math.random() * 6) + 1;
    const total = val1 + val2;

    // Face rotation targets
    const faceRotations = {
      1: { x: 0, z: 0 },
      2: { x: 0, z: -Math.PI / 2 },
      3: { x: -Math.PI / 2, z: 0 },
      4: { x: 0, z: Math.PI / 2 },
      5: { x: Math.PI / 2, z: 0 },
      6: { x: Math.PI, z: 0 },
    };
    const targetRot1 = faceRotations[val1];
    const targetRot2 = faceRotations[val2];

    // Animation: dice jump up, tumble, and land
    const startTime = performance.now();
    const duration = 1400;
    const jumpHeight = 1.8;
    const startY1 = orig1.pos.y;
    const startY2 = orig2.pos.y;

    const spinSpeedX1 = (Math.random() * 2 + 3) * Math.PI * 2;
    const spinSpeedZ1 = (Math.random() * 2 + 2) * Math.PI * 2;
    const spinSpeedX2 = (Math.random() * 2 + 3) * Math.PI * 2;
    const spinSpeedZ2 = (Math.random() * 2 + 2) * Math.PI * 2;

    // Count as a turn
    this.turnCount++;

    this._showMessage('🎲 Rolling dice...', 2000);
    playSound('teleport');

    const animateDice = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(elapsed / duration, 1.0);

      // Jump arc: go up then come back down with bounces
      const jumpArc = Math.sin(p * Math.PI) * jumpHeight * Math.pow(1 - p * 0.3, 1);
      const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * Math.pow(1 - p, 2) * 0.6;
      const yOffset = jumpArc * (1 - p * 0.5) + bounce;

      decorDice1.position.y = startY1 + yOffset;
      decorDice2.position.y = startY2 + yOffset * 0.9;

      // Spin: fast early, settle to target
      const spinBlend = Math.pow(1 - p, 1.5);
      decorDice1.rotation.x = targetRot1.x + spinSpeedX1 * spinBlend;
      decorDice1.rotation.z = targetRot1.z + spinSpeedZ1 * spinBlend;
      decorDice1.rotation.y = orig1.rot.y;

      decorDice2.rotation.x = targetRot2.x + spinSpeedX2 * spinBlend;
      decorDice2.rotation.z = targetRot2.z + spinSpeedZ2 * spinBlend;
      decorDice2.rotation.y = orig2.rot.y;

      if (p < 1.0) {
        requestAnimationFrame(animateDice);
      } else {
        // Settle precisely — land flat showing rolled values
        decorDice1.rotation.set(targetRot1.x, orig1.rot.y, targetRot1.z);
        decorDice1.position.y = startY1;
        decorDice2.rotation.set(targetRot2.x, orig2.rot.y, targetRot2.z);
        decorDice2.position.y = startY2;

        playSound('star');
        this._showMessage(`🎲 Rolled ${val1} + ${val2} = ${total}! Moving ${total} tiles!`, 2500);

        // After a brief pause, move the player and restore dice
        setTimeout(() => {
          // Restore decorative dice to original laid-down pose
          decorDice1.position.copy(orig1.pos);
          decorDice1.rotation.copy(orig1.rot);
          decorDice2.position.copy(orig2.pos);
          decorDice2.rotation.copy(orig2.rot);

          // Remove button rolling state
          const btn2 = document.querySelector('.roll-btn');
          if (btn2) btn2.classList.remove('rolling');

          this._diceMove(total);
        }, 1200);
      }
    };
    requestAnimationFrame(animateDice);

    // Safety: if dice rolling gets stuck, force-recover after 15 seconds
    setTimeout(() => {
      if (this.diceRolling || this.moving) {
        console.warn('Dice button safety timeout: forcing state recovery');
        this.diceRolling = false;
        this.moving = false;
        const btn3 = document.querySelector('.roll-btn');
        if (btn3) btn3.classList.remove('rolling');
        this._updateHUD();
      }
    }, 15000);
  }

  _levelComplete() {
    this.levelTransitioning = true;
    const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
    const turnsBonus = Math.max(0, lvl.maxTurns - this.turnCount) * 5;
    const livesBonus = this.lives * 50;
    const speedBonus = this.turnCount <= lvl.bonusThreshold ? 200 : 0;
    const totalBonus = turnsBonus + livesBonus + speedBonus;
    this.score += totalBonus;
    this.coins += Math.floor(totalBonus / 10);

    playSound('levelup');

    const nextLevel = this.currentLevel + 1;
    const hasNext = nextLevel < LEVELS.length;

    let msg = `🎉 LEVEL COMPLETE! +${turnsBonus} turns +${livesBonus} lives`;
    if (speedBonus > 0) msg += ` +${speedBonus} speed!`;
    this._showMessage(msg, 0);

    setTimeout(() => {
      if (hasNext) {
        this._showMessage('Press ENTER for next level...', 0, true);
      } else {
        this._showMessage(`🏆 YOU WIN! Score: ${this.score} | Press R to play again`, 0, true);
        this.gameOver = true;
      }
      this._updateHUD();
    }, 3000);

    const handler = (e) => {
      if (hasNext && (e.key === 'Enter' || e.key === ' ')) {
        window.removeEventListener('keydown', handler);
        this._nextLevel();
      } else if (!hasNext && (e.key === 'r' || e.key === 'R')) {
        window.removeEventListener('keydown', handler);
        this._fullRestart();
      }
    };
    window.addEventListener('keydown', handler);
  }

  _nextLevel() {
    this.currentLevel++;
    this.gemsCollected = 0;
    this.portalActive = false;
    this.turnCount = 0;
    this.moving = false;
    this.combo = 0;
    this.shield = 0;
    this.levelTransitioning = false;
    this.visitedTiles.clear();

    this.depressedTiles.forEach(info => { info.tile.position.y = info.origY; });
    this.depressedTiles.clear();
    this.tileAnimations.length = 0;

    this._assignTileTypes();
    this._rebuildTileMeshes();
    this._removeCoinsOnSkullTiles();

    const startTile = this.boardPath[0];
    const startPos = this.grid.worldPos(startTile.r, startTile.c);
    const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;
    this.character.position.set(startPos.x, tileTopY, startPos.z);
    this.currentR = startTile.r;
    this.currentC = startTile.c;
    this.currentTileIdx = 0;

    this._depressTile(startTile.r, startTile.c);
    this._updateHUD();

    const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];
    this._showMessage(`Level ${this.currentLevel + 1}: ${lvl.name} — Collect ${lvl.gemsRequired} 💎`, 3000);
  }

  _fullRestart() {
    this.currentLevel = 0;
    this.score = 0;
    this.lives = 3;
    this.coins = 0;
    this.turnCount = 0;
    this.gameOver = false;
    this.moving = false;
    this.combo = 0;
    this.shield = 0;
    this.gemsCollected = 0;
    this.portalActive = false;
    this.levelTransitioning = false;
    this.visitedTiles.clear();

    this.depressedTiles.forEach(info => { info.tile.position.y = info.origY; });
    this.depressedTiles.clear();
    this.tileAnimations.length = 0;

    this._assignTileTypes();
    this._rebuildTileMeshes();
    this._removeCoinsOnSkullTiles();

    const startTile = this.boardPath[0];
    const startPos = this.grid.worldPos(startTile.r, startTile.c);
    const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.35;
    this.character.position.set(startPos.x, tileTopY, startPos.z);
    this.currentR = startTile.r;
    this.currentC = startTile.c;
    this.currentTileIdx = 0;

    this._depressTile(startTile.r, startTile.c);
    this._updateHUD();
    this._showMessage('Game Restarted! Level 1 — Go!', 2000);
  }

  _removeCoinsOnSkullTiles() {
    const skullTiles = this.boardPath.filter(t => t.type === 'skull');
    const toRemove = [];
    for (const st of skullTiles) {
      const pos = this.grid.worldPos(st.r, st.c);
      this.animatedObjects.forEach(obj => {
        if (obj.name === 'coin') {
          const dx = obj.position.x - pos.x, dz = obj.position.z - pos.z;
          if (Math.sqrt(dx * dx + dz * dz) < 0.5) toRemove.push(obj);
        }
      });
    }
    toRemove.forEach(coin => {
      coin.removeFromParent();
      const idx = this.animatedObjects.indexOf(coin);
      if (idx !== -1) this.animatedObjects.splice(idx, 1);
    });
  }

  _collectCoinsOnTile(r, c) {
    const pos = this.grid.worldPos(r, c);
    const toRemove = [];
    this.animatedObjects.forEach(obj => {
      if (obj.name === 'coin') {
        const dx = obj.position.x - pos.x, dz = obj.position.z - pos.z;
        if (Math.sqrt(dx * dx + dz * dz) < 0.5) toRemove.push(obj);
      }
    });
    toRemove.forEach(coin => {
      this.coins += 1; this.score += 10; playSound('coin');
      const startY = coin.position.y;
      const startTime = performance.now();
      const flyUp = () => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(elapsed / 400, 1);
        coin.position.y = startY + p * 1.5;
        coin.scale.setScalar(1 - p);
        if (p < 1) requestAnimationFrame(flyUp);
        else {
          coin.removeFromParent();
          const idx = this.animatedObjects.indexOf(coin);
          if (idx !== -1) this.animatedObjects.splice(idx, 1);
        }
      };
      requestAnimationFrame(flyUp);
    });
    this._updateHUD();
  }

  _flashCharacter() {
    const body = this.character.getObjectByName('player-body');
    if (!body) return;
    const origColor = body.material.emissive.clone();
    let flashes = 0;
    const flash = () => {
      if (flashes >= 6) { body.material.emissive.copy(origColor); return; }
      body.material.emissive.set(flashes % 2 === 0 ? 0xff0000 : origColor);
      flashes++;
      setTimeout(flash, 100);
    };
    flash();
  }

  _gameOver() {
    this.gameOver = true;
    playSound('gameover');
    this._showMessage(`GAME OVER! Score: ${this.score} | Level: ${this.currentLevel + 1}`, 0);
    setTimeout(() => this._showMessage('Press R to restart', 0, true), 2000);
  }

  _updateHUD() {
    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((h, i) => h.classList.toggle('empty', i >= this.lives));

    const coinCount = document.querySelector('.coin-count');
    if (coinCount) coinCount.textContent = this.coins;

    const scoreEl = document.querySelector('.hud-score-value');
    if (scoreEl) scoreEl.textContent = this.score;

    const lvl = LEVELS[Math.min(this.currentLevel, LEVELS.length - 1)];

    const levelEl = document.querySelector('.hud-level-value');
    if (levelEl) levelEl.textContent = `${this.currentLevel + 1} — ${lvl.name}`;

    const gemsEl = document.querySelector('.hud-gems-value');
    if (gemsEl) gemsEl.textContent = `${this.gemsCollected} / ${lvl.gemsRequired}`;

    const turnsEl = document.querySelector('.hud-turns-value');
    if (turnsEl) {
      const left = Math.max(0, lvl.maxTurns - this.turnCount);
      turnsEl.textContent = left;
      turnsEl.style.color = left <= 10 ? '#ff4444' : left <= 20 ? '#ffaa33' : '#fff';
    }

    const comboEl = document.querySelector('.hud-combo-value');
    if (comboEl) comboEl.textContent = this.combo >= 3 ? `🔥 ${this.combo}x` : '';

    const shieldEl = document.querySelector('.hud-shield-value');
    if (shieldEl) shieldEl.textContent = this.shield > 0 ? `🛡️ ${this.shield}` : '';

    const progFill = document.querySelector('.progress-fill');
    if (progFill) {
      const pct = lvl.gemsRequired > 0 ? Math.min(100, (this.gemsCollected / lvl.gemsRequired) * 100) : 0;
      progFill.style.width = pct + '%';
      progFill.style.background = this.portalActive ? '#ff2f92' : '#9b30ff';
    }
  }

  _showMessage(text, duration = 1500, persistent = false) {
    let msgEl = document.getElementById('game-message');
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.id = 'game-message';
      document.body.appendChild(msgEl);
    }
    msgEl.textContent = text;
    msgEl.style.opacity = '1';
    msgEl.style.transform = 'translateX(-50%) translateY(0)';
    if (!persistent && duration > 0) {
      setTimeout(() => {
        msgEl.style.opacity = '0';
        msgEl.style.transform = 'translateX(-50%) translateY(-10px)';
      }, duration);
    }
  }

  update(time) {
    for (let i = this.tileAnimations.length - 1; i >= 0; i--) {
      const info = this.tileAnimations[i];
      if (info.raising) {
        // Animate tile back up to original position
        info.raiseProgress = Math.min((info.raiseProgress || 0) + 0.06, 1.0);
        const ease = 1 - Math.pow(1 - info.raiseProgress, 3);
        info.tile.position.y = info.targetY + (info.origY - info.targetY) * ease;
        if (info.raiseProgress >= 1.0) {
          info.tile.position.y = info.origY;
          // Clean up this tile from tracking
          const key = [...this.depressedTiles.entries()].find(([k, v]) => v === info);
          if (key) this.depressedTiles.delete(key[0]);
          this.tileAnimations.splice(i, 1);
        }
      } else if (info.depressing) {
        info.progress = Math.min(info.progress + 0.08, 1.0);
        const ease = 1 - Math.pow(1 - info.progress, 3);
        info.tile.position.y = info.origY + (info.targetY - info.origY) * ease;
        if (info.progress >= 1.0) info.depressing = false;
      }
    }

    // Animate portal tiles when active
    if (this.portalActive) {
      this.portalTiles.forEach(tDef => {
        const tile = this.grid.get(tDef.r, tDef.c);
        if (!tile) return;
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;
        tile.traverse(child => {
          if (child.isMesh && child.name === 'portal-ring') {
            child.material.emissiveIntensity = 0.6 + pulse * 1.2;
            child.rotation.z = time * 2;
          }
          if (child.isMesh && child.name === 'portal-dot') {
            child.material.emissiveIntensity = 0.6 + pulse * 1.2;
          }
        });
      });
    }
  }
}