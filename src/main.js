import * as THREE from 'three';
import { createShip } from './ship.js';
import { generateGalaxy, GalaxyMap } from './galaxy.js';
import { Combat } from './combat.js';
import { onPress, SwipeTracker } from './input.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Touch devices are usually phones with dense screens and weaker GPUs: cap the
// render resolution lower there to keep the frame rate steady.
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(11, 4, 21);

// Lighting
scene.add(new THREE.HemisphereLight(0x8899cc, 0x111122, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-20, 10, 15);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x99aacc, 1.6);
fill.position.set(25, 8, 15);
scene.add(fill);

// Star field
function createStars(count = 4000, radius = 600) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Uniform direction on a sphere, pushed out to a shell so stars sit behind the scene
    const dir = new THREE.Vector3().randomDirection();
    const r = radius * (0.4 + Math.random() * 0.6);
    positions.set([dir.x * r, dir.y * r, dir.z * r], i * 3);
    color.setHSL(0.55 + Math.random() * 0.15, 0.4, 0.75 + Math.random() * 0.25);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}
const stars = createStars();
scene.add(stars);

// Planet
const planet = new THREE.Group();
scene.add(planet);

const planetBody = new THREE.Mesh(
  new THREE.SphereGeometry(5, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.85, metalness: 0.05 })
);
planet.add(planetBody);

// Fresnel atmosphere glow
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(5.4, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0x66ccff) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
        gl_FragColor = vec4(glowColor, f);
      }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
);
planet.add(atmosphere);

// Glowing ring: radial falloff from a bright core band, additively blended
const ringInner = 7;
const ringOuter = 10;
const ring = new THREE.Mesh(
  new THREE.RingGeometry(ringInner, ringOuter, 128, 1),
  new THREE.ShaderMaterial({
    uniforms: {
      innerRadius: { value: ringInner },
      outerRadius: { value: ringOuter },
      ringColor: { value: new THREE.Color(0xffb36b) },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float innerRadius;
      uniform float outerRadius;
      uniform vec3 ringColor;
      uniform float time;
      varying vec2 vPos;
      void main() {
        float t = (length(vPos) - innerRadius) / (outerRadius - innerRadius);
        float core = exp(-pow((t - 0.5) * 4.0, 2.0));
        float bands = 0.75 + 0.25 * sin(t * 60.0);
        float pulse = 0.9 + 0.1 * sin(time * 1.5);
        float a = core * bands * pulse;
        gl_FragColor = vec4(ringColor * (1.0 + core), a);
      }`,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
);
ring.rotation.x = -Math.PI / 2 + 0.35;
ring.rotation.y = 0.2;
planet.add(ring);

const ship = createShip();
ship.position.set(2.5, 1.2, 15);
ship.lookAt(planet.position);
scene.add(ship);

// Procedural banded surface so each system's planet looks distinct
function makePlanetTexture(spec) {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const s = spec.bandSeed;
  const base = spec.color.clone();
  const hsl = base.getHSL({});
  const c = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const v = y / h;
    const band = Math.sin(v * 22 + s) * 0.5 + Math.sin(v * 51 + s * 1.7) * 0.3 + Math.sin(v * 7 + s * 0.3) * 0.6;
    c.setHSL((hsl.h + band * 0.02 + 1) % 1, hsl.s, THREE.MathUtils.clamp(hsl.l + band * 0.08, 0.05, 0.9));
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(0, y, w, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyPlanet(spec) {
  planetBody.material.map?.dispose();
  planetBody.material.map = makePlanetTexture(spec);
  planetBody.material.color.set(0xffffff);
  planetBody.material.needsUpdate = true;
  atmosphere.material.uniforms.glowColor.value.copy(spec.glow);
  ring.visible = spec.hasRing;
  ring.material.uniforms.ringColor.value.copy(spec.ringColor);
  ring.rotation.x = -Math.PI / 2 + spec.ringTilt;
  planet.scale.setScalar(spec.size);
}

// Game state + HUD
const state = { hull: 100, fuel: 10, scrap: 0, jumps: 0, piratesDefeated: 0, gameOver: false };
const PIRATE_CHANCE = 0.4;
const hud = {
  hull: document.getElementById('hud-hull'),
  fuel: document.getElementById('hud-fuel'),
  scrap: document.getElementById('hud-scrap'),
  system: document.getElementById('hud-system'),
  toast: document.getElementById('toast'),
};
function renderHud() {
  hud.hull.textContent = state.hull;
  hud.fuel.textContent = state.fuel;
  hud.scrap.textContent = state.scrap;
  hud.system.textContent = galaxyMap.current.name;
}
let toastTimer;
function toast(message) {
  hud.toast.textContent = message;
  hud.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hud.toast.classList.remove('show'), 2200);
}

// Galaxy map lives far below the planet scene; the camera flies between the two
const MAP_CENTER = new THREE.Vector3(0, -160, 0);
const galaxyMap = new GalaxyMap(generateGalaxy(), MAP_CENTER, document.getElementById('map-labels'));
scene.add(galaxyMap.group);
applyPlanet(galaxyMap.current.planet);
renderHud();

const views = {
  main: { position: new THREE.Vector3(11, 4, 21), target: new THREE.Vector3(0, 0, 6) },
  map: {
    position: MAP_CENTER.clone().add(new THREE.Vector3(0, 78, 26)),
    target: MAP_CENTER.clone(),
    maxFit: 1.9, // the map is roughly round, so it needs less pull-back than wide shots
  },
  // Pulled back and to the side so the player ship and the pirate face off across the frame
  combat: { position: new THREE.Vector3(9, 6, 29), target: new THREE.Vector3(7.5, 1.5, 13) },
};
const shipBase = ship.position.clone();

// Swipe-to-orbit around the ship in the main view
const ORBIT_LIMIT = 0.9; // radians either side of the default angle
const ORBIT_RAD_PER_PX = 0.004;
const orbit = { yaw: 0, targetYaw: 0 };
const swipe = new SwipeTracker({ intervalMs: 32, maxStep: 18 });

/**
 * Camera pose for a view. Narrow (portrait) screens pull the camera back so
 * the same content stays in frame; the main view also applies the orbit yaw
 * around the ship.
 */
function viewPose(name) {
  const base = views[name];
  const aspect = window.innerWidth / window.innerHeight;
  const fit = THREE.MathUtils.clamp(1.25 / aspect, 1, base.maxFit ?? 2.4);
  const position = base.position.clone().sub(base.target).multiplyScalar(fit).add(base.target);
  const target = base.target.clone();
  if (name === 'main' && orbit.yaw !== 0) {
    const up = THREE.Object3D.DEFAULT_UP;
    position.sub(shipBase).applyAxisAngle(up, orbit.yaw).add(shipBase);
    target.sub(shipBase).applyAxisAngle(up, orbit.yaw).add(shipBase);
  }
  return { position, target };
}

let view = 'main';
let cameraTween = null;
const cameraTarget = new THREE.Vector3();
function snapCamera() {
  const pose = viewPose(view);
  camera.position.copy(pose.position);
  cameraTarget.copy(pose.target);
  camera.lookAt(cameraTarget);
}
snapCamera();

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const controls = {
  mapBtn: document.getElementById('map-btn'),
  mapBtnText: document.getElementById('map-btn-text'),
  help: document.getElementById('help'),
};
const pointerVerb = isCoarsePointer ? 'Tap' : 'Click';
const helpText = {
  main: isCoarsePointer ? 'Swipe to look around the ship' : 'Drag to look around · M for map',
  map: `${pointerVerb} a linked system to jump (−1 fuel)`,
  combat: '',
};

function setView(next) {
  if (next === view && !cameraTween) return;
  view = next;
  swipe.pointerId = null;
  cameraTween = {
    fromPos: camera.position.clone(),
    fromTarget: cameraTarget.clone(),
    to: viewPose(next),
    elapsed: 0,
    duration: 1.4,
  };
  document.body.classList.toggle('map-open', next === 'map');
  document.body.classList.toggle('in-combat', next === 'combat');
  controls.help.textContent = helpText[next];
  controls.mapBtnText.textContent = next === 'map' ? 'Close Map' : 'Galaxy Map';
}
controls.help.textContent = helpText.main;

const canToggleMap = () => !galaxyMap.travel && !combat.active && !state.gameOver && view !== 'combat';
function toggleMap() {
  if (!canToggleMap()) return;
  setView(view === 'map' ? 'main' : 'map');
}
onPress(controls.mapBtn, toggleMap);

// Pirate encounters
const combat = new Combat({
  scene,
  playerShip: ship,
  enemyPosition: new THREE.Vector3(13, 2, 11),
  state,
  ui: {
    panel: document.getElementById('combat'),
    attack: document.getElementById('attack-btn'),
    enemyHpFill: document.getElementById('enemy-hp-fill'),
    enemyHpText: document.getElementById('enemy-hp-text'),
    log: document.getElementById('combat-log'),
  },
  onHullChange: () => {
    renderHud();
    const stat = hud.hull.closest('.stat');
    stat.classList.remove('hit');
    void stat.offsetWidth; // restart the flash animation
    stat.classList.add('hit');
  },
  onEnd: ({ result, scrap }) => {
    if (result === 'win') {
      state.scrap += scrap;
      state.piratesDefeated += 1;
      renderHud();
      toast(`Victory! +${scrap} scrap`);
      setView('main');
    } else {
      showGameOver();
    }
  },
});

async function startPirateFight() {
  setView('combat');
  await new Promise((resolve) => setTimeout(resolve, 1500)); // let the camera settle
  combat.start();
}

function showGameOver() {
  state.gameOver = true;
  document.body.classList.add('game-over');
  document.getElementById('gameover-stats').textContent =
    `Jumps made: ${state.jumps} · Pirates defeated: ${state.piratesDefeated} · Scrap: ${state.scrap}`;
  document.getElementById('gameover').classList.add('show');
  document.getElementById('restart-btn').focus();
}
onPress(document.getElementById('restart-btn'), () => window.location.reload());

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.key.toLowerCase() !== 'm') return;
  toggleMap();
});

// Canvas pointer input: tap-to-jump on the galaxy map, swipe-to-orbit in the main view
const mapInteractive = () => view === 'map' && !cameraTween && !galaxyMap.travel;
const tapRadius = (e) => (e.pointerType === 'mouse' ? 24 : 44);

async function jumpTo(id) {
  if (!galaxyMap.isReachable(id)) {
    toast('No hyperlane to that system');
    return;
  }
  if (state.fuel <= 0) {
    toast('Out of fuel');
    return;
  }
  state.fuel -= 1;
  renderHud();
  canvas.style.cursor = '';
  const node = await galaxyMap.travelTo(id);
  state.jumps += 1;
  applyPlanet(node.planet);
  renderHud();
  if (Math.random() < PIRATE_CHANCE) {
    toast(`Arrived at ${node.name} — pirates detected!`);
    startPirateFight();
  } else {
    toast(`Arrived at ${node.name}`);
  }
}

galaxyMap.onSelect = (id) => {
  if (mapInteractive() && id !== galaxyMap.currentId) jumpTo(id);
};

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (mapInteractive()) {
    const id = galaxyMap.nodeAt(e.clientX, e.clientY, tapRadius(e));
    if (id !== null && id !== galaxyMap.currentId) jumpTo(id);
  } else if (view === 'main' && !cameraTween) {
    swipe.begin(e);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (swipe.active) {
    swipe.move(e);
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const id = mapInteractive() ? galaxyMap.nodeAt(e.clientX, e.clientY, tapRadius(e)) : null;
  canvas.style.cursor = id !== null && galaxyMap.isReachable(id) ? 'pointer' : view === 'main' ? 'grab' : '';
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (e) => swipe.end(e));
}

// Resize (also fires on device rotation)
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (cameraTween) cameraTween.to = viewPose(view);
  else snapCamera();
});

// Animate
const clock = new THREE.Clock();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  planetBody.rotation.y = t * 0.05;
  ring.material.uniforms.time.value = t;
  stars.rotation.y = t * 0.003;
  ship.position.y = shipBase.y + Math.sin(t * 1.2) * 0.08; // gentle idle bob

  if (cameraTween) {
    const tw = cameraTween;
    tw.elapsed += dt;
    const k = easeInOutCubic(Math.min(tw.elapsed / tw.duration, 1));
    camera.position.lerpVectors(tw.fromPos, tw.to.position, k);
    cameraTarget.lerpVectors(tw.fromTarget, tw.to.target, k);
    camera.lookAt(cameraTarget);
    if (tw.elapsed >= tw.duration) cameraTween = null;
  } else if (view === 'main') {
    // Swipe input arrives as small throttled steps; ease toward them for smoothness
    const dx = swipe.consume(now);
    if (dx) orbit.targetYaw = THREE.MathUtils.clamp(orbit.targetYaw - dx * ORBIT_RAD_PER_PX, -ORBIT_LIMIT, ORBIT_LIMIT);
    if (Math.abs(orbit.targetYaw - orbit.yaw) > 1e-4) {
      orbit.yaw += (orbit.targetYaw - orbit.yaw) * Math.min(dt * 8, 1);
      snapCamera();
    }
  }

  galaxyMap.update(dt, t);
  combat.update(dt, t);
  const showLabels = view === 'map' && !cameraTween;
  if (showLabels) galaxyMap.projectNodes(camera, window.innerWidth, window.innerHeight);
  galaxyMap.updateLabels(showLabels, window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});
