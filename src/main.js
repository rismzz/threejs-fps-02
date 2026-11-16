// STEELHAVEN — an original tactical FPS in three.js.
// Clear five waves of hostiles inside a night training compound.
// Built for make.fun's "Make the best three.js tactical FPS" (threejs-fps-02).
//
// Structure:
//   logic.js   pure balance math (unit-tested in Node)
//   world.js   arena geometry + collision
//   enemies.js enemy actors + AI
//   player.js  pointer-lock controls + gun view-model
//   audio.js   procedural WebAudio sound effects
//   main.js    game state, shooting, waves, HUD, radar (this file)

import * as THREE from 'three';
import {
  CONFIG,
  waveComposition,
  damageFalloff,
  scoreFor,
} from './logic.js';
import { buildWorld } from './world.js';
import { EnemyManager } from './enemies.js';
import { Player } from './player.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const els = {
  hpFill: $('hp-fill'),
  hpText: $('hp-text'),
  ammo: $('ammo'),
  ammoState: $('ammo-state'),
  score: $('score'),
  wave: $('wave'),
  left: $('enemies-left'),
  timer: $('timer'),
  hitmarker: $('hitmarker'),
  banner: $('banner'),
  bannerTitle: $('banner-title'),
  bannerSub: $('banner-sub'),
  vignette: $('vignette'),
  menu: $('menu'),
  pause: $('pause'),
  end: $('end'),
  endTitle: $('end-title'),
  endSub: $('end-sub'),
  endStats: $('end-stats'),
  radar: $('radar'),
};

// ---------- renderer / scene ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('webgl-error').style.display = 'block';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 300);
scene.add(camera);

const world = buildWorld(scene);
const sfx = new Sfx();
const player = new Player(camera, renderer.domElement, world);

// muzzle flash: a point light + a sprite at the gun tip
const flashLight = new THREE.PointLight(0xffc37a, 0, 14, 1.6);
scene.add(flashLight);
const flashCanvas = document.createElement('canvas');
flashCanvas.width = 64;
flashCanvas.height = 64;
{
  const g = flashCanvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.4, 'rgba(255,180,80,0.85)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
}
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: new THREE.CanvasTexture(flashCanvas),
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
flashSprite.scale.setScalar(0.34);
camera.add(flashSprite);
flashSprite.position.set(0.26, -0.2, -1.12);

// ---------- game state ----------
let state = 'menu'; // menu | playing | paused | won | lost
let runActive = false;
let hp = CONFIG.playerMaxHealth;
let ammo = CONFIG.magazineSize;
let reloading = false;
let reloadT = 0;
let score = 0;
let wave = 1;
let wavePhase = 'idle'; // idle | active | intermission
let interT = 0;
let playTime = 0;
let lastShotT = -1;
let mouseHeld = false;
let damageVig = 0;
let hitmarkT = 0;
let bannerT = 0;
let flashT = 0;
const stats = { shots: 0, hits: 0, kills: 0, headshots: 0 };

const tracers = [];
const particles = [];
const pickups = [];

function spawnTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, ttl: 0.07, max: 0.07 });
}

function spawnImpact(point, color) {
  const n = 10;
  const positions = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i += 1) {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 3.2,
      Math.random() * 2.6,
      (Math.random() - 0.5) * 3.2
    ));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1 });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  particles.push({ points, vel, ttl: 0.32, max: 0.32 });
}

const manager = new EnemyManager(scene, world, {
  onPlayerDamage(amount) {
    if (state !== 'playing') return;
    hp -= amount;
    damageVig = Math.min(0.75, damageVig + 0.45);
    sfx.playerHurt();
    if (hp <= 0) {
      hp = 0;
      lose();
    }
    updateHud();
  },
  spawnTracer,
  onEnemyShoot() {
    sfx.enemyShoot();
  },
});

// ---------- medkits ----------
const medkitGeo = new THREE.BoxGeometry(0.44, 0.3, 0.44);
const medkitMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
const crossMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x1d9e50, emissiveIntensity: 0.9 });

function maybeDropMedkit(pos) {
  if (Math.random() > CONFIG.medkitDropChance) return;
  const group = new THREE.Group();
  const box = new THREE.Mesh(medkitGeo, medkitMat);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.06), crossMat);
  c1.position.set(0, 0, 0.23);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.06), crossMat);
  c2.position.set(0, 0, 0.23);
  group.add(box, c1, c2);
  group.position.set(pos.x, 0.45, pos.z);
  scene.add(group);
  pickups.push({ group, t: Math.random() * Math.PI * 2 });
}

// ---------- shooting ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 140;
const screenCenter = new THREE.Vector2(0, 0);
const muzzlePos = new THREE.Vector3();

function startReload() {
  if (reloading || ammo === CONFIG.magazineSize || state !== 'playing') return;
  reloading = true;
  reloadT = CONFIG.reloadSeconds;
  sfx.reloadStart();
  updateHud();
}

function tryShoot(now) {
  if (state !== 'playing' || reloading) return;
  if (now - lastShotT < CONFIG.fireIntervalSeconds) return;
  if (ammo <= 0) {
    sfx.emptyClick();
    startReload();
    lastShotT = now;
    return;
  }
  lastShotT = now;
  ammo -= 1;
  stats.shots += 1;
  player.addKick();
  sfx.shoot();

  player.getMuzzleWorldPos(muzzlePos);
  flashLight.position.copy(muzzlePos);
  flashLight.intensity = 30;
  flashT = 0.05;
  flashSprite.material.opacity = 0.95;
  flashSprite.material.rotation = Math.random() * Math.PI;

  raycaster.setFromCamera(screenCenter, camera);
  const targets = [...world.walls, ...manager.getHitMeshes()];
  const hits = raycaster.intersectObjects(targets, false);
  let endPoint;
  if (hits.length > 0) {
    const hit = hits[0];
    endPoint = hit.point;
    const { enemy, part } = hit.object.userData;
    if (enemy) {
      stats.hits += 1;
      const isHead = part === 'head';
      const dmg = damageFalloff(CONFIG.weaponBaseDamage, hit.distance) * (isHead ? CONFIG.headshotMultiplier : 1);
      const result = manager.damage(enemy, dmg);
      spawnImpact(hit.point, 0xffa040);
      hitmarkT = isHead ? 0.28 : 0.18;
      els.hitmarker.classList.toggle('headshot', isHead);
      if (result === 'kill') {
        stats.kills += 1;
        if (isHead) stats.headshots += 1;
        score += scoreFor(isHead ? 'headshotKill' : 'kill', wave);
        sfx.enemyDie();
        maybeDropMedkit(enemy.group.position);
      } else if (isHead) {
        sfx.headshot();
      } else {
        sfx.hit();
      }
    } else {
      spawnImpact(hit.point, 0xcfd8e3);
    }
  } else {
    endPoint = raycaster.ray.at(90, new THREE.Vector3());
  }
  spawnTracer(muzzlePos, endPoint, 0xffd9a0);
  if (ammo === 0) startReload();
  updateHud();
}

// ---------- wave flow ----------
function showBanner(title, sub, dur = 2.2) {
  els.bannerTitle.textContent = title;
  els.bannerSub.textContent = sub;
  els.banner.classList.add('visible');
  bannerT = dur;
}

function startWave(n) {
  wave = n;
  wavePhase = 'active';
  manager.startWave(waveComposition(n));
  showBanner(`WAVE ${n}`, n === CONFIG.totalWaves ? 'Final wave — clear the compound' : 'Hostiles inbound', 2.2);
  sfx.waveStart();
  updateHud();
}

function win() {
  state = 'won';
  score += 500;
  player.unlock();
  els.endTitle.textContent = 'COMPOUND CLEARED';
  els.endSub.textContent = 'All five waves eliminated. Tactical work, operator.';
  fillEndStats();
  els.end.classList.add('visible');
  sfx.win();
}

function lose() {
  state = 'lost';
  player.unlock();
  els.endTitle.textContent = 'OPERATOR DOWN';
  els.endSub.textContent = `You fell on wave ${wave}. The compound remains hostile.`;
  fillEndStats();
  els.end.classList.add('visible');
  sfx.lose();
}

function fillEndStats() {
  const acc = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;
  const mm = String(Math.floor(playTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(playTime % 60)).padStart(2, '0');
  els.endStats.innerHTML =
    `<div><span>Score</span><strong>${score}</strong></div>` +
    `<div><span>Kills</span><strong>${stats.kills}</strong></div>` +
    `<div><span>Headshots</span><strong>${stats.headshots}</strong></div>` +
    `<div><span>Accuracy</span><strong>${acc}%</strong></div>` +
    `<div><span>Time</span><strong>${mm}:${ss}</strong></div>` +
    `<div><span>Wave reached</span><strong>${wave} / ${CONFIG.totalWaves}</strong></div>`;
}

function resetGame() {
  manager.clear();
  for (const p of pickups) scene.remove(p.group);
  pickups.length = 0;
  for (const t of tracers) {
    scene.remove(t.line);
    t.line.geometry.dispose();
    t.line.material.dispose();
  }
  tracers.length = 0;
  for (const p of particles) {
    scene.remove(p.points);
    p.points.geometry.dispose();
    p.points.material.dispose();
  }
  particles.length = 0;
  player.reset();
  hp = CONFIG.playerMaxHealth;
  ammo = CONFIG.magazineSize;
  reloading = false;
  score = 0;
  wave = 1;
  wavePhase = 'idle';
  playTime = 0;
  damageVig = 0;
  stats.shots = 0;
  stats.hits = 0;
  stats.kills = 0;
  stats.headshots = 0;
  runActive = false;
  els.end.classList.remove('visible');
  updateHud();
}

// ---------- HUD ----------
function updateHud() {
  els.hpFill.style.width = `${Math.max(0, hp)}%`;
  els.hpFill.style.background = hp > 55 ? '#3ddc74' : hp > 28 ? '#e8b93c' : '#e5484d';
  els.hpText.textContent = `${Math.ceil(hp)}`;
  els.ammo.textContent = `${ammo}`;
  els.ammoState.textContent = reloading ? 'RELOADING…' : '/ ∞';
  els.score.textContent = `${score}`;
  els.wave.textContent = `${wave} / ${CONFIG.totalWaves}`;
  els.left.textContent = `${manager.remainingCount}`;
}

const radarCtx = els.radar.getContext('2d');
function drawRadar() {
  const size = els.radar.width;
  const c = size / 2;
  const scale = size / 78;
  radarCtx.clearRect(0, 0, size, size);
  radarCtx.fillStyle = 'rgba(8, 14, 22, 0.72)';
  radarCtx.fillRect(0, 0, size, size);
  const cos = Math.cos(player.yaw);
  const sin = Math.sin(player.yaw);
  const project = (x, z) => {
    const dx = x - player.pos.x;
    const dz = z - player.pos.z;
    const rx = dx * cos - dz * sin;
    const up = -dx * sin - dz * cos;
    return [c + rx * scale, c - up * scale];
  };
  // arena outline
  const h = CONFIG.arenaHalfSize;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, z]) => project(x, z));
  radarCtx.strokeStyle = 'rgba(140,180,220,0.5)';
  radarCtx.lineWidth = 1;
  radarCtx.beginPath();
  corners.forEach(([x, y], i) => (i === 0 ? radarCtx.moveTo(x, y) : radarCtx.lineTo(x, y)));
  radarCtx.closePath();
  radarCtx.stroke();
  // medkits
  radarCtx.fillStyle = '#2ecc71';
  for (const p of pickups) {
    const [x, y] = project(p.group.position.x, p.group.position.z);
    radarCtx.fillRect(x - 2, y - 2, 4, 4);
  }
  // enemies
  radarCtx.fillStyle = '#ff5040';
  for (const e of manager.enemies) {
    if (e.state === 'dying') continue;
    const [x, y] = project(e.group.position.x, e.group.position.z);
    radarCtx.beginPath();
    radarCtx.arc(x, y, 3, 0, Math.PI * 2);
    radarCtx.fill();
  }
  // player arrow (always pointing up = facing)
  radarCtx.fillStyle = '#ffd76a';
  radarCtx.beginPath();
  radarCtx.moveTo(c, c - 6);
  radarCtx.lineTo(c - 4.5, c + 5);
  radarCtx.lineTo(c + 4.5, c + 5);
  radarCtx.closePath();
  radarCtx.fill();
}

// ---------- input ----------
$('start-btn').addEventListener('click', () => {
  sfx.init();
  sfx.resume();
  resetGame();
  player.lock();
});
$('resume-btn').addEventListener('click', () => {
  sfx.resume();
  player.lock();
});
$('restart-btn').addEventListener('click', () => {
  sfx.resume();
  resetGame();
  player.lock();
});
document.addEventListener('mousedown', (ev) => {
  if (state === 'playing' && player.locked && ev.button === 0) {
    mouseHeld = true;
    tryShoot(clock.elapsedTime);
  }
});
document.addEventListener('mouseup', (ev) => {
  if (ev.button === 0) mouseHeld = false;
});
document.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyR') startReload();
});
player.onLockChange = (locked) => {
  if (locked) {
    els.menu.classList.remove('visible');
    els.pause.classList.remove('visible');
    if (state === 'menu' || state === 'paused') {
      state = 'playing';
      if (!runActive) {
        runActive = true;
        startWave(1);
      }
    }
  } else if (state === 'playing') {
    state = 'paused';
    mouseHeld = false;
    els.pause.classList.add('visible');
  }
};
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- main loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (state === 'playing') {
    playTime += dt;
    player.update(dt);
    if (mouseHeld) tryShoot(t);
    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloading = false;
        ammo = CONFIG.magazineSize;
        sfx.reloadEnd();
        updateHud();
      }
    }
    manager.update(dt, player.pos, wave, t);

    // pickups
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const p = pickups[i];
      p.t += dt * 2.4;
      p.group.position.y = 0.45 + Math.sin(p.t) * 0.08;
      p.group.rotation.y += dt * 1.8;
      const d = Math.hypot(p.group.position.x - player.pos.x, p.group.position.z - player.pos.z);
      if (d < 1.4 && hp < CONFIG.playerMaxHealth) {
        hp = Math.min(CONFIG.playerMaxHealth, hp + CONFIG.medkitHeal);
        sfx.pickup();
        scene.remove(p.group);
        pickups.splice(i, 1);
        updateHud();
      }
    }

    // wave completion
    if (wavePhase === 'active' && manager.remainingCount === 0) {
      score += scoreFor('waveClear', wave);
      if (wave >= CONFIG.totalWaves) {
        updateHud();
        win();
      } else {
        wavePhase = 'intermission';
        interT = 2.6;
        showBanner(`WAVE ${wave} CLEARED`, `+${scoreFor('waveClear', wave)} points — next wave incoming`, 2.4);
        sfx.waveClear();
        updateHud();
      }
    } else if (wavePhase === 'intermission') {
      interT -= dt;
      if (interT <= 0) startWave(wave + 1);
    }

    const mm = String(Math.floor(playTime / 60)).padStart(2, '0');
    const ss = String(Math.floor(playTime % 60)).padStart(2, '0');
    els.timer.textContent = `${mm}:${ss}`;
    els.left.textContent = `${manager.remainingCount}`;
  }

  // shared visual effects, updated in every state
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const tr = tracers[i];
    tr.ttl -= dt;
    tr.line.material.opacity = Math.max(0, (tr.ttl / tr.max) * 0.9);
    if (tr.ttl <= 0) {
      scene.remove(tr.line);
      tr.line.geometry.dispose();
      tr.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.ttl -= dt;
    const attr = p.points.geometry.getAttribute('position');
    for (let j = 0; j < p.vel.length; j += 1) {
      p.vel[j].y -= 9 * dt;
      attr.setXYZ(j, attr.getX(j) + p.vel[j].x * dt, attr.getY(j) + p.vel[j].y * dt, attr.getZ(j) + p.vel[j].z * dt);
    }
    attr.needsUpdate = true;
    p.points.material.opacity = Math.max(0, p.ttl / p.max);
    if (p.ttl <= 0) {
      scene.remove(p.points);
      p.points.geometry.dispose();
      p.points.material.dispose();
      particles.splice(i, 1);
    }
  }
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 320);
  if (flashT > 0) {
    flashT -= dt;
    if (flashT <= 0) flashSprite.material.opacity = 0;
  }
  damageVig = Math.max(0, damageVig - dt * 1.3);
  const lowHp = state === 'playing' && hp <= 28 ? 0.22 + 0.08 * Math.sin(t * 6) : 0;
  els.vignette.style.opacity = `${Math.max(damageVig, lowHp)}`;
  if (hitmarkT > 0) {
    hitmarkT -= dt;
    els.hitmarker.style.opacity = hitmarkT > 0 ? '1' : '0';
  }
  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT <= 0) els.banner.classList.remove('visible');
  }
  drawRadar();

  renderer.render(scene, camera);
}

els.menu.classList.add('visible');
updateHud();
animate();
