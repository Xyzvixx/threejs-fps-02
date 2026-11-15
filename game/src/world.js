import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'EMBERLINE Foundry District';
  scene.add(group);

  scene.background = new THREE.Color(0x141a24);
  scene.fog = new THREE.Fog(0x141a24, 30, 70);

  const paletteColor = (key, fallback) => PALETTE?.[key] ?? fallback;
  const materials = {
    concrete: new THREE.MeshStandardMaterial({
      color: paletteColor('concrete', 0x3a3d42),
      roughness: 0.92,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: paletteColor('darkSteel', 0x3d454c),
      metalness: 0.35,
      roughness: 0.55,
    }),
    rust: new THREE.MeshStandardMaterial({
      color: paletteColor('rust', 0x75452f),
      metalness: 0.35,
      roughness: 0.78,
    }),
    crateWood: new THREE.MeshStandardMaterial({
      color: paletteColor('crateWood', 0x66513a),
      roughness: 0.88,
    }),
    hazard: new THREE.MeshStandardMaterial({
      color: paletteColor('hazard', 0xd39b35),
      roughness: 0.7,
    }),
    emberGlow: new THREE.MeshStandardMaterial({
      color: 0x8e3210,
      emissive: 0xff6a00,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
    tealTrim: new THREE.MeshStandardMaterial({
      color: paletteColor('tealTrim', 0x3b7877),
      metalness: 0.45,
      roughness: 0.55,
    }),
  };

  const colliders = [];
  const shootables = [];

  function addBox(name, size, position, material, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      material,
    );
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    group.add(mesh);
    mesh.updateMatrixWorld(true);

    if (options.collider !== false) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    if (options.shootable !== false) {
      shootables.push(mesh);
    }
    return mesh;
  }

  function addCylinder(name, radius, height, position, material, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 12),
      material,
    );
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(options.rotation?.[0] ?? 0, options.rotation?.[1] ?? 0, options.rotation?.[2] ?? 0);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    group.add(mesh);
    mesh.updateMatrixWorld(true);

    if (options.collider !== false) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    if (options.shootable !== false) {
      shootables.push(mesh);
    }
    return mesh;
  }

  function crate(name, size, position, material = materials.crateWood) {
    return addBox(name, size, position, material);
  }

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.2, 34),
    materials.concrete,
  );
  floor.name = 'Foundry floor';
  floor.position.set(0, -0.1, 0);
  floor.receiveShadow = true;
  floor.castShadow = false;
  group.add(floor);

  addBox('North perimeter wall', [44.6, 5, 0.6], [0, 2.5, -17], materials.darkSteel);
  addBox('South perimeter wall', [44.6, 5, 0.6], [0, 2.5, 17], materials.darkSteel);
  addBox('West perimeter wall', [0.6, 5, 34], [-22, 2.5, 0], materials.darkSteel);
  addBox('East perimeter wall', [0.6, 5, 34], [22, 2.5, 0], materials.darkSteel);

  addBox('Furnace housing', [6, 4, 3], [-16, 2, -12.5], materials.darkSteel);
  addBox(
    'Furnace glowing front',
    [3.2, 2.3, 0.12],
    [-16, 1.7, -10.94],
    materials.emberGlow,
    { collider: false, castShadow: false },
  );
  addCylinder('Furnace chimney', 1.2, 7, [-18, 3.5, -13], materials.rust);
  addCylinder('Furnace pipe west', 0.28, 3.8, [-19.4, 3.7, -10.5], materials.darkSteel, {
    rotation: [0, 0, Math.PI / 2],
  });
  addCylinder('Furnace pipe east', 0.22, 2.8, [-14.5, 3.15, -13], materials.rust, {
    rotation: [0, 0, Math.PI / 2],
  });

  crate('A container lower west', [3, 2.6, 2.6], [12.5, 1.3, -12], materials.rust);
  crate('A container upper west', [3, 2.6, 2.6], [12.5, 3.9, -12], materials.tealTrim);
  crate('A container lower east', [3, 2.6, 2.6], [17.5, 1.3, -12], materials.tealTrim);
  crate('A container upper east', [3, 2.6, 2.6], [17.5, 3.9, -12], materials.rust);

  addBox('Crane west leg', [0.65, 8, 0.7], [10, 4, -11], materials.darkSteel);
  addBox('Crane east leg', [0.65, 8, 0.7], [20, 4, -11], materials.darkSteel);
  addBox('Crane jib', [10, 0.8, 0.8], [15, 8, -11], materials.darkSteel);
  addCylinder('Crane hook cable', 0.06, 3.4, [16.5, 5.8, -11], materials.darkSteel);
  const craneHook = addBox('Crane hook', [0.55, 0.65, 0.45], [16.5, 4.1, -11], materials.hazard);

  addBox('Central furnace pillar', [2, 4, 2], [0, 2, 0], materials.darkSteel);
  // No glow on the pillar itself: the Site A furnace panel is the ember
  // landmark, and a lit slit this close to mid reads as a floating bar.

  // The player controller resolves standing on top of this low platform.
  addBox('Mid catwalk platform', [8, 0.5, 3], [0, 0.25, -4], materials.darkSteel);
  addBox('Mid catwalk west support', [0.35, 0.5, 0.35], [-3.6, -0.25, -4], materials.rust);
  addBox('Mid catwalk east support', [0.35, 0.5, 0.35], [3.6, -0.25, -4], materials.rust);

  addBox('B tunnel west wall north', [0.45, 3, 9], [14, 1.5, 7.5], materials.darkSteel);
  addBox('B tunnel west wall south', [0.45, 3, 8], [14, 1.5, -4], materials.darkSteel);
  addBox('B tunnel east wall north', [0.45, 3, 9], [19, 1.5, 7.5], materials.darkSteel);
  addBox('B tunnel east wall south', [0.45, 3, 8], [19, 1.5, -4], materials.darkSteel);
  addBox('B tunnel overhead north', [5.5, 0.35, 8], [16.5, 3.2, 8], materials.darkSteel);
  addBox('B tunnel overhead south', [5.5, 0.35, 8], [16.5, 3.2, -8], materials.darkSteel);

  const cratePlacements = [
    ['A lane crate 1', [1.2, 1.2, 1.2], [-18, 0.6, 9]],
    ['A lane crate 2', [2.4, 1.1, 1.2], [-13, 0.55, 6]],
    ['A lane crate 3', [1.2, 1.1, 2.4], [-18, 0.55, 2]],
    ['A lane crate 4', [1.2, 1.2, 1.2], [-13, 0.6, -2]],
    ['A lane crate 5', [2.4, 1.1, 1.2], [-18, 0.55, -6]],
    ['A site crate 6', [1.2, 1.1, 2.4], [-10, 0.55, -8]],
    ['West mid crate 7', [1.2, 1.2, 1.2], [-8, 0.6, 2]],
    ['Mid lane crate 8', [2.4, 1.1, 1.2], [-5, 0.55, 8]],
    ['Mid lane crate 9', [1.2, 1.1, 2.4], [5, 0.55, 8]],
    ['East mid crate 10', [1.2, 1.2, 1.2], [8, 0.6, 2]],
    ['B lane crate 11', [2.4, 1.1, 1.2], [11, 0.55, 6]],
    ['B lane crate 12', [1.2, 1.1, 2.4], [20, 0.55, 2]],
    ['B lane crate 13', [1.2, 1.2, 1.2], [11, 0.6, -6]],
    ['B site crate 14', [2.4, 1.1, 1.2], [20, 0.55, -7]],
  ];
  for (const [name, size, position] of cratePlacements) {
    crate(name, size, position);
  }

  addCylinder('Mid barrel west', 0.55, 1.1, [-3, 0.55, 3], materials.rust);
  addCylinder('Mid barrel east', 0.55, 1.1, [3, 0.55, 3], materials.rust);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2e33';
  ctx.fillRect(0, 0, 1024, 1024);

  const stripe = (x, y, width, height) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = '#d39b35';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#343638';
    ctx.lineWidth = 16;
    for (let offset = -height; offset < width + height; offset += 38) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + height);
      ctx.lineTo(x + offset + height, y);
      ctx.stroke();
    }
    ctx.restore();
  };
  stripe(38, 90, 150, 28);
  stripe(836, 90, 150, 28);
  stripe(38, 862, 150, 28);
  stripe(836, 862, 150, 28);

  ctx.strokeStyle = 'rgba(235, 230, 211, 0.48)';
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 18]);
  ctx.beginPath();
  ctx.moveTo(512, 100);
  ctx.lineTo(512, 924);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#eee8d7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 150px sans-serif';
  ctx.fillText('A', 165, 185);
  ctx.fillText('B', 859, 185);

  ctx.strokeStyle = '#eee8d7';
  ctx.lineWidth = 11;
  for (const x of [230, 512, 794]) {
    ctx.beginPath();
    ctx.moveTo(x, 766);
    ctx.lineTo(x, 708);
    ctx.moveTo(x, 708);
    ctx.lineTo(x - 20, 728);
    ctx.moveTo(x, 708);
    ctx.lineTo(x + 20, 728);
    ctx.stroke();
  }

  const markingTexture = new THREE.CanvasTexture(canvas);
  markingTexture.colorSpace = THREE.SRGBColorSpace;
  const markings = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 34),
    // Standard (lit) material: an unlit Basic material would wash the whole
    // floor out to the canvas colour regardless of the dusk lighting.
    new THREE.MeshStandardMaterial({
      map: markingTexture,
      transparent: true,
      opacity: 0.92,
      roughness: 0.95,
      depthWrite: false,
    }),
  );
  markings.name = 'Floor markings';
  markings.rotation.x = -Math.PI / 2;
  markings.position.y = 0.011;
  markings.castShadow = false;
  markings.receiveShadow = false;
  // Kept out of both collider and shootable lists so bullets pass through.
  group.add(markings);

  const hemisphere = new THREE.HemisphereLight(0x8fa3bf, 0x2a2118, 0.65);
  group.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffd9a0, 1.7);
  keyLight.position.set(14, 20, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -26;
  keyLight.shadow.camera.right = 26;
  keyLight.shadow.camera.top = 26;
  keyLight.shadow.camera.bottom = -26;
  keyLight.shadow.bias = -0.0006;
  group.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4a6a8a, 0.5);
  fillLight.position.set(-12, 10, -14);
  group.add(fillLight);

  for (const position of [
    [-15, 4.2, -11],
    [15, 4.2, -11],
    [0, 4.5, 6],
    [-18, 3.5, 6],
  ]) {
    const lamp = new THREE.PointLight(0xffb45e, 12, 14);
    lamp.position.set(...position);
    lamp.castShadow = false;
    group.add(lamp);
  }

  const waypointPositions = [
    [0, 14], [-8, 12], [8, 12], [-16, 8], [-16, 0], [-16, -7],
    [-15, -11], [-10, -11], [0, 8], [0, 2], [0, -4], [-6, -4],
    [6, -4], [16, 8], [16, 0], [16, -7], [15, -11], [10, -11],
    [0, -14], [-8, -13], [8, -13], [-10, 4], [10, 4], [-6, 8],
    [6, 8], [-8, -7],
  ];
  const waypoints = waypointPositions.map(([x, z]) => ({
    pos: new THREE.Vector3(x, 0, z),
    links: [],
  }));
  const link = (a, b) => {
    if (!waypoints[a].links.includes(b)) waypoints[a].links.push(b);
    if (!waypoints[b].links.includes(a)) waypoints[b].links.push(a);
  };

  [
    [0, 1], [0, 2], [0, 8], [1, 3], [1, 21], [1, 23],
    [2, 13], [2, 22], [2, 24], [3, 4], [4, 5], [5, 6],
    [5, 25], [6, 7], [7, 25], [7, 10], [8, 9], [8, 23],
    [8, 24], [9, 10], [9, 11], [9, 12], [10, 11], [10, 12],
    [11, 25], [12, 22], [13, 14], [14, 15], [15, 16],
    [15, 22], [16, 17], [17, 10], [17, 20], [18, 19],
    [18, 20], [18, 10], [19, 6], [19, 25], [20, 16],
    [21, 3], [21, 8], [22, 13], [22, 17], [23, 21],
    [23, 8], [24, 22], [24, 8],
  ].forEach(([a, b]) => link(a, b));

  return {
    colliders,
    shootables,
    sites: {
      A: { center: new THREE.Vector3(-15, 0, -11), radius: 5 },
      B: { center: new THREE.Vector3(15, 0, -11), radius: 5 },
    },
    spawns: {
      emb: [
        new THREE.Vector3(-6, 0, 14),
        new THREE.Vector3(-2, 0, 14.5),
        new THREE.Vector3(2, 0, 14.5),
        new THREE.Vector3(6, 0, 14),
        new THREE.Vector3(0, 0, 15.5),
      ],
      ash: [
        new THREE.Vector3(-14, 0, -13),
        new THREE.Vector3(-6, 0, -13.5),
        new THREE.Vector3(0, 0, -14),
        new THREE.Vector3(6, 0, -13.5),
        new THREE.Vector3(14, 0, -13),
      ],
    },
    waypoints,
    group,
    update(dt, t) {
      materials.emberGlow.emissiveIntensity = 1.4 + Math.sin(t * 2) * 0.35;
      craneHook.rotation.z = Math.sin(t * 1.15) * 0.055;
    },
  };
}

export function segmentBlocked(colliders, ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  for (const box of colliders) {
    let tmin = 0;
    let tmax = 1;

    if (dx === 0) {
      if (ax < box.min.x || ax > box.max.x) continue;
    } else {
      let t1 = (box.min.x - ax) / dx;
      let t2 = (box.max.x - ax) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (dy === 0) {
      if (ay < box.min.y || ay > box.max.y) continue;
    } else {
      let t1 = (box.min.y - ay) / dy;
      let t2 = (box.max.y - ay) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (dz === 0) {
      if (az < box.min.z || az > box.max.z) continue;
    } else {
      let t1 = (box.min.z - az) / dz;
      let t2 = (box.max.z - az) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (tmax >= 0 && tmin <= 1) return true;
  }

  return false;
}

export function findPath(waypoints, fromIdx, toIdx) {
  if (
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= waypoints.length ||
    toIdx >= waypoints.length
  ) {
    return [];
  }
  if (fromIdx === toIdx) return [fromIdx];

  const parent = new Array(waypoints.length).fill(-1);
  const queue = [fromIdx];
  parent[fromIdx] = fromIdx;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const next of waypoints[current].links) {
      if (next < 0 || next >= waypoints.length || parent[next] !== -1) continue;
      parent[next] = current;
      if (next === toIdx) {
        const path = [toIdx];
        let node = current;
        while (node !== fromIdx) {
          path.push(node);
          node = parent[node];
        }
        path.push(fromIdx);
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }

  return [];
}