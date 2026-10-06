import * as THREE from 'three';
import { createPirateShip } from './ship.js';
import { makeGlowTexture } from './textures.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const PLAYER_LASER = 0xff3344;
const ENEMY_LASER = 0x44ff66;
const ENEMY_MAX_HP = 60;
const HIT_CHANCE = 0.85;
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
 * Turn-based pirate encounter. The player attacks via the UI button; the
 * pirate returns fire after each player shot until one side is destroyed.
 */
export class Combat {
  constructor({ scene, playerShip, enemyPosition, state, ui, onHullChange, onEnd }) {
    this.scene = scene;
    this.playerShip = playerShip;
    this.enemyPosition = enemyPosition;
    this.state = state;
    this.ui = ui;
    this.onHullChange = onHullChange;
    this.onEnd = onEnd;
    this.effects = new Effects(scene);
    this.active = false;
    this.busy = false;
    this.enemy = null;
    this.playerHomeQuat = playerShip.quaternion.clone();
    this.playerTargetQuat = null;
    this.ui.attack.addEventListener('click', () => this.attack());
  }

  async start() {
    this.active = true;
    this.busy = true;
    this.enemyHp = ENEMY_MAX_HP;

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
    this.ui.panel.classList.add('show');
    this.ui.attack.disabled = true;
    await wait(900);
    this.busy = false;
    this.ui.attack.disabled = false;
    this.log('Your move, captain.');
  }

  muzzle(ship) {
    return ship.localToWorld(new THREE.Vector3(0, 0, 1.6));
  }

  /** Fires a laser from `shooter` at `target`; resolves to whether it hit. */
  async fire(shooter, target, color) {
    const hit = Math.random() < HIT_CHANCE;
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

  async attack() {
    if (!this.active || this.busy) return;
    this.busy = true;
    this.ui.attack.disabled = true;

    // Player turn
    const hit = await this.fire(this.playerShip, this.enemy, PLAYER_LASER);
    if (hit) {
      const dmg = randInt(14, 24);
      this.enemyHp = Math.max(this.enemyHp - dmg, 0);
      this.renderEnemyHp();
      this.log(`Laser hit! Pirate takes ${dmg} damage.`);
    } else {
      this.log('Your shot misses.');
    }

    if (this.enemyHp <= 0) {
      await wait(300);
      this.effects.explosion(this.enemy.position, 0x88ffaa);
      this.scene.remove(this.enemy);
      this.enemy = null;
      const scrap = randInt(15, 30);
      this.log(`Pirate destroyed! Salvaged ${scrap} scrap.`);
      await wait(1400);
      this.finish({ result: 'win', scrap });
      return;
    }

    // Enemy turn
    await wait(650);
    const enemyHit = await this.fire(this.enemy, this.playerShip, ENEMY_LASER);
    if (enemyHit) {
      const dmg = randInt(8, 16);
      this.state.hull = Math.max(this.state.hull - dmg, 0);
      this.onHullChange(dmg);
      this.log(`Pirate laser hits! Hull −${dmg}.`);
    } else {
      this.log('The pirate fires and misses.');
    }

    if (this.state.hull <= 0) {
      await wait(300);
      this.effects.explosion(this.playerShip.position, 0xff8866);
      this.playerShip.visible = false;
      this.log('Hull breach! Your ship is destroyed.');
      await wait(1600);
      this.finish({ result: 'lose' });
      return;
    }

    await wait(250);
    this.busy = false;
    this.ui.attack.disabled = false;
  }

  finish(outcome) {
    this.active = false;
    this.busy = false;
    this.playerTargetQuat = this.playerHomeQuat.clone();
    this.ui.panel.classList.remove('show');
    this.onEnd(outcome);
  }

  renderEnemyHp() {
    const pct = (this.enemyHp / ENEMY_MAX_HP) * 100;
    this.ui.enemyHpFill.style.width = `${pct}%`;
    this.ui.enemyHpText.textContent = `${this.enemyHp} / ${ENEMY_MAX_HP}`;
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
