// Pure game-balance logic for STEELHAVEN (threejs-fps-02 entry).
// No three.js and no DOM dependencies, so this module can be unit-tested
// directly in Node (see tests/logic.test.mjs). Every tuning number for the
// game lives here so balance changes never touch rendering code.

export const CONFIG = {
  totalWaves: 5,
  playerMaxHealth: 100,
  magazineSize: 30,
  reloadSeconds: 1.35,
  fireIntervalSeconds: 0.115,
  weaponBaseDamage: 34,
  headshotMultiplier: 2.6,
  maxConcurrentEnemies: 7,
  spawnIntervalSeconds: 0.9,
  medkitHeal: 30,
  medkitDropChance: 0.25,
  arenaHalfSize: 32,
};

// Deterministic wave roster. Rushers close distance and hit in melee;
// shooters keep range and fire bursts. Later waves mix more of both.
export function waveComposition(wave) {
  const rushers = 3 + wave; // wave 1: 4 ... wave 5: 8
  const shooters = 1 + Math.floor(wave * 1.5); // w1: 2, w2: 4, w3: 5, w4: 7, w5: 8
  const list = [];
  let r = rushers;
  let s = shooters;
  let i = 0;
  while (r > 0 || s > 0) {
    if (s > 0 && i % 3 === 2) {
      list.push('shooter');
      s -= 1;
    } else if (r > 0) {
      list.push('rusher');
      r -= 1;
    } else {
      list.push('shooter');
      s -= 1;
    }
    i += 1;
  }
  return list;
}

export function totalEnemies(wave) {
  return waveComposition(wave).length;
}

// Per-type stats, scaled gently with the wave number.
export function enemyStats(type, wave) {
  const scale = 1 + (wave - 1) * 0.12;
  if (type === 'rusher') {
    return {
      hp: Math.round(55 * scale),
      speed: 4.3 + wave * 0.12,
      damage: 9 + wave,
      attackRange: 2.0,
      attackCooldown: 0.9,
    };
  }
  return {
    hp: Math.round(80 * scale),
    speed: 2.6 + wave * 0.08,
    damage: 6 + Math.floor(wave / 2),
    attackRange: 26,
    attackCooldown: 1.9,
  };
}

// Hitscan damage: full damage up close, easing down to 45% at long range.
export function damageFalloff(base, distance) {
  if (distance <= 12) return base;
  if (distance >= 45) return base * 0.45;
  const t = (distance - 12) / 33;
  return base * (1 - 0.55 * t);
}

// Enemy shooters are dangerous up close and sloppy at range.
export function shooterHitChance(distance) {
  const c = 0.72 - distance * 0.011;
  return Math.min(0.72, Math.max(0.18, c));
}

export function scoreFor(kind, wave) {
  switch (kind) {
    case 'kill':
      return 100;
    case 'headshotKill':
      return 160;
    case 'waveClear':
      return 200 + 50 * wave;
    default:
      return 0;
  }
}
