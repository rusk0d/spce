import * as THREE from 'three';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

// Low-poly spaceship, built with its nose along +Z so Object3D.lookAt aims it
function createShip() {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, flatShading: true, metalness: 0.1, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xd2453a, flatShading: true, metalness: 0.3, roughness: 0.6 });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 6), hullMat);
  fuselage.rotation.x = Math.PI / 2; // cone tip (+Y) -> +Z
  ship.add(fuselage);

  const cockpit = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x114466, flatShading: true, roughness: 0.2 })
  );
  cockpit.scale.set(1, 0.7, 1.6);
  cockpit.position.set(0, 0.3, 0.2);
  ship.add(cockpit);

  // Swept wings from a flat triangle shape, extruded thin
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.6);
  wingShape.lineTo(1.6, -0.9);
  wingShape.lineTo(0, -0.6);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2); // lay flat in XZ plane, shape's +Y -> +Z
  wingGeo.translate(0, 0.04, 0);
  const rightWing = new THREE.Mesh(wingGeo, accentMat);
  rightWing.position.x = 0.3;
  ship.add(rightWing);
  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  leftWing.position.x = -0.3;
  ship.add(leftWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.6), accentMat);
  fin.position.set(0, 0.4, -0.8);
  ship.add(fin);

  // Engine glow at the rear
  const engine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 0.2, 6),
    new THREE.MeshBasicMaterial({ color: 0x66ccff })
  );
  engine.rotation.x = Math.PI / 2;
  engine.position.z = -1.25;
  ship.add(engine);
  const engineLight = new THREE.PointLight(0x66ccff, 3, 4);
  engineLight.position.z = -1.6;
  ship.add(engineLight);

  return ship;
}
const ship = createShip();
ship.position.set(2.5, 1.2, 15);
ship.lookAt(planet.position);
scene.add(ship);

camera.lookAt(new THREE.Vector3(0, 0, 6));

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
const clock = new THREE.Clock();
const shipBase = ship.position.clone();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  planetBody.rotation.y = t * 0.05;
  ring.material.uniforms.time.value = t;
  stars.rotation.y = t * 0.003;
  ship.position.y = shipBase.y + Math.sin(t * 1.2) * 0.08; // gentle idle bob
  renderer.render(scene, camera);
});
