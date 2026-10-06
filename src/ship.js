import * as THREE from 'three';

// Low-poly spaceship, built with its nose along +Z so Object3D.lookAt aims it
export function createShip() {
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

// Low-poly pirate raider: dark angular hull, forked prongs, green running lights.
// Nose along +Z, like the player ship.
export function createPirateShip() {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, flatShading: true, metalness: 0.2, roughness: 0.7 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, flatShading: true, metalness: 0.2, roughness: 0.8 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x55ff88, emissive: 0x33ff66, emissiveIntensity: 1.2, flatShading: true });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), hullMat);
  core.scale.set(1.1, 0.55, 1.4);
  ship.add(core);

  // Twin forward prongs
  for (const side of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.8, 4), plateMat);
    prong.rotation.x = Math.PI / 2;
    prong.position.set(side * 0.55, 0, 1.3);
    ship.add(prong);

    // Jagged swept-back wing
    const wing = new THREE.Mesh(new THREE.TetrahedronGeometry(0.9, 0), hullMat);
    wing.scale.set(1.6, 0.25, 1);
    wing.position.set(side * 1.3, 0, -0.4);
    wing.rotation.y = side * 0.6;
    ship.add(wing);

    const light = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), glowMat);
    light.position.set(side * 2.2, 0, -0.7);
    ship.add(light);
  }

  const bridge = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4, 0), glowMat);
  bridge.position.set(0, 0.45, 0.1);
  ship.add(bridge);

  const engine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.3, 5),
    new THREE.MeshBasicMaterial({ color: 0x66ff99 })
  );
  engine.rotation.x = Math.PI / 2;
  engine.position.z = -1.25;
  ship.add(engine);
  const engineLight = new THREE.PointLight(0x55ff88, 3, 5);
  engineLight.position.z = -1.7;
  ship.add(engineLight);

  return ship;
}

// Low-poly friendly space station: hub, docking ring on spokes, solar arrays,
// and blinking running lights (animate via station.userData.update).
export function createStation() {
  const station = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, flatShading: true, metalness: 0.2, roughness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xffb347, flatShading: true, metalness: 0.3, roughness: 0.5 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1f3d7a,
    emissive: 0x0a1a3a,
    flatShading: true,
    metalness: 0.5,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });

  const spinning = new THREE.Group();
  station.add(spinning);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 8), hullMat);
  spinning.add(hub);
  for (const y of [-1.8, 1.8]) {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.8, 8), trimMat);
    cap.position.y = y;
    if (y < 0) cap.rotation.x = Math.PI;
    spinning.add(cap);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 6, 16), hullMat);
  ring.rotation.x = Math.PI / 2;
  spinning.add(ring);

  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.18), trimMat);
    spoke.rotation.y = (i * Math.PI) / 4;
    spinning.add(spoke);
  }

  // Solar arrays stay fixed while the habitat ring spins
  for (const side of [-1, 1]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), hullMat);
    mast.position.set(0, 2.6, side * 1.2);
    station.add(mast);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), panelMat);
    panel.position.set(0, 2.6, side * 3.4);
    panel.rotation.x = -Math.PI / 2;
    station.add(panel);
  }

  const lights = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const light = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x66ff99 : 0xff5566 })
    );
    light.position.set(Math.cos(a) * 3.4, 0.4, Math.sin(a) * 3.4);
    spinning.add(light);
    lights.push(light);
  }

  const glow = new THREE.PointLight(0xffd59a, 4, 12);
  glow.position.set(0, 0, 3);
  station.add(glow);

  station.userData.update = (t) => {
    spinning.rotation.y = t * 0.25;
    lights.forEach((l, i) => {
      l.visible = Math.sin(t * 3 + i * 1.3) > -0.2;
    });
  };
  return station;
}
