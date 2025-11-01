import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);
scene.fog = new THREE.FogExp2(0x0b1120, 0.002);

const clock = new THREE.Clock();

const thirdPersonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
const topDownCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 5, 6000);

let activeCamera = thirdPersonCamera;
let cameraMode = 'third';

const ambient = new THREE.AmbientLight(0x6b7280, 0.65);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xf5d08a, 1.15);
sunLight.position.set(400, 600, -400);
sunLight.castShadow = false;
scene.add(sunLight);

const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x111b33, flatShading: true });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 10, 10), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x1f2937, flatShading: true });
const roadGrid = new THREE.Group();
const roadWidth = 16;
const gridSize = 12;
const blockSize = 60;

for (let i = -gridSize; i <= gridSize; i++) {
  const roadX = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 1, blockSize * gridSize * 2 + blockSize), roadMaterial);
  roadX.position.set(i * blockSize, 0.5, 0);
  roadGrid.add(roadX);

  const roadZ = new THREE.Mesh(new THREE.BoxGeometry(blockSize * gridSize * 2 + blockSize, 1, roadWidth), roadMaterial);
  roadZ.position.set(0, 0.5, i * blockSize);
  roadGrid.add(roadZ);
}
roadGrid.traverse(obj => {
  if (obj.isMesh) {
    obj.castShadow = false;
    obj.receiveShadow = true;
  }
});
scene.add(roadGrid);

const buildingColliders = [];
const palette = [0x1f6feb, 0x30a14e, 0xf85149, 0x6f42c1, 0xd29922, 0x0ea5e9, 0x9333ea];

function createCity() {
  const buildingGroup = new THREE.Group();
  const minHeight = 16;
  const maxHeight = 120;

  for (let x = -gridSize; x <= gridSize; x++) {
    for (let z = -gridSize; z <= gridSize; z++) {
      if (Math.abs(x) < 1 && Math.abs(z) < 1) continue; // leave a plaza around origin
      if ((x + z) % 2 !== 0) continue; // sparse pattern for performance & road gaps

      const width = THREE.MathUtils.randFloat(18, 32);
      const depth = THREE.MathUtils.randFloat(18, 32);
      const height = THREE.MathUtils.randFloat(minHeight, maxHeight);
      const color = palette[Math.floor(Math.random() * palette.length)];
      const material = new THREE.MeshPhongMaterial({ color, flatShading: true });
      const geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
      const building = new THREE.Mesh(geometry, material);
      building.position.set(x * blockSize, height / 2, z * blockSize);
      building.castShadow = false;
      building.receiveShadow = true;
      buildingGroup.add(building);

      const collider = new THREE.Box3().setFromObject(building);
      buildingColliders.push({ box: collider, mesh: building });
    }
  }

  scene.add(buildingGroup);
}

createCity();

const playerMaterial = new THREE.MeshPhongMaterial({ color: 0xfff3b0, flatShading: true });
const playerGeometry = new THREE.CapsuleGeometry(3, 6, 6, 12);
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 6, 0);
playerGeometry.computeBoundingBox();
scene.add(player);

const playerBox = new THREE.Box3().setFromObject(player);
let yaw = Math.PI;
let sprint = false;

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

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

function resetPlayer() {
  player.position.set(0, 6, 0);
  yaw = Math.PI;
}

function toggleCamera() {
  if (cameraMode === 'third') {
    cameraMode = 'top';
    activeCamera = topDownCamera;
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
    yaw += rotateSpeed * delta;
  } else if (input.right && !input.left) {
    yaw -= rotateSpeed * delta;
  }

  player.rotation.y = yaw + Math.PI / 2; // align capsule front

  const direction = new THREE.Vector3();
  if (input.forward) direction.z -= 1;
  if (input.backward) direction.z += 1;
  direction.normalize();

  if (direction.lengthSq() > 0) {
    const moveDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
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

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updatePlayer(delta);
  updateThirdPersonCamera(delta);
  updateTopDownCamera(delta);

  renderer.render(scene, activeCamera);
}

animate();

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight);
  thirdPersonCamera.aspect = innerWidth / innerHeight;
  thirdPersonCamera.updateProjectionMatrix();
  topDownCamera.aspect = innerWidth / innerHeight;
  topDownCamera.updateProjectionMatrix();
});
