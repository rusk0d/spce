import * as THREE from 'three';
import { createShip } from './ship.js';

const SYSTEM_NAMES = [
  'Kepler Reach', 'Vesta Prime', 'Orion Drift', 'Tauri Gate', 'Nyx Hollow', 'Helios IV',
  'Cygnus Rest', 'Lyra Verge', 'Draco Spur', 'Zeta Cross', 'Antares Fold', 'Mira Station',
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomPlanet() {
  const hue = Math.random();
  return {
    hue,
    color: new THREE.Color().setHSL(hue, 0.45 + Math.random() * 0.25, 0.4 + Math.random() * 0.15),
    glow: new THREE.Color().setHSL(hue, 0.8, 0.65),
    ringColor: new THREE.Color().setHSL((hue + 0.08 + Math.random() * 0.2) % 1, 0.85, 0.65),
    hasRing: Math.random() < 0.7,
    ringTilt: 0.15 + Math.random() * 0.5,
    size: 0.75 + Math.random() * 0.5,
    bandSeed: Math.random() * 1000,
  };
}

/**
 * Builds a connected graph of 5–8 star systems laid out on the XZ plane.
 * A minimum spanning tree guarantees every node is reachable, then a few
 * short extra links add route choices.
 */
export function generateGalaxy() {
  const count = 5 + Math.floor(Math.random() * 4);
  const radius = 34;
  const minDist = 13;
  const positions = [];
  for (let attempts = 0; positions.length < count && attempts < 5000; attempts++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (positions.every((q) => q.distanceTo(p) >= minDist)) positions.push(p);
  }

  const names = shuffle(SYSTEM_NAMES);
  const nodes = positions.map((position, id) => ({
    id,
    name: names[id],
    position,
    planet: randomPlanet(),
    neighbors: new Set(),
  }));

  const edges = [];
  const link = (a, b) => {
    if (a === b || nodes[a].neighbors.has(b)) return;
    nodes[a].neighbors.add(b);
    nodes[b].neighbors.add(a);
    edges.push([a, b]);
  };

  // Prim's MST
  const inTree = new Set([0]);
  while (inTree.size < nodes.length) {
    let best = null;
    for (const a of inTree) {
      for (const n of nodes) {
        if (inTree.has(n.id)) continue;
        const d = nodes[a].position.distanceTo(n.position);
        if (!best || d < best.d) best = { a, b: n.id, d };
      }
    }
    link(best.a, best.b);
    inTree.add(best.b);
  }

  // Extra short links for alternative routes
  for (const n of nodes) {
    if (Math.random() > 0.45) continue;
    const candidate = nodes
      .filter((m) => m.id !== n.id && !n.neighbors.has(m.id))
      .map((m) => ({ id: m.id, d: m.position.distanceTo(n.position) }))
      .sort((x, y) => x.d - y.d)[0];
    if (candidate && candidate.d < 32) link(n.id, candidate.id);
  }

  return { nodes, edges };
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 3D galaxy-map view: star nodes, hyperlane edges, a ship marker and HTML labels. */
export class GalaxyMap {
  constructor(galaxy, center, labelContainer) {
    this.galaxy = galaxy;
    this.group = new THREE.Group();
    this.group.position.copy(center);
    this.currentId = 0;
    this.travel = null;
    this.labelContainer = labelContainer;

    const glowTexture = makeGlowTexture();
    this.nodeViews = galaxy.nodes.map((node) => {
      const starColor = new THREE.Color().setHSL(node.planet.hue, 0.7, 0.7);
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 16, 16),
        new THREE.MeshBasicMaterial({ color: starColor })
      );
      star.position.copy(node.position);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: starColor,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        })
      );
      glow.scale.setScalar(7);
      star.add(glow);
      // Larger invisible sphere so nodes are easy to click
      const hit = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData.nodeId = node.id;
      star.add(hit);
      this.group.add(star);

      const label = document.createElement('div');
      label.className = 'map-label';
      label.textContent = node.name;
      labelContainer.appendChild(label);

      return { node, star, glow, hit, label };
    });
    this.hitTargets = this.nodeViews.map((v) => v.hit);

    this.edgeViews = galaxy.edges.map(([a, b]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        galaxy.nodes[a].position,
        galaxy.nodes[b].position,
      ]);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x5fa8d3, transparent: true, opacity: 0.25 })
      );
      this.group.add(line);
      return { a, b, line };
    });

    this.currentMarker = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.8, 48),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.currentMarker.rotation.x = -Math.PI / 2;
    this.group.add(this.currentMarker);

    this.ship = createShip();
    this.ship.scale.setScalar(2.4);
    this.group.add(this.ship);
    this.placeShipAt(this.currentId);
    this.refreshHighlights();
  }

  get current() {
    return this.galaxy.nodes[this.currentId];
  }

  isReachable(id) {
    return this.current.neighbors.has(id);
  }

  placeShipAt(id) {
    const p = this.galaxy.nodes[id].position;
    this.ship.position.set(p.x, 3.5, p.z);
    this.currentMarker.position.set(p.x, 0, p.z);
    // Face the first neighbor so the ship looks "ready to go"
    const next = this.galaxy.nodes[[...this.galaxy.nodes[id].neighbors][0]];
    if (next) this.ship.lookAt(this.group.localToWorld(new THREE.Vector3(next.position.x, 3.5, next.position.z)));
  }

  refreshHighlights() {
    for (const e of this.edgeViews) {
      const active = e.a === this.currentId || e.b === this.currentId;
      e.line.material.opacity = active ? 0.9 : 0.2;
      e.line.material.color.set(active ? 0x9fe8ff : 0x5fa8d3);
    }
    for (const v of this.nodeViews) {
      const id = v.node.id;
      v.label.classList.toggle('current', id === this.currentId);
      v.label.classList.toggle('reachable', this.isReachable(id));
    }
  }

  /** Animates the ship along the hyperlane; resolves when it arrives. */
  travelTo(id, duration = 1.8) {
    const from = this.current.position;
    const to = this.galaxy.nodes[id].position;
    this.currentMarker.visible = false;
    this.ship.lookAt(this.group.localToWorld(new THREE.Vector3(to.x, 3.5, to.z)));
    return new Promise((resolve) => {
      this.travel = {
        from: new THREE.Vector3(from.x, 3.5, from.z),
        to: new THREE.Vector3(to.x, 3.5, to.z),
        elapsed: 0,
        duration,
        done: () => {
          this.travel = null;
          this.currentId = id;
          this.currentMarker.visible = true;
          this.placeShipAt(id);
          this.refreshHighlights();
          resolve(this.galaxy.nodes[id]);
        },
      };
    });
  }

  update(dt, t) {
    this.currentMarker.rotation.z = t * 0.8;
    for (const v of this.nodeViews) {
      const reachable = !this.travel && this.isReachable(v.node.id);
      const pulse = reachable ? 1 + 0.25 * Math.sin(t * 4 + v.node.id) : 1;
      v.glow.scale.setScalar(7 * pulse);
      v.glow.material.opacity = reachable || v.node.id === this.currentId ? 1 : 0.45;
    }
    if (this.travel) {
      const tr = this.travel;
      tr.elapsed += dt;
      const k = Math.min(tr.elapsed / tr.duration, 1);
      this.ship.position.lerpVectors(tr.from, tr.to, easeInOut(k));
      this.ship.position.y += Math.sin(k * Math.PI) * 1.5; // slight arc
      if (k >= 1) tr.done();
    }
  }

  /** Positions HTML labels over their nodes; hides them when `visible` is false. */
  updateLabels(camera, width, height, visible) {
    this.labelContainer.style.opacity = visible ? 1 : 0;
    if (!visible) return;
    const v = new THREE.Vector3();
    for (const view of this.nodeViews) {
      view.star.getWorldPosition(v);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      view.label.style.transform = `translate(-50%, 0) translate(${x}px, ${y + 18}px)`;
      view.label.style.display = v.z < 1 ? '' : 'none';
    }
  }
}
