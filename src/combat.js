import * as THREE from 'three';
import { createPirateShip } from './ship.js';
import { makeGlowTexture } from './textures.js';
import { onPress } from './input.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const PLAYER_LASER = 0xff3344;
const ENEMY_LASER = 0x44ff66;
const MISSILE_COLOR = 0xffaa33;
const HIT_CHANCE = 0.85;

/**
 * Player weapons. `power` is the Weapons power level needed for it to be
 * online. Laser is fast (two quick bolts, low damage); the missile is slow
 * (one heavy projectile, reloads for a turn) and uses ammo.
 */
export const WEAPONS = {
  laser: { name: 'Laser', power: 1, shots: 2, damage: [6, 10], hit: 0.85, overchargeBonus: 3 },
  missile: { name: 'Missile', power: 2, shots: 1, damage: [26, 34], hit: 0.95, ammo: 1, reload: 1 },
};
const ENEMY_SCALE = 1.35;

const glowTexture = makeGlowTexture();

function glowSprite(color, scale) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

/**
 * Short-lived visual effects. Each effect has update(dt) -> boolean (still alive)
 * and dispose().
 */
class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  add(effect) {
    this.list.push(effect);
  }

  update(dt) {
    this.list = this.list.filter((e) => {
      const alive = e.update(dt);
      if (!alive) e.dispose();
      return alive;
    });
  }

  /**
   * A laser bolt drawn with THREE.Line that extends from `from` to `to`, then fades.
   * WebGL lines are always 1px wide, so a few slightly offset lines are bundled
   * around the core to give the beam visible thickness.
   */
  laser(from, to, color) {
    const dir = to.clone().sub(from).normalize();
    const side = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) =>
      side.clone().multiplyScalar(a * 0.035).addScaledVector(up, b * 0.035)
    );

    const beam = new THREE.Group();
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const geometries = offsets.map(() => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      beam.add(new THREE.Line(geometry, material));
      return geometry;
    });
    // Soft glow travelling along the beam
    const trail = Array.from({ length: 6 }, () => glowSprite(color, 0.9));
    beam.add(...trail);
    const muzzle = glowSprite(color, 1.6);
    muzzle.position.copy(from);
    beam.add(muzzle);
    this.scene.add(beam);

    const extend = 0.12;
    const hold = 0.15;
    const fade = 0.3;
    const tip = new THREE.Vector3();
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const reach = Math.min(t / extend, 1);
        tip.lerpVectors(from, to, reach);
        geometries.forEach((geometry, i) => {
          const a = from.clone().add(offsets[i]);
          const b = tip.clone().add(offsets[i]);
          geometry.attributes.position.array.set([a.x, a.y, a.z, b.x, b.y, b.z]);
          geometry.attributes.position.needsUpdate = true;
        });
        trail.forEach((sprite, i) => sprite.position.lerpVectors(from, tip, (i + 0.5) / trail.length));
        const k = Math.max(t < extend + hold ? 1 : 1 - (t - extend - hold) / fade, 0);
        material.opacity = k;
        muzzle.material.opacity = k;
        for (const sprite of trail) sprite.material.opacity = k * 0.5;
        return t < extend + hold + fade;
      },
      dispose: () => {
        this.scene.remove(beam);
        geometries.forEach((g) => g.dispose());
        material.dispose();
        muzzle.material.dispose();
        trail.forEach((sprite) => sprite.material.dispose());
      },
    });
    return extend * 1000; // ms until the bolt reaches its target
  }

  flash(position, color, size, duration = 0.35) {
    const sprite = glowSprite(color, size);
    sprite.position.copy(position);
    this.scene.add(sprite);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = 1 - t / duration;
        sprite.material.opacity = Math.max(k, 0);
        sprite.scale.setScalar(size * (1 + t * 2));
        return t < duration;
      },
      dispose: () => {
        this.scene.remove(sprite);
        sprite.material.dispose();
      },
    });
  }

  /** Tints a ship's materials with an emissive colour that fades back to normal. */
  hitTint(ship, color, duration = 0.4) {
    const mats = [];
    ship.traverse((o) => {
      if (o.isMesh && o.material.emissive) {
        mats.push({ m: o.material, emissive: o.material.emissive.clone(), intensity: o.material.emissiveIntensity });
      }
    });
    const tint = new THREE.Color(color);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = Math.max(1 - t / duration, 0);
        for (const { m, emissive, intensity } of mats) {
          m.emissive.copy(emissive).lerp(tint, k);
          m.emissiveIntensity = intensity + k;
        }
        return t < duration;
      },
      dispose: () => {
        for (const { m, emissive, intensity } of mats) {
          m.emissive.copy(emissive);
          m.emissiveIntensity = intensity;
        }
      },
    });
  }

  /** A slow missile that arcs from `from` to `to`; resolves when it arrives. */
  missile(from, to) {
    const body = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8dde4, flatShading: true, metalness: 0.4, roughness: 0.4 })
    );
    shell.rotation.x = Math.PI / 2; // nose along +Z for lookAt
    body.add(shell);
    const exhaust = glowSprite(MISSILE_COLOR, 0.9);
    exhaust.position.z = -0.4;
    body.add(exhaust);
    body.position.copy(from);
    this.scene.add(body);

    const duration = 0.9;
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 2.2, 0)); // lofted arc
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const ahead = new THREE.Vector3();
    let t = 0;
    let trailTimer = 0;
    return new Promise((resolve) => {
      this.add({
        update: (dt) => {
          t += dt;
          const k = Math.min(t / duration, 1);
          const eased = k * k * (1.6 - 0.6 * k); // slow launch, accelerating in
          curve.getPoint(eased, body.position);
          curve.getPoint(Math.min(eased + 0.02, 1), ahead);
          if (ahead.distanceToSquared(body.position) > 1e-6) body.lookAt(ahead);
          trailTimer += dt;
          if (trailTimer > 0.03) {
            trailTimer = 0;
            this.flash(body.position, 0xbbbbbb, 0.5, 0.5); // smoke puff
          }
          if (k >= 1) resolve();
          return k < 1;
        },
        dispose: () => {
          this.scene.remove(body);
          shell.geometry.dispose();
          shell.material.dispose();
          exhaust.material.dispose();
        },
      });
    });
  }

  explosion(position, color) {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions.set([position.x, position.y, position.z], i * 3);
      velocities.push(new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 6));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.35,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.flash(position, 0xffcc88, 6, 0.6);

    const duration = 1.4;
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          positions[i * 3] += v.x * dt;
          positions[i * 3 + 1] += v.y * dt;
          positions[i * 3 + 2] += v.z * dt;
          v.multiplyScalar(1 - dt * 1.5);
        }
        geometry.attributes.position.needsUpdate = true;
        material.opacity = Math.max(1 - t / duration, 0);
        return t < duration;
      },
      dispose: () => {
        this.scene.remove(points);
        geometry.dispose();
        material.dispose();
      },
    });
  }
}

/**
 * Turn-based pirate encounter. The player attacks with a weapon button; the
 * pirate returns fire after each player shot until one side is destroyed.
 */
export class Combat {
  /**
   * @param onPlayerHit (dmg) => { message, outcome } where outcome is null,
   *   'destroyed' (hull gone) or 'crew' (no crew left).
   * @param enemyHitChance () => probability the pirate's shot lands.
   * @param onTurnEnd () => called after each full exchange (passive regen).
   */
  /**
   * @param weaponPower () => current Weapons power level.
   * @param ammo { count: () => number, use: () => void } missile ammo.
   * @param difficulty () => sectorDifficulty() for the current sector.
   */
  constructor({ scene, playerShip, enemyPosition, ui, onPlayerHit, enemyHitChance, onTurnEnd, onEnd, weaponPower, ammo, difficulty }) {
    this.scene = scene;
    this.playerShip = playerShip;
    this.enemyPosition = enemyPosition;
    this.ui = ui;
    this.onPlayerHit = onPlayerHit;
    this.enemyHitChance = enemyHitChance;
    this.onTurnEnd = onTurnEnd;
    this.onEnd = onEnd;
    this.weaponPower = weaponPower;
    this.ammo = ammo;
    this.difficulty = difficulty;
    this.missileReload = 0; // turns until the launcher can fire again
    this.effects = new Effects(scene);
    this.active = false;
    this.busy = false;
    this.enemy = null;
    this.playerHomeQuat = playerShip.quaternion.clone();
    this.playerTargetQuat = null;
    onPress(this.ui.laser, () => this.attack('laser'));
    onPress(this.ui.missile, () => this.attack('missile'));
  }

  async start() {
    this.active = true;
    this.busy = true;
    this.level = this.difficulty();
    this.enemyMaxHp = this.level.enemyHp;
    this.enemyHp = this.enemyMaxHp;

    const enemy = createPirateShip();
    enemy.position.copy(this.enemyPosition);
    enemy.lookAt(this.playerShip.position);
    enemy.scale.setScalar(0.001);
    this.scene.add(enemy);
    this.enemy = enemy;
    this.enemyBase = enemy.position.clone();
    this.enemyScaleT = 0;
    this.effects.flash(enemy.position, ENEMY_LASER, 8, 0.8);

    // Turn the player to face the pirate
    const facing = new THREE.Object3D();
    facing.position.copy(this.playerShip.position);
    facing.lookAt(enemy.position);
    this.playerTargetQuat = facing.quaternion.clone();

    this.renderEnemyHp();
    this.log('A pirate raider drops out of warp!');
    this.missileReload = 0;
    this.ui.panel.classList.add('show');
    this.renderWeapons();
    await wait(900);
    this.busy = false;
    this.renderWeapons();
    this.log(this.weaponPower() > 0 ? 'Your move, captain.' : 'Weapons are unpowered — route reactor power to Weapons!');
  }

  muzzle(ship) {
    return ship.localToWorld(new THREE.Vector3(0, 0, 1.6));
  }

  /** Fires a laser from `shooter` at `target`; resolves to whether it hit. */
  async fire(shooter, target, color, hitChance = HIT_CHANCE) {
    const hit = Math.random() < hitChance;
    const from = this.muzzle(shooter);
    const to = target.position.clone();
    if (hit) {
      to.add(new THREE.Vector3().randomDirection().multiplyScalar(0.3));
    } else {
      // Sail past the target
      to.add(new THREE.Vector3().randomDirection().multiplyScalar(2.5));
      to.add(to.clone().sub(from).normalize().multiplyScalar(6));
    }
    const travelMs = this.effects.laser(from, to, color);
    await wait(travelMs);
    if (hit) {
      this.effects.flash(to, color, 2.5);
      this.effects.hitTint(target, color);
    }
    return hit;
  }

  /** Why a weapon can't fire right now, or null if it's ready. */
  weaponBlocked(id) {
    const w = WEAPONS[id];
    if (this.weaponPower() < w.power) return 'Unpowered';
    if (id === 'missile' && this.missileReload > 0) return 'Reloading';
    if (w.ammo && this.ammo.count() < w.ammo) return 'No ammo';
    return null;
  }

  /** Refreshes the weapon buttons (power, ammo, reload). Safe to call any time. */
  renderWeapons() {
    const overcharged = this.weaponPower() >= 3;
    const laserDmg = WEAPONS.laser.damage.map((d) => d + (overcharged ? WEAPONS.laser.overchargeBonus : 0));
    const details = {
      laser: `2× ${laserDmg[0]}–${laserDmg[1]} dmg${overcharged ? ' ⚡' : ''}`,
      missile: `${WEAPONS.missile.damage.join('–')} dmg · ammo ${this.ammo.count()}`,
    };
    for (const id of Object.keys(WEAPONS)) {
      const btn = this.ui[id];
      const blocked = this.weaponBlocked(id);
      btn.disabled = !this.active || this.busy || Boolean(blocked);
      btn.querySelector('.weapon-detail').textContent = blocked ? `${blocked} · ${details[id]}` : details[id];
      btn.classList.toggle('offline', blocked === 'Unpowered');
    }
  }

  damageRoll(id) {
    const w = WEAPONS[id];
    const bonus = id === 'laser' && this.weaponPower() >= 3 ? w.overchargeBonus : 0;
    return randInt(w.damage[0], w.damage[1]) + bonus;
  }

  /** Player turn with the chosen weapon, then the pirate's reply. */
  async attack(id) {
    if (!this.active || this.busy || this.weaponBlocked(id)) return;
    this.busy = true;
    this.renderWeapons();
    const w = WEAPONS[id];

    let total = 0;
    let hits = 0;
    if (id === 'laser') {
      // Fast: two bolts in quick succession
      for (let i = 0; i < w.shots && this.enemyHp > 0; i++) {
        const hit = await this.fire(this.playerShip, this.enemy, PLAYER_LASER, w.hit);
        if (hit) {
          const dmg = this.damageRoll(id);
          total += dmg;
          hits += 1;
          this.enemyHp = Math.max(this.enemyHp - dmg, 0);
          this.renderEnemyHp();
        }
        await wait(140);
      }
      this.log(hits ? `Laser ${hits}/${w.shots} hits! Pirate takes ${total} damage.` : 'Both laser bolts miss.');
    } else {
      // Slow: one heavy missile, then the launcher reloads
      this.ammo.use();
      this.missileReload = w.reload + 1; // +1 because the end of this turn ticks it down
      this.renderWeapons();
      this.log('Missile away…');
      const hit = Math.random() < w.hit;
      const from = this.muzzle(this.playerShip);
      const to = this.enemy.position.clone();
      if (!hit) to.add(new THREE.Vector3(0, 2.5, 0)).add(to.clone().sub(from).normalize().multiplyScalar(5));
      await this.effects.missile(from, to);
      if (hit) {
        const dmg = this.damageRoll(id);
        this.enemyHp = Math.max(this.enemyHp - dmg, 0);
        this.renderEnemyHp();
        this.effects.flash(to, MISSILE_COLOR, 5, 0.5);
        this.effects.hitTint(this.enemy, MISSILE_COLOR);
        this.log(`Missile impact! Pirate takes ${dmg} damage.`);
      } else {
        this.log('The missile streaks past the pirate.');
      }
    }

    if (this.enemyHp <= 0) {
      await wait(300);
      this.effects.explosion(this.enemy.position, 0x88ffaa);
      this.scene.remove(this.enemy);
      this.enemy = null;
      const scrap = Math.round(randInt(15, 30) * this.level.scrapMultiplier);
      this.log(`Pirate destroyed! Salvaged ${scrap} scrap.`);
      await wait(1400);
      this.finish({ result: 'win', scrap });
      return;
    }

    // Enemy turn
    await wait(650);
    const enemyHit = await this.fire(this.enemy, this.playerShip, ENEMY_LASER, Math.min(this.enemyHitChance() + this.level.enemyAccuracy, 0.95));
    let outcome = null;
    if (enemyHit) {
      const hit = this.onPlayerHit(randInt(...this.level.enemyDamage));
      outcome = hit.outcome;
      this.log(hit.message);
    } else {
      this.log('The pirate fires and misses.');
    }

    if (outcome === 'destroyed') {
      await wait(300);
      this.effects.explosion(this.playerShip.position, 0xff8866);
      this.playerShip.visible = false;
      this.log('Hull breach! Your ship is destroyed.');
      await wait(1600);
      this.finish({ result: 'lose', reason: 'pirates' });
      return;
    }
    if (outcome === 'crew') {
      await wait(1600);
      this.finish({ result: 'lose', reason: 'crew' });
      return;
    }

    this.onTurnEnd();
    this.missileReload = Math.max(this.missileReload - 1, 0);
    await wait(250);
    this.busy = false;
    this.renderWeapons();
  }

  finish(outcome) {
    this.active = false;
    this.busy = false;
    this.playerTargetQuat = this.playerHomeQuat.clone();
    this.ui.panel.classList.remove('show');
    this.renderWeapons();
    this.onEnd(outcome);
  }

  renderEnemyHp() {
    const pct = (this.enemyHp / this.enemyMaxHp) * 100;
    this.ui.enemyHpFill.style.width = `${pct}%`;
    this.ui.enemyHpText.textContent = `${this.enemyHp} / ${this.enemyMaxHp}`;
  }

  log(message) {
    this.ui.log.textContent = message;
  }

  update(dt, t) {
    this.effects.update(dt);

    if (this.enemy) {
      this.enemyScaleT = Math.min(this.enemyScaleT + dt / 0.6, 1);
      const s = 1 - Math.pow(1 - this.enemyScaleT, 3);
      this.enemy.scale.setScalar(Math.max(s * ENEMY_SCALE, 0.001));
      this.enemy.position.y = this.enemyBase.y + Math.sin(t * 1.4 + 1) * 0.12;
    }

    if (this.playerTargetQuat) {
      this.playerShip.quaternion.slerp(this.playerTargetQuat, Math.min(dt * 3, 1));
      if (!this.active && this.playerShip.quaternion.angleTo(this.playerTargetQuat) < 0.001) {
        this.playerShip.quaternion.copy(this.playerTargetQuat);
        this.playerTargetQuat = null;
      }
    }
  }
}
