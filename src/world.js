// Arena construction for STEELHAVEN: a night-time training compound with
// perimeter walls, cover crates, lamp posts and four enemy spawn gates.
// All cover is axis-aligned so movement collision can use plain AABBs.

import * as THREE from 'three';
import { CONFIG } from './logic.js';

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#23272c';
  g.fillRect(0, 0, 256, 256);
  // worn asphalt noise
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.16)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(140,160,180,0.35)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

// Cover layout: [x, z, width, depth, height]
const COVER = [
  [-10, -10, 4, 1.2, 2.2], [10, -10, 4, 1.2, 2.2],
  [-10, 10, 4, 1.2, 2.2], [10, 10, 4, 1.2, 2.2],
  [0, -18, 1.2, 5, 2.6], [0, 18, 1.2, 5, 2.6],
  [-18, 0, 5, 1.2, 2.6], [18, 0, 5, 1.2, 2.6],
  [-16, -20, 2.2, 2.2, 1.2], [16, -20, 2.2, 2.2, 1.2],
  [-16, 20, 2.2, 2.2, 1.2], [16, 20, 2.2, 2.2, 1.2],
  [-20, -6, 2.2, 2.2, 1.2], [20, 6, 2.2, 2.2, 1.2],
  [-6, -2, 2.2, 2.2, 1.2], [6, 3, 2.2, 2.2, 1.2],
  [0, 0, 3, 3, 1.1],
  [-24, 14, 3, 1.2, 2.2], [24, -14, 3, 1.2, 2.2],
  [12, 22, 2.2, 2.2, 1.2], [-12, -22, 2.2, 2.2, 1.2],
];

export function buildWorld(scene) {
  const half = CONFIG.arenaHalfSize;
  const walls = []; // meshes, used for bullet raycasts
  const colliders = []; // {minX, maxX, minZ, maxZ} for movement

  scene.background = new THREE.Color(0x0d1420);
  scene.fog = new THREE.Fog(0x0d1420, 34, 95);

  const hemi = new THREE.HemisphereLight(0xbdd3ff, 0x1c2018, 0.55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xdfe9ff, 1.1);
  moon.position.set(28, 42, -18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -40;
  scene.add(moon);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 30, half * 2 + 30),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d4653, roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a5142, roughness: 0.9 });
  const crateMatAlt = new THREE.MeshStandardMaterial({ color: 0x46586b, roughness: 0.9 });

  function addBox(x, z, w, d, h, mat, isWall = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (isWall) {
      // warning stripe along the top edge of perimeter walls
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w === 0 ? 0.3 : w, 0.18, d === 0 ? 0.3 : d),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 })
      );
      stripe.position.set(x, h + 0.09, z);
      scene.add(stripe);
    }
    return mesh;
  }

  // perimeter walls (thickness 1)
  addBox(0, -half - 0.5, half * 2 + 2, 1, 5, wallMat, true);
  addBox(0, half + 0.5, half * 2 + 2, 1, 5, wallMat, true);
  addBox(-half - 0.5, 0, 1, half * 2 + 2, 5, wallMat, true);
  addBox(half + 0.5, 0, 1, half * 2 + 2, 5, wallMat, true);

  COVER.forEach(([x, z, w, d, h], i) => {
    addBox(x, z, w, d, h, i % 3 === 0 ? crateMatAlt : crateMat);
  });

  // lamp posts with warm point lights
  const lampPositions = [[-22, -22], [22, -22], [-22, 22], [22, 22], [0, -8], [0, 8]];
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.4, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7, metalness: 0.5 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 2.2 });
  lampPositions.forEach(([x, z]) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bulbMat);
    bulb.position.set(x, 4.5, z);
    scene.add(bulb);
    const light = new THREE.PointLight(0xffc37a, 18, 26, 1.8);
    light.position.set(x, 4.4, z);
    scene.add(light);
  });

  // spawn gates: glowing pads in the four corners
  const spawnPoints = [];
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x1a0f0f, emissive: 0xff3b30, emissiveIntensity: 0.9, roughness: 0.5 });
  [[-26, -26], [26, -26], [-26, 26], [26, 26]].forEach(([x, z]) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 3.4), gateMat);
    pad.position.set(x, 0.06, z);
    scene.add(pad);
    spawnPoints.push(new THREE.Vector3(x, 0, z));
  });

  return {
    walls,
    colliders,
    spawnPoints,
    bounds: half - 1.2,
  };
}

// Push a circle (x/z + radius) out of every AABB collider and clamp to the
// arena bounds. Mutates and returns the position vector (y untouched).
export function resolveCollision(pos, radius, world) {
  for (const c of world.colliders) {
    const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        pos.x = closestX + (dx / dist) * radius;
        pos.z = closestZ + (dz / dist) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration
        const left = pos.x - c.minX;
        const right = c.maxX - pos.x;
        const near = pos.z - c.minZ;
        const far = c.maxZ - pos.z;
        const minPen = Math.min(left, right, near, far);
        if (minPen === left) pos.x = c.minX - radius;
        else if (minPen === right) pos.x = c.maxX + radius;
        else if (minPen === near) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  pos.x = Math.max(-world.bounds, Math.min(world.bounds, pos.x));
  pos.z = Math.max(-world.bounds, Math.min(world.bounds, pos.z));
  return pos;
}
