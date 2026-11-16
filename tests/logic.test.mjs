// Unit tests for the pure balance logic (src/logic.js). Run: npm test
import assert from 'node:assert/strict';
import {
  CONFIG,
  waveComposition,
  totalEnemies,
  enemyStats,
  damageFalloff,
  shooterHitChance,
  scoreFor,
} from '../src/logic.js';

// Wave rosters: exact sizes and both types present, growing over time
assert.equal(totalEnemies(1), 6);
assert.equal(totalEnemies(2), 9);
assert.equal(totalEnemies(3), 11);
assert.equal(totalEnemies(4), 14);
assert.equal(totalEnemies(5), 16);
for (let w = 1; w <= CONFIG.totalWaves; w += 1) {
  const list = waveComposition(w);
  assert.ok(list.includes('rusher'), `wave ${w} has rushers`);
  assert.ok(list.includes('shooter'), `wave ${w} has shooters`);
  assert.equal(list.length, totalEnemies(w));
}

// Enemy stats scale with waves and types differ meaningfully
assert.ok(enemyStats('rusher', 5).hp > enemyStats('rusher', 1).hp);
assert.ok(enemyStats('shooter', 1).hp > enemyStats('rusher', 1).hp);
assert.ok(enemyStats('rusher', 1).speed > enemyStats('shooter', 1).speed);
assert.ok(enemyStats('shooter', 1).attackRange > enemyStats('rusher', 1).attackRange);

// Damage falloff: full up close, monotonic decrease, floored at 45%
assert.equal(damageFalloff(100, 5), 100);
assert.equal(damageFalloff(100, 12), 100);
assert.ok(damageFalloff(100, 20) < 100);
assert.ok(damageFalloff(100, 30) < damageFalloff(100, 20));
assert.equal(damageFalloff(100, 45), 45);
assert.equal(damageFalloff(100, 90), 45);

// A full-health rusher on wave 1 dies to two body shots, one headshot
const rusherHp = enemyStats('rusher', 1).hp;
assert.ok(damageFalloff(CONFIG.weaponBaseDamage, 8) * 2 >= rusherHp);
assert.ok(damageFalloff(CONFIG.weaponBaseDamage, 8) * CONFIG.headshotMultiplier >= rusherHp);

// Shooter accuracy: clamped, worse with distance
assert.equal(shooterHitChance(0), 0.72);
assert.ok(shooterHitChance(40) < shooterHitChance(10));
assert.equal(shooterHitChance(100), 0.18);

// Scoring table
assert.equal(scoreFor('kill', 1), 100);
assert.equal(scoreFor('headshotKill', 1), 160);
assert.equal(scoreFor('waveClear', 3), 350);
assert.equal(scoreFor('nonsense', 1), 0);

console.log('logic.test.mjs: all assertions passed');
