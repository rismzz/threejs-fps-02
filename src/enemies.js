// Enemy actors and their simple tactical AI.
//
// Two types:
//  - rusher: sprints at the player and deals melee damage up close.
//  - shooter: keeps a mid-range distance, strafes sideways, and fires
//    bursts of three shots with distance-based accuracy. It only fires
//    with a clear line of sight, otherwise it repositions.
//
// hooks = {
//   onPlayerDamage(amount),          player takes damage
//   spawnTracer(from, to, color),    visual tracer line
//   onEnemyShoot(),                  sound cue
// }

import * as THREE from 'three';
import { CONFIG, enemyStats, shooterHitChance } from './logic.js';
import { resolveCollision } from './world.js';

const bodyGeo = new THREE.BoxGeometry(0.62, 1.02, 0.34);
const headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
const gunGeo = new THREE.BoxGeometry(0.08, 0.14, 0.55);

const TYPE_COLORS = {
  rusher: { body: 0xb3402a, head: 0xd9a066, accent: 0xff6b4a },
  shooter: { body: 0x3a4f8a, head: 0xd9a066, accent: 0x6ea8ff },
};

function buildEnemyMesh(type) {
  const colors = TYPE_COLORS[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.8 });
  const headMat = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.68;
  head.castShadow = true;
  // glowing visor so enemies read clearly at night
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.07, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: colors.accent, emissiveIntensity: 2.4 })
  );
  visor.position.set(0, 1.7, 0.18);
  const gun = new THREE.Mesh(gunGeo, new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.5, metalness: 0.6 }));
  gun.position.set(0.24, 1.12, 0.3);
  group.add(body, head, visor, gun);
  return { group, body, head };
}

export class EnemyManager {
  constructor(scene, world, hooks) {
    this.scene = scene;
    this.world = world;
    this.hooks = hooks;
    this.enemies = [];
    this.queue = [];
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.raycaster = new THREE.Raycaster();
    this.tmpDir = new THREE.Vector3();
  }

  startWave(types) {
    this.queue = [...types];
    this.spawnTimer = 0;
  }

  get aliveCount() {
    return this.enemies.filter((e) => e.state !== 'dying').length;
  }

  get remainingCount() {
    return this.queue.length + this.aliveCount;
  }

  getHitMeshes() {
    const meshes = [];
    for (const e of this.enemies) {
      if (e.state === 'dying') continue;
      meshes.push(e.body, e.head);
    }
    return meshes;
  }

  spawnOne(type, wave) {
    const stats = enemyStats(type, wave);
    const { group, body, head } = buildEnemyMesh(type);
    const point = this.world.spawnPoints[this.spawnIndex % this.world.spawnPoints.length];
    this.spawnIndex += 1;
    group.position.copy(point);
    group.scale.setScalar(0.2);
    this.scene.add(group);
    const enemy = {
      type,
      wave,
      hp: stats.hp,
      maxHp: stats.hp,
      stats,
      group,
      body,
      head,
      state: 'spawning',
      stateT: 0,
      attackT: 1 + Math.random(),
      burstLeft: 0,
      burstT: 0,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeT: 1.5 + Math.random() * 1.5,
      flashT: 0,
      seed: Math.random() * Math.PI * 2,
    };
    body.userData.enemy = enemy;
    body.userData.part = 'body';
    head.userData.enemy = enemy;
    head.userData.part = 'head';
    this.enemies.push(enemy);
    return enemy;
  }

  // Apply damage; returns 'hit' | 'kill' | null.
  damage(enemy, amount) {
    if (enemy.state === 'dying') return null;
    enemy.hp -= amount;
    enemy.flashT = 0.07;
    enemy.body.material.emissive.setHex(0xffffff);
    enemy.head.material.emissive.setHex(0xffffff);
    if (enemy.hp <= 0) {
      enemy.state = 'dying';
      enemy.stateT = 0;
      return 'kill';
    }
    return 'hit';
  }

  hasLineOfSight(from, to) {
    this.tmpDir.subVectors(to, from);
    const dist = this.tmpDir.length();
    this.raycaster.set(from, this.tmpDir.normalize());
    this.raycaster.far = dist - 0.6;
    const hits = this.raycaster.intersectObjects(this.world.walls, false);
    return hits.length === 0;
  }

  update(dt, playerPos, wave, elapsed) {
    // spawn queue
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.aliveCount < CONFIG.maxConcurrentEnemies) {
        this.spawnOne(this.queue.shift(), wave);
        this.spawnTimer = CONFIG.spawnIntervalSeconds;
      }
    }

    const playerHead = new THREE.Vector3(playerPos.x, playerPos.y + 1.55, playerPos.z);

    for (const e of this.enemies) {
      if (e.flashT > 0) {
        e.flashT -= dt;
        if (e.flashT <= 0) {
          e.body.material.emissive.setHex(0x000000);
          e.head.material.emissive.setHex(0x000000);
        }
      }

      if (e.state === 'spawning') {
        e.stateT += dt;
        const k = Math.min(1, e.stateT / 0.5);
        e.group.scale.setScalar(0.2 + 0.8 * k);
        if (k >= 1) e.state = 'active';
        continue;
      }

      if (e.state === 'dying') {
        e.stateT += dt;
        const t = e.stateT;
        e.group.rotation.x = -Math.min(1, t / 0.3) * Math.PI * 0.48;
        if (t > 0.45) e.group.position.y = -(t - 0.45) * 0.9;
        continue;
      }

      // active AI
      const pos = e.group.position;
      const dx = playerPos.x - pos.x;
      const dz = playerPos.z - pos.z;
      const dist = Math.hypot(dx, dz);
      e.group.rotation.y = Math.atan2(dx, dz);

      const move = new THREE.Vector3();

      if (e.type === 'rusher') {
        if (dist > e.stats.attackRange * 0.85) {
          move.set(dx / dist, 0, dz / dist).multiplyScalar(e.stats.speed);
          // slight weave so rushers are not trivially easy to track
          move.x += Math.sin(elapsed * 3 + e.seed) * 0.7;
          move.z += Math.cos(elapsed * 2.6 + e.seed) * 0.7;
        } else {
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = e.stats.attackCooldown;
            this.hooks.onPlayerDamage(e.stats.damage);
          }
        }
      } else {
        // shooter: hold a 13-19 m band, strafe inside it
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafeT = 1.4 + Math.random() * 1.6;
          e.strafeDir = Math.random() > 0.5 ? 1 : -1;
        }
        const radial = new THREE.Vector3(dx / dist, 0, dz / dist);
        if (dist > 19) move.add(radial.clone().multiplyScalar(e.stats.speed));
        else if (dist < 11) move.add(radial.clone().multiplyScalar(-e.stats.speed));
        const tangent = new THREE.Vector3(-radial.z, 0, radial.x).multiplyScalar(e.strafeDir * e.stats.speed * 0.55);
        move.add(tangent);

        // firing cycle: burst of 3, then cooldown
        if (e.burstLeft > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            e.burstLeft -= 1;
            e.burstT = 0.13;
            this.fireAt(e, playerHead, dist);
          }
        } else {
          e.attackT -= dt;
          if (e.attackT <= 0 && dist <= e.stats.attackRange) {
            const from = new THREE.Vector3(pos.x, 1.35, pos.z);
            if (this.hasLineOfSight(from, playerHead)) {
              e.burstLeft = 3;
              e.burstT = 0;
            } else {
              // no line of sight: push toward the player to find an angle
              move.add(radial.clone().multiplyScalar(e.stats.speed * 1.4));
              e.attackT = 0.3;
            }
            if (e.burstLeft > 0) e.attackT = e.stats.attackCooldown * (0.85 + Math.random() * 0.4);
          }
        }
      }

      if (move.lengthSq() > 0) {
        pos.addScaledVector(move, dt);
      }
    }

    // separation so enemies do not stack inside each other
    const alive = this.enemies.filter((e) => e.state === 'active');
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        const a = alive[i].group.position;
        const b = alive[j].group.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.1 * 1.1 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((1.1 - d) / d) * 0.5;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
        }
      }
    }
    for (const e of alive) {
      resolveCollision(e.group.position, 0.5, this.world);
    }

    // remove finished corpses
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.state === 'dying' && e.stateT > 0.95) {
        this.scene.remove(e.group);
        e.body.material.dispose();
        e.head.material.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  fireAt(enemy, playerHead, dist) {
    const from = new THREE.Vector3(enemy.group.position.x, 1.3, enemy.group.position.z);
    // spread: shots land near the player, tighter when close
    const spread = 0.6 + dist * 0.03;
    const target = playerHead.clone();
    target.x += (Math.random() - 0.5) * spread;
    target.y += (Math.random() - 0.5) * spread * 0.6;
    target.z += (Math.random() - 0.5) * spread;
    this.hooks.spawnTracer(from, target, 0xff5040);
    this.hooks.onEnemyShoot();
    if (Math.random() < shooterHitChance(dist)) {
      this.hooks.onPlayerDamage(enemy.stats.damage);
    }
  }

  clear() {
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      e.body.material.dispose();
      e.head.material.dispose();
    }
    this.enemies = [];
    this.queue = [];
  }
}
