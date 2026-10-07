import * as THREE from 'three';

const STREAKS = 700;
const FAR = -420; // camera-space z where streaks spawn
const CHARGE = 1.5; // seconds of acceleration before the jump flash
const DURATION = 2.4; // total seconds

const easeIn = (t) => t * t * t;

/**
 * Hyperspace warp: a tunnel of light streaks rushing past the camera, plus a
 * field-of-view kick. Streaks live in camera space (the group is a child of
 * the camera), so the effect works from whatever angle the camera is at.
 * play() resolves when the effect ends and calls onPeak at the jump flash.
 */
export class WarpEffect {
  constructor(camera) {
    this.camera = camera;
    this.baseFov = camera.fov;

    this.positions = new Float32Array(STREAKS * 6); // head + tail per streak
    const colors = new Float32Array(STREAKS * 6);
    this.streaks = [];
    const color = new THREE.Color();
    for (let i = 0; i < STREAKS; i++) {
      // Spawn in a ring around the view axis, leaving the middle (the ship) clear
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.pow(Math.random(), 0.7) * 60;
      this.streaks.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: FAR * Math.random(),
        speed: 0.6 + Math.random() * 0.8,
      });
      color.setHSL(0.55 + Math.random() * 0.1, 0.8, 0.75 + Math.random() * 0.25);
      colors.set([color.r, color.g, color.b, 0, 0, 0], i * 6); // tail fades to black (= invisible when additive)
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.lines.renderOrder = 10;
    camera.add(this.lines);
    this.state = null;
  }

  get playing() {
    return this.state !== null;
  }

  play({ onPeak } = {}) {
    return new Promise((resolve) => {
      this.state = { t: 0, onPeak, peaked: false, resolve };
      this.lines.visible = true;
    });
  }

  update(dt) {
    const st = this.state;
    if (!st) return;
    st.t += dt;
    const { t } = st;

    // Speed ramps up hard during the charge, then the tunnel fades out
    const charge = Math.min(t / CHARGE, 1);
    const speed = 30 + 1400 * easeIn(charge);
    const fade = t < CHARGE ? charge : Math.max(1 - (t - CHARGE) / (DURATION - CHARGE), 0);
    this.material.opacity = Math.min(fade * 1.4, 1);

    for (let i = 0; i < STREAKS; i++) {
      const s = this.streaks[i];
      s.z += speed * s.speed * dt;
      if (s.z > 5) s.z = FAR - Math.random() * 80;
      const length = 2 + speed * s.speed * 0.045; // longer trails at higher speed
      this.positions.set([s.x, s.y, s.z, s.x, s.y, s.z - length], i * 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;

    // Field-of-view kick: widen while charging, snap back after the jump
    const fovKick = t < CHARGE ? easeIn(charge) * 32 : 32 * Math.max(1 - (t - CHARGE) / 0.6, 0);
    this.camera.fov = this.baseFov + fovKick;
    this.camera.updateProjectionMatrix();

    if (!st.peaked && t >= CHARGE) {
      st.peaked = true;
      st.onPeak?.();
    }
    if (t >= DURATION) {
      this.state = null;
      this.lines.visible = false;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      st.resolve();
    }
  }
}

export const WARP_TIMING = { charge: CHARGE, duration: DURATION };
