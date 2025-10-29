import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const joystick = document.getElementById('joystick');
const actionBtn = document.getElementById('actionBtn');
const gyroPermButton = document.getElementById('gyroPermButton');

// --- Renderer & Scene Setup ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 20);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(30, 50, 20);
scene.add(directional);

// --- Ground Plane with Wave Animation ---
const planeSize = 100;
const planeSegments = 100;
const groundGeometry = new THREE.PlaneGeometry(planeSize, planeSize, planeSegments, planeSegments);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x204030, roughness: 0.8, metalness: 0.1 });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const basePositions = groundGeometry.attributes.position.array.slice();

function updateWaves(time) {
  const positions = groundGeometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    const x = basePositions[i];
    const z = basePositions[i + 2];
    positions[i + 1] = Math.sin(x * 0.2 + time * 2.0) * 1.5 + Math.sin(z * 0.3 + time * 1.5) * 1.5;
  }
  groundGeometry.attributes.position.needsUpdate = true;
  groundGeometry.computeVertexNormals();
}

// --- Floating Objects ---
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x5577ff, roughness: 0.4, metalness: 0.3 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(-5, 4, 0);
scene.add(cube);

const sphereGeometry = new THREE.SphereGeometry(1.5, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xff8855, roughness: 0.2, metalness: 0.1 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(5, 5, 0);
scene.add(sphere);

const pyramidGeometry = new THREE.ConeGeometry(1.8, 3, 4);
const pyramidMaterial = new THREE.MeshStandardMaterial({ color: 0x88ff88, roughness: 0.6, metalness: 0.2 });
const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
pyramid.position.set(0, 6, -4);
scene.add(pyramid);

function updateObjects(delta) {
  const spin = 0.5 * delta;
  cube.rotation.y += spin;
  sphere.rotation.y += spin;
  pyramid.rotation.y -= spin * 0.6;
}

// --- Input State ---
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
  Enter: false,
};

window.addEventListener('keydown', (event) => {
  if (event.code in keys) {
    keys[event.code] = true;
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
    event.preventDefault();
  }
});

// Virtual joystick state
let moveX = 0;
let moveY = 0;
let joystickTouchId = null;

function resetJoystick() {
  moveX = 0;
  moveY = 0;
  joystickTouchId = null;
}

joystick.addEventListener('touchstart', (event) => {
  event.preventDefault();
  if (joystickTouchId !== null) return;
  const touch = event.changedTouches[0];
  joystickTouchId = touch.identifier;
});

joystick.addEventListener('touchmove', (event) => {
  event.preventDefault();
  if (joystickTouchId === null) return;
  for (const touch of event.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      const rect = joystick.getBoundingClientRect();
      const x = touch.clientX - rect.left - rect.width / 2;
      const y = touch.clientY - rect.top - rect.height / 2;
      const max = rect.width / 2;
      moveX = Math.max(-1, Math.min(1, x / max));
      moveY = Math.max(-1, Math.min(1, y / max));
      break;
    }
  }
});

joystick.addEventListener('touchend', (event) => {
  event.preventDefault();
  for (const touch of event.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      resetJoystick();
      break;
    }
  }
});

joystick.addEventListener('touchcancel', (event) => {
  event.preventDefault();
  for (const touch of event.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      resetJoystick();
      break;
    }
  }
});

// Action button
let actionActive = false;
let actionTouchId = null;

actionBtn.addEventListener('touchstart', (event) => {
  event.preventDefault();
  if (actionTouchId !== null) return;
  const touch = event.changedTouches[0];
  actionTouchId = touch.identifier;
  actionActive = true;
});

actionBtn.addEventListener('touchend', (event) => {
  event.preventDefault();
  for (const touch of event.changedTouches) {
    if (touch.identifier === actionTouchId) {
      actionTouchId = null;
      actionActive = false;
      break;
    }
  }
});

actionBtn.addEventListener('touchcancel', (event) => {
  event.preventDefault();
  for (const touch of event.changedTouches) {
    if (touch.identifier === actionTouchId) {
      actionTouchId = null;
      actionActive = false;
      break;
    }
  }
});

// Swipe / drag camera control
let camYaw = 0;
let camPitch = -15;
let isPointerDown = false;
let lastPointerX = 0;
let lastPointerY = 0;
const pointerSensitivity = 0.2;

canvas.addEventListener('mousedown', (event) => {
  isPointerDown = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});

window.addEventListener('mousemove', (event) => {
  if (!isPointerDown || gyroActive) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  adjustCameraAngles(dx, dy);
});

window.addEventListener('mouseup', () => {
  isPointerDown = false;
});

canvas.addEventListener('touchstart', (event) => {
  if (event.target !== canvas) return;
  event.preventDefault();
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    lastPointerX = touch.clientX;
    lastPointerY = touch.clientY;
  }
});

canvas.addEventListener('touchmove', (event) => {
  if (event.target !== canvas || gyroActive) return;
  event.preventDefault();
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const dx = touch.clientX - lastPointerX;
    const dy = touch.clientY - lastPointerY;
    lastPointerX = touch.clientX;
    lastPointerY = touch.clientY;
    adjustCameraAngles(dx, dy);
  }
});

function adjustCameraAngles(dx, dy) {
  camYaw -= dx * pointerSensitivity;
  camPitch -= dy * pointerSensitivity;
  camPitch = Math.max(-89, Math.min(89, camPitch));
}

// --- Gyroscope Controls ---
let gyroActive = false;
let deviceQuat = new THREE.Quaternion();
let screenOrientation = window.orientation || (screen.orientation ? screen.orientation.angle : 0) || 0;

const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function setObjectQuaternion(quaternion, alpha, beta, gamma, orient) {
  euler.set(beta, alpha, -gamma, 'YXZ');
  quaternion.setFromEuler(euler);
  quaternion.multiply(q1);
  quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
}

function handleOrientation(event) {
  const alpha = event.alpha !== null ? THREE.MathUtils.degToRad(event.alpha) : 0;
  const beta = event.beta !== null ? THREE.MathUtils.degToRad(event.beta) : 0;
  const gamma = event.gamma !== null ? THREE.MathUtils.degToRad(event.gamma) : 0;
  const orient = THREE.MathUtils.degToRad(screenOrientation || 0);
  setObjectQuaternion(deviceQuat, alpha, beta, gamma, orient);
  gyroActive = true;
}

function startOrientationListener() {
  window.addEventListener('deviceorientation', handleOrientation, true);
}

function setupGyroscopeAccess() {
  if ('DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      gyroPermButton.style.display = 'block';
      gyroPermButton.addEventListener('click', async () => {
        try {
          const response = await DeviceOrientationEvent.requestPermission();
          if (response === 'granted') {
            startOrientationListener();
          } else {
            console.warn('Device orientation permission denied');
          }
        } catch (error) {
          console.warn('Device orientation permission error', error);
        } finally {
          gyroPermButton.style.display = 'none';
        }
      }, { once: true });
    } else {
      startOrientationListener();
    }
  }
}

window.addEventListener('orientationchange', () => {
  screenOrientation = window.orientation || (screen.orientation ? screen.orientation.angle : 0) || 0;
});

setupGyroscopeAccess();

// --- Movement Helpers ---
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

function getYawRadians() {
  if (gyroActive) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return Math.atan2(dir.x, dir.z);
  }
  return THREE.MathUtils.degToRad(camYaw);
}

function updateCameraRotationFromManual() {
  const yawRad = THREE.MathUtils.degToRad(camYaw);
  const pitchRad = THREE.MathUtils.degToRad(camPitch);
  camera.rotation.set(pitchRad, yawRad, 0, 'YXZ');
}

// --- Resize Handling ---
window.addEventListener('resize', tuneRendererSize);

function tuneRendererSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

tuneRendererSize();

// --- Animation Loop ---
let lastTime = performance.now();

function loop(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  requestAnimationFrame(loop);

  if (gyroActive) {
    camera.quaternion.slerp(deviceQuat, 0.1);
  } else {
    updateCameraRotationFromManual();
  }

  const yaw = getYawRadians();
  tmpForward.set(Math.sin(yaw), 0, Math.cos(yaw));
  tmpRight.copy(tmpForward).applyAxisAngle(upVector, Math.PI / 2);

  const speed = 5;
  if (keys.ArrowUp || moveY < -0.3) {
    camera.position.addScaledVector(tmpForward, speed * delta);
  }
  if (keys.ArrowDown || moveY > 0.3) {
    camera.position.addScaledVector(tmpForward, -speed * delta);
  }

  if (gyroActive) {
    if (keys.ArrowLeft || moveX < -0.3) {
      camera.position.addScaledVector(tmpRight, -speed * delta);
    }
    if (keys.ArrowRight || moveX > 0.3) {
      camera.position.addScaledVector(tmpRight, speed * delta);
    }
  } else {
    const turnSpeed = 90 * delta;
    if (keys.ArrowLeft || moveX < -0.3) {
      camYaw += turnSpeed;
    }
    if (keys.ArrowRight || moveX > 0.3) {
      camYaw -= turnSpeed;
    }
  }

  if (keys.Space || actionActive) {
    // Placeholder for jump/shoot action
  }

  if (keys.Enter) {
    // Placeholder for interaction action
  }

  const time = now / 1000;
  updateWaves(time);
  updateObjects(delta);

  renderer.render(scene, camera);
}

requestAnimationFrame(loop);
