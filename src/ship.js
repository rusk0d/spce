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
