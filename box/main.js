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
scene.background = new THREE.Color(0x0b1120);
scene.fog = new THREE.FogExp2(0x0b1120, 0.002);

const clock = new THREE.Clock();
let lastFpsUpdate = performance.now();
let frameCount = 0;

const thirdPersonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
const topDownCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 5, 6000);
const ISO_FRUSTUM_SIZE = 140;
const isoAspect = window.innerWidth / window.innerHeight;
const isometricCamera = new THREE.OrthographicCamera(
  -ISO_FRUSTUM_SIZE * isoAspect,
  ISO_FRUSTUM_SIZE * isoAspect,
  ISO_FRUSTUM_SIZE,
  -ISO_FRUSTUM_SIZE,
  1,
  3000,
);
const isometricOffset = new THREE.Vector3(180, 260, 180);
isometricCamera.position.copy(isometricOffset.clone().add(new THREE.Vector3(0, 6, 0)));
isometricCamera.lookAt(new THREE.Vector3(0, 40, 0));
isometricCamera.up.set(0, 1, 0);
const forwardVector = new THREE.Vector3(1, 0, 0);
const transitQuaternion = new THREE.Quaternion();

let activeCamera = thirdPersonCamera;
let cameraMode = 'third';

// World scale: 1 unit = 1 meter
const CITY_SIZE = 320;
const HALF_CITY = CITY_SIZE / 2;
const RIVER_WIDTH = 28;
const RIVER_CENTER_Z = 32;

const roadAreas = [];
const buildingColliders = [];
const palette = [0x1f6feb, 0x30a14e, 0xf85149, 0x6f42c1, 0xd29922, 0x0ea5e9, 0x9333ea];

const ambient = new THREE.HemisphereLight(0x8ba2c9, 0x060a14, 0.6);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xf7e3b5, 1.35);
sunLight.position.set(320, 520, -260);
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
  const tileGeometry = new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE, CITY_SIZE, CITY_SIZE);
  const position = tileGeometry.attributes.position;
  const colors = [];
  const baseA = new THREE.Color(0x0a1324);
  const baseB = new THREE.Color(0x0d1b33);
  const tempColor = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const noise = (Math.sin(x * 0.15) + Math.cos(y * 0.18)) * 0.03;
    tempColor.copy(baseA).lerp(baseB, 0.55 + noise);
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

function registerAreaFromMesh(mesh, padding = 4) {
  const bounds = new THREE.Box3().setFromObject(mesh);
  bounds.expandByScalar(padding);
  roadAreas.push(bounds);
}

const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e2b3d,
  roughness: 0.85,
  metalness: 0.08,
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
    // Horizontal corridors
    { start: new THREE.Vector3(-HALF_CITY, 0, -120), end: new THREE.Vector3(HALF_CITY, 0, -120), width: 14 },
    { start: new THREE.Vector3(-HALF_CITY, 0, -50), end: new THREE.Vector3(HALF_CITY, 0, -50), width: 12 },
    { start: new THREE.Vector3(-HALF_CITY, 0, 10), end: new THREE.Vector3(HALF_CITY, 0, 10), width: 10 },
    { start: new THREE.Vector3(-HALF_CITY, 0, 100), end: new THREE.Vector3(HALF_CITY, 0, 100), width: 12 },

    // Vertical avenues
    { start: new THREE.Vector3(-120, 0, -HALF_CITY), end: new THREE.Vector3(-120, 0, HALF_CITY), width: 12 },
    { start: new THREE.Vector3(-60, 0, -HALF_CITY), end: new THREE.Vector3(-60, 0, HALF_CITY), width: 10 },
    { start: new THREE.Vector3(60, 0, -HALF_CITY), end: new THREE.Vector3(60, 0, HALF_CITY), width: 10 },
    { start: new THREE.Vector3(120, 0, -HALF_CITY), end: new THREE.Vector3(120, 0, HALF_CITY), width: 12 },

    // Split central avenue around the river
    { start: new THREE.Vector3(0, 0, -HALF_CITY), end: new THREE.Vector3(0, 0, RIVER_CENTER_Z - RIVER_WIDTH / 2 - 6), width: 16 },
    { start: new THREE.Vector3(0, 0, RIVER_CENTER_Z + RIVER_WIDTH / 2 + 6), end: new THREE.Vector3(0, 0, HALF_CITY), width: 16 },
  ];

  segments.forEach(({ start, end, width }) => {
    const mesh = createRoadSegment(start, end, width);
    if (mesh) {
      roadGroup.add(mesh);
    }
  });

  scene.add(roadGroup);
  return roadGroup;
}

createRoadNetwork();

function createRiver() {
  const geometry = new THREE.PlaneGeometry(CITY_SIZE + 60, RIVER_WIDTH, Math.floor(CITY_SIZE / 2), 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x14324f,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 0.95,
    envMapIntensity: 0.4,
  });

  const river = new THREE.Mesh(geometry, material);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.02, RIVER_CENTER_Z);
  river.receiveShadow = false;
  scene.add(river);

  const bounds = new THREE.Box3().setFromObject(river);
  bounds.expandByScalar(4);
  roadAreas.push(bounds);

  return river;
}

function createBridge() {
  const bridgeGroup = new THREE.Group();
  const deckLength = RIVER_WIDTH + 36;
  const deckWidth = 16;

  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x3c4756, metalness: 0.25, roughness: 0.6 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 1.2, deckLength), deckMaterial);
  deck.position.set(0, 6, RIVER_CENTER_Z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridgeGroup.add(deck);

  const surfaceMaterial = roadMaterial.clone();
  surfaceMaterial.color = surfaceMaterial.color.clone();
  surfaceMaterial.color.offsetHSL(0, 0, 0.05);
  const deckSurface = new THREE.Mesh(new THREE.BoxGeometry(deckWidth - 1.2, 0.2, deckLength - 2), surfaceMaterial);
  deckSurface.position.set(0, 6.6, RIVER_CENTER_Z);
  deckSurface.castShadow = true;
  deckSurface.receiveShadow = true;
  bridgeGroup.add(deckSurface);

  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xbfcad9, metalness: 0.6, roughness: 0.4 });
  const railingGeometry = new THREE.BoxGeometry(0.6, 1.4, deckLength - 2);
  [-deckWidth / 2 + 0.8, deckWidth / 2 - 0.8].forEach((x) => {
    const railing = new THREE.Mesh(railingGeometry, railMaterial);
    railing.position.set(x, 7.4, RIVER_CENTER_Z);
    railing.castShadow = true;
    railing.receiveShadow = true;
    bridgeGroup.add(railing);
  });

  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3948, metalness: 0.15, roughness: 0.75 });
  const supportGeometry = new THREE.BoxGeometry(2.8, 6.2, 3.2);
  [-deckLength / 2 + 8, deckLength / 2 - 8].forEach((offset) => {
    const support = new THREE.Mesh(supportGeometry, supportMaterial);
    support.position.set(-3.8, 3.1, RIVER_CENTER_Z + offset);
    support.castShadow = true;
    support.receiveShadow = true;
    bridgeGroup.add(support);
    registerAreaFromMesh(support, 3);

    const twin = support.clone();
    twin.position.x = 3.8;
    bridgeGroup.add(twin);
    registerAreaFromMesh(twin, 3);
  });

  const archMaterial = new THREE.MeshStandardMaterial({ color: 0x465262, metalness: 0.25, roughness: 0.6 });
  const archGeometry = new THREE.TorusGeometry(deckWidth * 0.35, 0.7, 12, 36, Math.PI);
  const arch = new THREE.Mesh(archGeometry, archMaterial);
  arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  arch.position.set(0, 7.2, RIVER_CENTER_Z);
  arch.castShadow = true;
  arch.receiveShadow = true;
  bridgeGroup.add(arch);

  scene.add(bridgeGroup);
  return bridgeGroup;
}

const streetlightLights = [];
const MAX_ACTIVE_STREETLIGHTS = 12;
const STREETLIGHT_MAX_DISTANCE = 90;

function createStreetlights() {
  const streetlightGroup = new THREE.Group();
  const poleGeometry = new THREE.CylinderGeometry(0.35, 0.45, 6, 12);
  const armGeometry = new THREE.BoxGeometry(0.35, 0.3, 2.4);
  const lampGeometry = new THREE.SphereGeometry(0.45, 16, 14);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x485263, metalness: 0.5, roughness: 0.45 });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xfdf7c0,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  });

  const placements = [];
  for (let z = -150; z <= 150; z += 18) {
    if (Math.abs(z - RIVER_CENTER_Z) < RIVER_WIDTH / 2 + 6) {
      continue;
    }
    placements.push({ x: -8, z }, { x: 8, z });
  }

  for (let z = -RIVER_WIDTH / 2 - 10; z <= RIVER_WIDTH / 2 + 10; z += 8) {
    placements.push({ x: -7, z: RIVER_CENTER_Z + z }, { x: 7, z: RIVER_CENTER_Z + z });
  }

  placements.forEach(({ x, z }) => {
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 3, z);
    pole.castShadow = true;
    pole.receiveShadow = true;

    const arm = new THREE.Mesh(armGeometry, poleMaterial);
    arm.position.set(0, 2.4, 1.2);
    arm.rotation.x = Math.PI / 14;
    pole.add(arm);

    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.position.set(0, 0, 1.25);
    arm.add(lamp);

    const pointLight = new THREE.PointLight(0xfff4c2, 1.4, 30, 2.2);
    pointLight.position.set(0, 0, 0);
    pointLight.visible = false;
    lamp.add(pointLight);
    streetlightLights.push({
      light: pointLight,
      position: new THREE.Vector3(x, 3, z),
    });

    streetlightGroup.add(pole);
  });

  scene.add(streetlightGroup);
  return streetlightGroup;
}

function createElevatedTrain() {
  const pathPoints = [
    new THREE.Vector3(-150, 18, -120),
    new THREE.Vector3(150, 18, -120),
    new THREE.Vector3(170, 18, 110),
    new THREE.Vector3(-160, 18, 120),
  ];

  const curve = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.6);

  const trackGeometry = new THREE.TubeGeometry(curve, 280, 0.55, 8, true);
  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x6c7a89, metalness: 0.6, roughness: 0.3 });
  const track = new THREE.Mesh(trackGeometry, trackMaterial);
  track.castShadow = true;
  track.receiveShadow = false;
  scene.add(track);

  const supportGroup = new THREE.Group();
  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4454, metalness: 0.25, roughness: 0.7 });
  const supportGeometry = new THREE.BoxGeometry(2.2, 14, 2.4);
  for (let t = 0; t < 1; t += 0.08) {
    const point = curve.getPointAt(t);
    const support = new THREE.Mesh(supportGeometry, supportMaterial);
    support.position.set(point.x, point.y - 7, point.z);
    support.castShadow = true;
    support.receiveShadow = true;
    supportGroup.add(support);
    registerAreaFromMesh(support, 3);
  }
  scene.add(supportGroup);

  const trainGroup = new THREE.Group();
  const carGeometry = new THREE.BoxGeometry(9, 3.2, 3);
  const carMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa94d,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x331c09,
    emissiveIntensity: 0.25,
  });
  const windowGeometry = new THREE.BoxGeometry(8.2, 1.1, 0.2);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });

  for (let i = 0; i < 2; i++) {
    const car = new THREE.Mesh(carGeometry, carMaterial);
    car.position.set(i * 9 - 4.5, 0, 0);
    car.castShadow = true;
    car.receiveShadow = true;
    trainGroup.add(car);

    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow.position.set(i * 9 - 4.5, 0.8, 1.6);
    trainGroup.add(frontWindow);

    const backWindow = frontWindow.clone();
    backWindow.position.z = -1.6;
    trainGroup.add(backWindow);
  }

  const headLight = new THREE.PointLight(0xfff5c8, 1.2, 26, 2.1);
  headLight.position.set(4.5, 0.7, 1.1);
  trainGroup.add(headLight);

  scene.add(trainGroup);

  return { curve, train: trainGroup };
}

function createStreetcar() {
  const pathPoints = [
    new THREE.Vector3(-140, 0.35, -50),
    new THREE.Vector3(140, 0.35, -50),
    new THREE.Vector3(140, 0.35, 100),
    new THREE.Vector3(-140, 0.35, 100),
  ];

  const curve = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.7);

  const railGeometry = new THREE.TubeGeometry(curve, 240, 0.18, 12, true);
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.85, roughness: 0.25 });
  const rails = new THREE.Mesh(railGeometry, railMaterial);
  rails.castShadow = false;
  rails.receiveShadow = true;
  scene.add(rails);
  registerAreaFromMesh(rails, 4);

  const carGroup = new THREE.Group();
  const baseGeometry = new THREE.BoxGeometry(8, 2.4, 2.6);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.55, metalness: 0.15 });
  const roofGeometry = new THREE.CylinderGeometry(1.4, 1.4, 8, 16, 1, true, 0, Math.PI * 2);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xfee2e2, roughness: 0.4, metalness: 0.3 });

  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.castShadow = true;
  base.receiveShadow = true;
  carGroup.add(base);

  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 1.4;
  carGroup.add(roof);

  const light = new THREE.PointLight(0xfff5d1, 1.1, 18, 2);
  light.position.set(0, 0.7, 1.3);
  carGroup.add(light);

  scene.add(carGroup);

  return { curve, car: carGroup };
}

function isBuildable(x, z, halfWidth, halfDepth) {
  if (Math.abs(z - RIVER_CENTER_Z) < RIVER_WIDTH / 2 + 6) {
    return false;
  }

  const candidate = new THREE.Box3(
    new THREE.Vector3(x - halfWidth, 0, z - halfDepth),
    new THREE.Vector3(x + halfWidth, 160, z + halfDepth),
  );

  for (const area of roadAreas) {
    if (area.intersectsBox(candidate)) {
      return false;
    }
  }

  return true;
}

function createCity() {
  const buildingGroup = new THREE.Group();
  const minHeight = 14;
  const maxHeight = 110;
  const spacing = 26;

  for (let x = -HALF_CITY + spacing; x <= HALF_CITY - spacing; x += spacing) {
    for (let z = -HALF_CITY + spacing; z <= HALF_CITY - spacing; z += spacing) {
      if (Math.abs(x) < 18 && Math.abs(z) < 18) {
        continue;
      }

      const width = THREE.MathUtils.randFloat(12, 24);
      const depth = THREE.MathUtils.randFloat(12, 26);

      if (!isBuildable(x, z, width / 2 + 2, depth / 2 + 2)) {
        continue;
      }

      const height = THREE.MathUtils.randFloat(minHeight, maxHeight);
      const baseColor = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      const geometry = new THREE.BoxGeometry(width, height, depth, 2, Math.max(1, Math.floor(height / 12)), 2);

      const colors = [];
      const posAttr = geometry.attributes.position;
      const colorTop = new THREE.Color(0xf8fafc);
      const workingColor = new THREE.Color();
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i) + height / 2;
        const t = y / height;
        workingColor.copy(baseColor).lerp(colorTop, t * 0.25);
        workingColor.offsetHSL(0, 0, (t - 0.5) * 0.18);
        workingColor.multiplyScalar(0.85 + t * 0.35);
        colors.push(workingColor.r, workingColor.g, workingColor.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.1,
        envMapIntensity: 0.5,
      });

      const building = new THREE.Mesh(geometry, material);
      building.position.set(x + THREE.MathUtils.randFloatSpread(3), height / 2, z + THREE.MathUtils.randFloatSpread(3));
      building.castShadow = true;
      building.receiveShadow = true;
      buildingGroup.add(building);

      const collider = new THREE.Box3().setFromObject(building);
      buildingColliders.push({ box: collider, mesh: building });
    }
  }

  scene.add(buildingGroup);
}

createRiver();
createBridge();
createStreetlights();
const elevatedTransit = createElevatedTrain();
const streetcarTransit = createStreetcar();
createCity();

let elevatedTrainProgress = 0;
let streetcarProgress = 0;

function updateTransit(delta) {
  if (elevatedTransit) {
    const trainSpeed = 0.018;
    elevatedTrainProgress = (elevatedTrainProgress + delta * trainSpeed) % 1;
    const position = elevatedTransit.curve.getPointAt(elevatedTrainProgress);
    const tangent = elevatedTransit.curve.getTangentAt(elevatedTrainProgress).normalize();
    transitQuaternion.setFromUnitVectors(forwardVector, tangent);
    const elevatedPosition = position.clone();
    elevatedPosition.y += 1.3;
    elevatedTransit.train.position.copy(elevatedPosition);
    const trainLerp = delta > 0 ? 1 - Math.pow(0.0012, delta) : 1;
    elevatedTransit.train.quaternion.slerp(transitQuaternion, trainLerp);
  }

  if (streetcarTransit) {
    const streetcarSpeed = 0.03;
    streetcarProgress = (streetcarProgress + delta * streetcarSpeed) % 1;
    const position = streetcarTransit.curve.getPointAt(streetcarProgress);
    const tangent = streetcarTransit.curve.getTangentAt(streetcarProgress).normalize();
    transitQuaternion.setFromUnitVectors(forwardVector, tangent);
    const streetcarPosition = position.clone();
    streetcarPosition.y += 1.2;
    streetcarTransit.car.position.copy(streetcarPosition);
    const streetcarLerp = delta > 0 ? 1 - Math.pow(0.0012, delta) : 1;
    streetcarTransit.car.quaternion.slerp(transitQuaternion, streetcarLerp);
  }
}

function updateStreetlightVisibility(origin) {
  if (streetlightLights.length === 0) {
    return;
  }

  streetlightLights.forEach((entry) => {
    entry.distance = entry.position.distanceTo(origin);
  });

  streetlightLights.sort((a, b) => a.distance - b.distance);

  streetlightLights.forEach((entry, index) => {
    entry.light.visible = index < MAX_ACTIVE_STREETLIGHTS && entry.distance <= STREETLIGHT_MAX_DISTANCE;
  });
}

updateTransit(0);

const playerMaterial = new THREE.MeshPhongMaterial({ color: 0xfff3b0, flatShading: true });
const playerGeometry = new THREE.CapsuleGeometry(3, 6, 6, 12);
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 6, 0);
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
  player.position.set(0, 6, 0);
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
  const offset = new THREE.Vector3(0, 28, 55);
  const rotatedOffset = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const targetPosition = player.position.clone().add(rotatedOffset);
  thirdPersonCamera.position.lerp(targetPosition, 1 - Math.pow(0.001, delta));
  const lookTarget = player.position.clone();
  lookTarget.y += 10;
  thirdPersonCamera.lookAt(lookTarget);
}

function updateTopDownCamera(delta) {
  const height = 260;
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
  lookTarget.y += 40;
  isometricCamera.lookAt(lookTarget);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updatePlayer(delta);
  updateThirdPersonCamera(delta);
  updateTopDownCamera(delta);
  updateIsometricCamera(delta);
  updateTransit(delta);
  updateStreetlightVisibility(player.position);

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
