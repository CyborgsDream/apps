import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

const canvas = document.getElementById('game');
const fpsCounter = document.getElementById('fpsCounter');
const resolutionInfo = document.getElementById('resolutionInfo');
const resolutionSelect = document.getElementById('resolutionSelect');
const fullscreenButton = document.getElementById('fullscreenButton');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let resolutionScale = parseFloat(resolutionSelect?.value || '1');

function applyOrientationClass() {
  if (!document?.body) {
    return;
  }
  const isPortrait = window.innerHeight >= window.innerWidth;
  document.body.classList.toggle('portrait', isPortrait);
  document.body.classList.toggle('landscape', !isPortrait);
}

function updateResolutionInfo() {
  if (!resolutionInfo) {
    return;
  }
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pixelRatio = renderer.getPixelRatio();
  const width = Math.round(size.x * pixelRatio);
  const height = Math.round(size.y * pixelRatio);
  resolutionInfo.textContent = `${width} × ${height}`;
}

function updateRendererSize() {
  const { innerWidth, innerHeight, devicePixelRatio } = window;
  const pixelRatio = Math.min(devicePixelRatio, 2) * Math.max(resolutionScale, 0.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  updateResolutionInfo();
}

function isFullscreenActive() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement,
  );
}

function requestAppFullscreen() {
  const element = document.documentElement;
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  }
  if (element.webkitRequestFullscreen) {
    return element.webkitRequestFullscreen();
  }
  if (element.mozRequestFullScreen) {
    return element.mozRequestFullScreen();
  }
  if (element.msRequestFullscreen) {
    return element.msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen API is not supported'));
}

function exitAppFullscreen() {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  }
  if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  }
  if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen();
  }
  if (document.msExitFullscreen) {
    return document.msExitFullscreen();
  }
  return Promise.resolve();
}

function updateFullscreenButtonLabel() {
  if (!fullscreenButton) {
    return;
  }
  fullscreenButton.textContent = isFullscreenActive() ? 'Exit Fullscreen' : 'Enter Fullscreen';
}

if (fullscreenButton) {
  updateFullscreenButtonLabel();
  fullscreenButton.addEventListener('click', () => {
    if (isFullscreenActive()) {
      Promise.resolve(exitAppFullscreen()).catch((error) => {
        console.warn('Unable to exit fullscreen', error);
      });
    } else {
      Promise.resolve(requestAppFullscreen()).catch((error) => {
        console.warn('Unable to enter fullscreen', error);
      });
    }
  });

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((eventName) => {
    document.addEventListener(eventName, updateFullscreenButtonLabel);
  });
}

function handleResolutionChange(event) {
  const value = parseFloat(event.target.value);
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  resolutionScale = value;
  updateRendererSize();
}

if (resolutionSelect) {
  resolutionSelect.addEventListener('change', handleResolutionChange);
}

updateRendererSize();
applyOrientationClass();

window.addEventListener('orientationchange', applyOrientationClass);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe9ff);
scene.fog = new THREE.FogExp2(0xdff4ff, 0.0009);

const clock = new THREE.Clock();
let lastFpsUpdate = performance.now();
let frameCount = 0;

const thirdPersonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
const topDownCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 5, 2000);
const ISO_FRUSTUM_SIZE = 90;
const isoAspect = window.innerWidth / window.innerHeight;
const isometricCamera = new THREE.OrthographicCamera(
  -ISO_FRUSTUM_SIZE * isoAspect,
  ISO_FRUSTUM_SIZE * isoAspect,
  ISO_FRUSTUM_SIZE,
  -ISO_FRUSTUM_SIZE,
  1,
  2000,
);
const isometricOffset = new THREE.Vector3(90, 140, 90);
isometricCamera.position.copy(isometricOffset.clone().add(new THREE.Vector3(0, 6, 0)));
isometricCamera.lookAt(new THREE.Vector3(0, 30, 0));
isometricCamera.up.set(0, 1, 0);

let activeCamera = thirdPersonCamera;
let cameraMode = 'third';

// World scale: 1 unit = 1 meter
const TILE_SIZE = 64;
const HALF_TILE = TILE_SIZE / 2;
const ROAD_WIDTH = 10;

const roadAreas = [];
const buildingColliders = [];
const palette = [0x4cb6ff, 0x5dd39e, 0xffa53a, 0xff6f91, 0xffd166, 0x8d5dfc, 0x70a0ff];

const ambient = new THREE.HemisphereLight(0xfffbf1, 0xd4f1ff, 0.85);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xfff1c9, 1.5);
sunLight.position.set(120, 240, -140);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 50;
sunLight.shadow.camera.far = 1200;
sunLight.shadow.camera.left = -480;
sunLight.shadow.camera.right = 480;
sunLight.shadow.camera.top = 480;
sunLight.shadow.camera.bottom = -480;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);

function createGround() {
  const tileGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, 32, 32);
  const position = tileGeometry.attributes.position;
  const colors = [];
  const baseA = new THREE.Color(0xc9f5a6);
  const baseB = new THREE.Color(0x9be28c);
  const tempColor = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const noise = (Math.sin(x * 0.15) + Math.cos(y * 0.18)) * 0.03;
    tempColor.copy(baseA).lerp(baseB, 0.45 + noise);
    colors.push(tempColor.r, tempColor.g, tempColor.b);
  }

  tileGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.05,
  });

  const ground = new THREE.Mesh(tileGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

const ground = createGround();

function createTileBounds() {
  const verticalExtent = 80;
  const thickness = 2;
  const padding = 0.5;

  const bounds = [
    new THREE.Box3(
      new THREE.Vector3(-HALF_TILE - padding, 0, -HALF_TILE - thickness),
      new THREE.Vector3(HALF_TILE + padding, verticalExtent, -HALF_TILE + padding),
    ),
    new THREE.Box3(
      new THREE.Vector3(-HALF_TILE - padding, 0, HALF_TILE - padding),
      new THREE.Vector3(HALF_TILE + padding, verticalExtent, HALF_TILE + thickness),
    ),
    new THREE.Box3(
      new THREE.Vector3(-HALF_TILE - thickness, 0, -HALF_TILE - padding),
      new THREE.Vector3(-HALF_TILE + padding, verticalExtent, HALF_TILE + padding),
    ),
    new THREE.Box3(
      new THREE.Vector3(HALF_TILE - padding, 0, -HALF_TILE - padding),
      new THREE.Vector3(HALF_TILE + thickness, verticalExtent, HALF_TILE + padding),
    ),
  ];

  bounds.forEach((box) => {
    buildingColliders.push({ box, mesh: null });
  });
}

createTileBounds();

function registerAreaFromMesh(mesh, padding = 4) {
  const bounds = new THREE.Box3().setFromObject(mesh);
  bounds.expandByScalar(padding);
  roadAreas.push(bounds);
}

const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0xd2d8de,
  roughness: 0.8,
  metalness: 0.05,
});

function createRoadSegment(start, end, width) {
  let mesh = null;
  if (Math.abs(end.x - start.x) > 0.001) {
    const length = Math.abs(end.x - start.x);
    const geometry = new THREE.BoxGeometry(length, 0.25, width);
    mesh = new THREE.Mesh(geometry, roadMaterial);
    mesh.position.set((start.x + end.x) / 2, 0.125, start.z);
  } else if (Math.abs(end.z - start.z) > 0.001) {
    const length = Math.abs(end.z - start.z);
    const geometry = new THREE.BoxGeometry(width, 0.25, length);
    mesh = new THREE.Mesh(geometry, roadMaterial);
    mesh.position.set(start.x, 0.125, (start.z + end.z) / 2);
  }

  if (mesh) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    registerAreaFromMesh(mesh, 5);
  }

  return mesh;
}

function createRoadNetwork() {
  const roadGroup = new THREE.Group();

  const segments = [
    {
      start: new THREE.Vector3(-HALF_TILE, 0, 0),
      end: new THREE.Vector3(HALF_TILE, 0, 0),
      width: ROAD_WIDTH,
    },
    {
      start: new THREE.Vector3(0, 0, -HALF_TILE),
      end: new THREE.Vector3(0, 0, HALF_TILE),
      width: ROAD_WIDTH,
    },
  ];

  segments.forEach(({ start, end, width }) => {
    const mesh = createRoadSegment(start, end, width);
    if (mesh) {
      roadGroup.add(mesh);
    }
  });

  const intersection = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.3, ROAD_WIDTH), roadMaterial);
  intersection.position.set(0, 0.15, 0);
  intersection.castShadow = false;
  intersection.receiveShadow = true;
  roadGroup.add(intersection);
  registerAreaFromMesh(intersection, 4);

  scene.add(roadGroup);
  return roadGroup;
}

createRoadNetwork();

function isBuildable(x, z, halfWidth, halfDepth) {
  const candidate = new THREE.Box3(
    new THREE.Vector3(x - halfWidth, 0, z - halfDepth),
    new THREE.Vector3(x + halfWidth, 160, z + halfDepth),
  );

  for (const area of roadAreas) {
    if (area.intersectsBox(candidate)) {
      return false;
    }
  }

  for (const { box } of buildingColliders) {
    if (candidate.intersectsBox(box)) {
      return false;
    }
  }

  return true;
}

function createTileStructures() {
  const buildingGroup = new THREE.Group();
  const spacing = 12;
  const minHeight = 10;
  const maxHeight = 36;

  for (let x = -HALF_TILE + spacing; x <= HALF_TILE - spacing; x += spacing) {
    for (let z = -HALF_TILE + spacing; z <= HALF_TILE - spacing; z += spacing) {
      if (Math.abs(x) < ROAD_WIDTH && Math.abs(z) < ROAD_WIDTH) {
        continue;
      }

      const width = THREE.MathUtils.randFloat(6, 12);
      const depth = THREE.MathUtils.randFloat(6, 12);

      if (!isBuildable(x, z, width / 2 + 1.5, depth / 2 + 1.5)) {
        continue;
      }

      const height = THREE.MathUtils.randFloat(minHeight, maxHeight);
      const baseColor = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      const geometry = new THREE.BoxGeometry(width, height, depth, 2, Math.max(1, Math.floor(height / 6)), 2);

      const colors = [];
      const posAttr = geometry.attributes.position;
      const colorTop = new THREE.Color(0xfff8e7);
      const workingColor = new THREE.Color();
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i) + height / 2;
        const t = y / height;
        workingColor.copy(baseColor).lerp(colorTop, t * 0.35);
        workingColor.offsetHSL(0, 0, (t - 0.5) * 0.18);
        workingColor.multiplyScalar(1.05 + t * 0.25);
        colors.push(workingColor.r, workingColor.g, workingColor.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.08,
        envMapIntensity: 0.4,
      });

      const building = new THREE.Mesh(geometry, material);
      building.position.set(x + THREE.MathUtils.randFloatSpread(1.5), height / 2, z + THREE.MathUtils.randFloatSpread(1.5));
      building.castShadow = true;
      building.receiveShadow = true;
      buildingGroup.add(building);

      const collider = new THREE.Box3().setFromObject(building);
      buildingColliders.push({ box: collider, mesh: building });
    }
  }

  scene.add(buildingGroup);
}

createTileStructures();

const playerMaterial = new THREE.MeshPhongMaterial({ color: 0xffd7ba, flatShading: true });
const playerGeometry = new THREE.CapsuleGeometry(0.35, 1.3, 6, 12);
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 1, 0);
playerGeometry.computeBoundingBox();
scene.add(player);
updateIsometricCamera(0);

const playerBox = new THREE.Box3().setFromObject(player);
let yaw = Math.PI;
let sprint = false;
let pointerDragging = false;
let lastPointerPosition = null;

function clampAngle(angle) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

function adjustYaw(delta) {
  yaw = clampAngle(yaw + delta);
}

function handleKey(event, isDown) {
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      input.forward = isDown;
      break;
    case 'KeyS':
    case 'ArrowDown':
      input.backward = isDown;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      input.left = isDown;
      break;
    case 'KeyD':
    case 'ArrowRight':
      input.right = isDown;
      break;
    case 'Space':
      if (isDown) sprint = !sprint;
      break;
    case 'KeyC':
      if (isDown) toggleCamera();
      break;
    case 'KeyR':
      if (isDown) resetPlayer();
      break;
    default:
      break;
  }
}

document.addEventListener('keydown', (event) => handleKey(event, true));
document.addEventListener('keyup', (event) => handleKey(event, false));

function handlePointerMove(event) {
  if (!pointerDragging || !lastPointerPosition) {
    return;
  }

  const dx = event.clientX - lastPointerPosition.x;
  lastPointerPosition = { x: event.clientX, y: event.clientY };

  if (cameraMode === 'third') {
    const yawSensitivity = 0.0035;
    adjustYaw(-dx * yawSensitivity);
  }

  if (event.pointerType === 'touch') {
    event.preventDefault();
  }
}

if (canvas) {
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false) {
      return;
    }

    if (event.pointerType === 'touch') {
      event.preventDefault();
    }

    pointerDragging = true;
    lastPointerPosition = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });

  const stopDragging = (event) => {
    pointerDragging = false;
    lastPointerPosition = null;
    canvas.releasePointerCapture?.(event.pointerId);
  };

  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
}

function resetPlayer() {
  player.position.set(0, 1, 0);
  yaw = Math.PI;
}

function toggleCamera() {
  if (cameraMode === 'third') {
    cameraMode = 'top';
    activeCamera = topDownCamera;
  } else if (cameraMode === 'top') {
    cameraMode = 'iso';
    activeCamera = isometricCamera;
  } else {
    cameraMode = 'third';
    activeCamera = thirdPersonCamera;
  }
}

function updatePlayer(delta) {
  const rotateSpeed = 1.8;
  const baseMoveSpeed = 30;
  const moveSpeed = sprint ? baseMoveSpeed * 1.7 : baseMoveSpeed;

  if (input.left && !input.right) {
    adjustYaw(rotateSpeed * delta);
  } else if (input.right && !input.left) {
    adjustYaw(-rotateSpeed * delta);
  }

  player.rotation.y = yaw + Math.PI / 2; // align capsule front

  const direction = new THREE.Vector3();
  if (input.forward) direction.z -= 1;
  if (input.backward) direction.z += 1;
  direction.normalize();

  if (direction.lengthSq() > 0) {
    const moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const speed = (input.forward ? 1 : -1) * moveSpeed * delta;
    const displacement = moveDir.multiplyScalar(speed);
    attemptMove(displacement);
  }
}

function attemptMove(displacement) {
  const previous = player.position.clone();
  player.position.add(displacement);
  playerBox.setFromObject(player);

  for (const { box } of buildingColliders) {
    if (playerBox.intersectsBox(box)) {
      player.position.copy(previous);
      playerBox.setFromObject(player);
      return;
    }
  }
}

function updateThirdPersonCamera(delta) {
  const offset = new THREE.Vector3(0, 22, 38);
  const rotatedOffset = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const targetPosition = player.position.clone().add(rotatedOffset);
  thirdPersonCamera.position.lerp(targetPosition, 1 - Math.pow(0.001, delta));
  const lookTarget = player.position.clone();
  lookTarget.y += 10;
  thirdPersonCamera.lookAt(lookTarget);
}

function updateTopDownCamera(delta) {
  const height = 140;
  const offset = new THREE.Vector3(0, height, 0);
  const targetPosition = player.position.clone().add(offset);
  topDownCamera.position.lerp(targetPosition, 1 - Math.pow(0.001, delta));
  topDownCamera.lookAt(player.position);
  topDownCamera.up.set(0, 0, -1);
}

function updateIsometricCamera(delta) {
  const targetPosition = player.position.clone().add(isometricOffset);
  const lerp = delta > 0 ? 1 - Math.pow(0.001, delta) : 1;
  isometricCamera.position.lerp(targetPosition, lerp);
  const lookTarget = player.position.clone();
  lookTarget.y += 24;
  isometricCamera.lookAt(lookTarget);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updatePlayer(delta);
  updateThirdPersonCamera(delta);
  updateTopDownCamera(delta);
  updateIsometricCamera(delta);

  renderer.render(scene, activeCamera);

  if (fpsCounter) {
    frameCount += 1;
    const now = performance.now();
    if (now - lastFpsUpdate >= 500) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      fpsCounter.textContent = `FPS: ${fps}`;
      frameCount = 0;
      lastFpsUpdate = now;
    }
  }
}

animate();

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  updateRendererSize();
  const aspect = innerWidth / innerHeight;
  thirdPersonCamera.aspect = aspect;
  thirdPersonCamera.updateProjectionMatrix();
  topDownCamera.aspect = aspect;
  topDownCamera.updateProjectionMatrix();
  isometricCamera.left = -ISO_FRUSTUM_SIZE * aspect;
  isometricCamera.right = ISO_FRUSTUM_SIZE * aspect;
  isometricCamera.top = ISO_FRUSTUM_SIZE;
  isometricCamera.bottom = -ISO_FRUSTUM_SIZE;
  isometricCamera.updateProjectionMatrix();
  applyOrientationClass();
});
