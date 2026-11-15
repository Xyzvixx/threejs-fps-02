import * as THREE from 'three';

const _smokeSample = new THREE.Vector3();

export function createFx(scene) {
  const tracerCount = 16;
  const muzzleCount = 6;
  const particleCount = 240;
  const smokeCount = 4;

  const tracers = [];
  const tracerLives = new Float32Array(tracerCount);
  let tracerCursor = 0;

  for (let i = 0; i < tracerCount; i += 1) {
    const positions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    scene.add(line);
    tracers.push(line);
  }

  const muzzleFlashes = [];
  const muzzleLives = new Float32Array(muzzleCount);
  const muzzleGeometry = new THREE.PlaneGeometry(0.3, 0.3);

  for (let i = 0; i < muzzleCount; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffb45e,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(muzzleGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    muzzleFlashes.push(mesh);
  }

  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particleVelocityX = new Float32Array(particleCount);
  const particleVelocityY = new Float32Array(particleCount);
  const particleVelocityZ = new Float32Array(particleCount);
  const particleLives = new Float32Array(particleCount);
  const particleMaxLives = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i += 1) {
    particlePositions[i * 3 + 1] = -100;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  particleGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(particleColors, 3).setUsage(THREE.DynamicDrawUsage)
  );

  // Soft round sprite for particles: raw THREE.Points are squares, which read
  // as floating cards when a frame freezes mid-burst (e.g. in a capture).
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = 64;
  dotCanvas.height = 64;
  const dotCtx = dotCanvas.getContext('2d');
  const dotGrad = dotCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  dotGrad.addColorStop(0, 'rgba(255,255,255,1)');
  dotGrad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  dotGrad.addColorStop(1, 'rgba(255,255,255,0)');
  dotCtx.fillStyle = dotGrad;
  dotCtx.fillRect(0, 0, 64, 64);
  const dotTexture = new THREE.CanvasTexture(dotCanvas);

  const particleMaterial = new THREE.PointsMaterial({
    size: 0.07,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
    alphaTest: 0.02,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  let particleCursor = 0;

  function spawnParticles(pos, kind) {
    for (let n = 0; n < 10; n += 1) {
      const i = particleCursor;
      particleCursor = (particleCursor + 1) % particleCount;

      let dx = Math.random() * 2 - 1;
      let dy = Math.random() * 2 - 1;
      let dz = Math.random() * 2 - 1;

      if (kind === 'flesh') {
        dy = Math.abs(dy) + 0.35;
      }

      const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const speed = 2 + Math.random() * 4;
      particleVelocityX[i] = (dx / length) * speed;
      particleVelocityY[i] = (dy / length) * speed;
      particleVelocityZ[i] = (dz / length) * speed;

      const life = 0.25 + Math.random() * 0.25;
      particleLives[i] = life;
      particleMaxLives[i] = life;

      const offset = i * 3;
      particlePositions[offset] = pos.x;
      particlePositions[offset + 1] = pos.y;
      particlePositions[offset + 2] = pos.z;

      const variation = 0.8 + Math.random() * 0.2;
      if (kind === 'flesh') {
        particleColors[offset] = 0.55 * variation;
        particleColors[offset + 1] = 0.05 * variation;
        particleColors[offset + 2] = 0.05 * variation;
      } else {
        particleColors[offset] = 0.8 * variation;
        particleColors[offset + 1] = 0.7 * variation;
        particleColors[offset + 2] = 0.55 * variation;
      }
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
  }

  const explosionLight = new THREE.PointLight(0xff8a2a, 0, 18, 2);
  explosionLight.visible = false;
  scene.add(explosionLight);
  let explosionLightLife = 0;

  const shockwaveMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa040,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const shockwave = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), shockwaveMaterial);
  shockwave.visible = false;
  scene.add(shockwave);
  let shockwaveLife = 0;

  const smokeGeometry = new THREE.SphereGeometry(1, 12, 8);
  const smokeClouds = [];
  const smokeLives = new Float32Array(smokeCount);
  const smokeActiveFlags = new Uint8Array(smokeCount);

  for (let i = 0; i < smokeCount; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x9aa3ad,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const cloud = new THREE.Mesh(smokeGeometry, material);
    cloud.visible = false;
    cloud.frustumCulled = false;
    scene.add(cloud);
    smokeClouds.push(cloud);
  }

  function tracer(from, to, colorHex) {
    let index = -1;
    for (let i = 0; i < tracerCount; i += 1) {
      const candidate = (tracerCursor + i) % tracerCount;
      if (tracerLives[candidate] <= 0) {
        index = candidate;
        break;
      }
    }
    if (index < 0) {
      index = tracerCursor;
    }

    const line = tracers[index];
    const positions = line.geometry.attributes.position.array;
    positions[0] = from.x;
    positions[1] = from.y;
    positions[2] = from.z;
    positions[3] = to.x;
    positions[4] = to.y;
    positions[5] = to.z;
    line.geometry.attributes.position.needsUpdate = true;
    line.material.color.setHex(colorHex);
    line.material.opacity = 1;
    line.visible = true;
    tracerLives[index] = 0.07;
    tracerCursor = (index + 1) % tracerCount;
  }

  function muzzle(pos) {
    let index = -1;
    for (let i = 0; i < muzzleCount; i += 1) {
      if (muzzleLives[i] <= 0) {
        index = i;
        break;
      }
    }
    if (index < 0) {
      index = 0;
      for (let i = 1; i < muzzleCount; i += 1) {
        if (muzzleLives[i] < muzzleLives[index]) index = i;
      }
    }

    const mesh = muzzleFlashes[index];
    mesh.position.copy(pos);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0.8 + Math.random() * 0.6);
    mesh.material.opacity = 1;
    mesh.visible = true;
    muzzleLives[index] = 0.05;
  }

  function impact(pos, kind) {
    spawnParticles(pos, kind === 'flesh' ? 'flesh' : 'wall');
  }

  function explosionFx(pos) {
    explosionLight.position.copy(pos);
    explosionLight.intensity = 60;
    explosionLight.visible = true;
    explosionLightLife = 0.4;

    for (let i = 0; i < 3; i += 1) {
      spawnParticles(pos, 'wall');
    }

    shockwave.position.copy(pos);
    shockwave.scale.setScalar(0.5);
    shockwave.material.opacity = 0.5;
    shockwave.visible = true;
    shockwaveLife = 0.45;
  }

  function smokeAt(pos) {
    for (let i = 0; i < smokeCount; i += 1) {
      if (smokeActiveFlags[i] === 0) {
        const cloud = smokeClouds[i];
        cloud.position.copy(pos);
        cloud.scale.setScalar(0.5);
        cloud.material.opacity = 0.5;
        cloud.visible = true;
        smokeLives[i] = 12;
        smokeActiveFlags[i] = 1;
        return i;
      }
    }
    return -1;
  }

  function smokeActive(id) {
    return id >= 0 && id < smokeCount && smokeActiveFlags[id] !== 0;
  }

  function smokeBlocks(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;

    for (let i = 0; i < smokeCount; i += 1) {
      if (smokeActiveFlags[i] === 0) continue;

      const center = smokeClouds[i].position;
      for (let sample = 0; sample < 8; sample += 1) {
        const t = sample / 7;
        _smokeSample.set(a.x + dx * t, a.y + dy * t, a.z + dz * t);
        if (_smokeSample.distanceToSquared(center) <= 2.2 * 2.2) return true;
      }
    }
    return false;
  }

  function step(dt) {
    for (let i = 0; i < tracerCount; i += 1) {
      if (tracerLives[i] > 0) {
        tracerLives[i] -= dt;
        if (tracerLives[i] <= 0) {
          tracerLives[i] = 0;
          tracers[i].visible = false;
        } else {
          tracers[i].material.opacity = tracerLives[i] / 0.07;
        }
      }
    }

    for (let i = 0; i < muzzleCount; i += 1) {
      if (muzzleLives[i] > 0) {
        muzzleLives[i] -= dt;
        if (muzzleLives[i] <= 0) {
          muzzleLives[i] = 0;
          muzzleFlashes[i].visible = false;
        } else {
          muzzleFlashes[i].material.opacity = muzzleLives[i] / 0.05;
        }
      }
    }

    for (let i = 0; i < particleCount; i += 1) {
      if (particleLives[i] <= 0) continue;

      particleLives[i] -= dt;
      const offset = i * 3;
      if (particleLives[i] <= 0) {
        particleLives[i] = 0;
        particlePositions[offset + 1] = -100;
        continue;
      }

      particleVelocityY[i] -= 9 * dt;
      particlePositions[offset] += particleVelocityX[i] * dt;
      particlePositions[offset + 1] += particleVelocityY[i] * dt;
      particlePositions[offset + 2] += particleVelocityZ[i] * dt;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    if (explosionLightLife > 0) {
      explosionLightLife -= dt;
      if (explosionLightLife <= 0) {
        explosionLightLife = 0;
        explosionLight.intensity = 0;
        explosionLight.visible = false;
      } else {
        explosionLight.intensity = 60 * (explosionLightLife / 0.4);
      }
    }

    if (shockwaveLife > 0) {
      shockwaveLife -= dt;
      if (shockwaveLife <= 0) {
        shockwaveLife = 0;
        shockwave.visible = false;
      } else {
        const progress = 1 - shockwaveLife / 0.45;
        shockwave.scale.setScalar(0.5 + progress * 5.5);
        shockwave.material.opacity = 0.5 * (1 - progress);
      }
    }

    for (let i = 0; i < smokeCount; i += 1) {
      if (smokeActiveFlags[i] === 0) continue;

      smokeLives[i] -= dt;
      const cloud = smokeClouds[i];
      if (smokeLives[i] <= 0) {
        smokeLives[i] = 0;
        smokeActiveFlags[i] = 0;
        cloud.visible = false;
        continue;
      }

      if (smokeLives[i] > 11) {
        const progress = 1 - (smokeLives[i] - 11);
        cloud.scale.setScalar(0.5 + progress * 2.5);
        cloud.material.opacity = 0.5;
      } else if (smokeLives[i] <= 1) {
        cloud.scale.setScalar(0.5 + smokeLives[i] * 2.5);
        cloud.material.opacity = 0.5 * smokeLives[i];
      } else {
        cloud.scale.setScalar(3);
        cloud.material.opacity = 0.5;
      }
    }
  }

  function reset() {
    for (let i = 0; i < tracerCount; i += 1) {
      tracerLives[i] = 0;
      tracers[i].visible = false;
      tracers[i].material.opacity = 0;
    }

    for (let i = 0; i < muzzleCount; i += 1) {
      muzzleLives[i] = 0;
      muzzleFlashes[i].visible = false;
    }

    for (let i = 0; i < particleCount; i += 1) {
      particleLives[i] = 0;
      particleMaxLives[i] = 0;
      particleVelocityX[i] = 0;
      particleVelocityY[i] = 0;
      particleVelocityZ[i] = 0;
      particlePositions[i * 3] = 0;
      particlePositions[i * 3 + 1] = -100;
      particlePositions[i * 3 + 2] = 0;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    explosionLightLife = 0;
    explosionLight.intensity = 0;
    explosionLight.visible = false;

    shockwaveLife = 0;
    shockwave.visible = false;
    shockwave.material.opacity = 0.5;

    for (let i = 0; i < smokeCount; i += 1) {
      smokeLives[i] = 0;
      smokeActiveFlags[i] = 0;
      smokeClouds[i].visible = false;
    }
  }

  return {
    tracer,
    muzzle,
    impact,
    explosionFx,
    smokeAt,
    smokeActive,
    smokeBlocks,
    step,
    reset
  };
}