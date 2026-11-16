// First-person player controller: pointer-lock mouse look, WASD movement
// with acceleration/friction, sprint, a small jump, head-bob, and the gun
// view-model with recoil. Shooting itself lives in main.js; this class
// only exposes where the muzzle is and how the camera moves.

import * as THREE from 'three';
import { resolveCollision } from './world.js';

const EYE_HEIGHT = 1.66;
const BASE_SPEED = 6.4;
const SPRINT_MULT = 1.45;

export class Player {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.dom = domElement;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 24); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = 0; // spawn looks toward -Z, i.e. into the arena
    this.pitch = 0;
    this.vy = 0;
    this.grounded = true;
    this.keys = new Set();
    this.locked = false;
    this.bobT = 0;
    this.kick = 0;

    camera.rotation.order = 'YXZ';

    this.gun = this.buildGun();
    camera.add(this.gun.group);

    this.onLockChange = null;

    document.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space') ev.preventDefault();
      this.keys.add(ev.code);
    });
    document.addEventListener('keyup', (ev) => this.keys.delete(ev.code));
    document.addEventListener('mousemove', (ev) => {
      if (!this.locked) return;
      this.yaw -= ev.movementX * 0.0021;
      this.pitch -= ev.movementY * 0.0021;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  buildGun() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.45, metalness: 0.65 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.52), dark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 10), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.38);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), dark);
    grip.position.set(0, -0.13, 0.08);
    grip.rotation.x = 0.35;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), accent);
    sight.position.set(0, 0.1, -0.05);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), accent);
    mag.position.set(0, -0.14, -0.08);
    group.add(body, barrel, grip, sight, mag);
    group.position.set(0.26, -0.24, -0.55);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.03, -0.55);
    group.add(muzzle);
    return { group, muzzle };
  }

  lock() {
    this.dom.requestPointerLock();
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  reset() {
    this.pos.set(0, 0, 24);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.kick = 0;
  }

  addKick() {
    this.kick = Math.min(1, this.kick + 0.55);
    this.pitch += 0.006; // slight muzzle climb
  }

  getMuzzleWorldPos(out) {
    return this.gun.muzzle.getWorldPosition(out);
  }

  update(dt) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = BASE_SPEED * (sprinting ? SPRINT_MULT : 1);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const accel = this.grounded ? 14 : 3;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, accel * dt);

    if (this.keys.has('Space') && this.grounded) {
      this.vy = 4.6;
      this.grounded = false;
    }
    this.vy -= 12.5 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vy = 0;
      this.grounded = true;
    }

    this.pos.addScaledVector(this.vel, dt);
    resolveCollision(this.pos, 0.45, this.world);

    const horizontalSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (horizontalSpeed > 0.6 && this.grounded) this.bobT += dt * horizontalSpeed * 1.4;
    const bobY = Math.sin(this.bobT * 2) * 0.028 * Math.min(1, horizontalSpeed / BASE_SPEED);
    const bobX = Math.cos(this.bobT) * 0.016 * Math.min(1, horizontalSpeed / BASE_SPEED);

    this.camera.position.set(this.pos.x + bobX * Math.cos(this.yaw), this.pos.y + EYE_HEIGHT + bobY, this.pos.z - bobX * Math.sin(this.yaw));
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;

    // gun recoil recovery + subtle sway from bob
    this.kick = Math.max(0, this.kick - dt * 7);
    this.gun.group.position.z = -0.55 + this.kick * 0.07;
    this.gun.group.position.y = -0.24 + Math.abs(bobY) * 0.6 - this.kick * 0.02;
    this.gun.group.rotation.x = this.kick * 0.16;
  }
}
