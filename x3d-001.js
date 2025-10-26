// === CONFIGURATION ===
const DEBUG = window.location.hash === '#debug';
const CANVAS_WIDTH = Math.min(window.innerWidth, 1440);
const CANVAS_HEIGHT = Math.min(window.innerHeight, 900);
const MAX_OBJECTS = 500;
const MAX_PARTICLES = 200;
const ROTATION_SPEED = 0.005;
const MOVE_SPEED = 2;

// === STATE ===
const canvas = document.getElementById('vectorCanvas');
const ctx = canvas.getContext('2d');
const debugPanel = document.getElementById('debugPanel');
const fpsElement = document.getElementById('fps');
const objCountElement = document.getElementById('objCount');
const particleCountElement = document.getElementById('particleCount');

let camera = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0 };
let autoRotate = true;
let vectorObjects = [];
let particles = [];
let keys = {};
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;

// === INITIALIZATION ===
function init() {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  if (DEBUG) debugPanel.classList.add('active');

  generateVectorWorld();
  generateParticles();

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', handleResize);

  requestAnimationFrame(animate);
}

// === VECTOR WORLD GENERATION ===
function generateVectorWorld() {
  vectorObjects = [];

  // Generate buildings
  for (let i = 0; i < MAX_OBJECTS; i++) {
    const height = 50 + Math.random() * 200;
    const width = 30 + Math.random() * 70;
    const depth = 30 + Math.random() * 70;

    vectorObjects.push({
      type: 'building',
      x: (Math.random() - 0.5) * 2000,
      y: height / 2,
      z: (Math.random() - 0.5) * 2000,
      width,
      height,
      depth,
      color: `hsl(${180 + Math.random() * 60}, 100%, 50%)`
    });
  }

  // Generate terrain grid
  for (let x = -1000; x <= 1000; x += 100) {
    for (let z = -1000; z <= 1000; z += 100) {
      vectorObjects.push({
        type: 'terrain',
        x,
        y: 0,
        z,
        size: 100,
        color: '#0a4'
      });
    }
  }
}

// === PARTICLE SYSTEM ===
function generateParticles() {
  particles = [];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 500,
      z: (Math.random() - 0.5) * 3000,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      vz: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 2 + 1,
      color: '#fff'
    });
  }
}

// === 3D PROJECTION ===
function project3D(x, y, z) {
  // Apply camera rotation
  const cosX = Math.cos(camera.rotX);
  const sinX = Math.sin(camera.rotX);
  const cosY = Math.cos(camera.rotY);
  const sinY = Math.sin(camera.rotY);

  // Translate relative to camera
  x -= camera.x;
  y -= camera.y;
  z -= camera.z;

  // Rotate around Y axis
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  // Rotate around X axis
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  // Perspective projection
  const fov = 800;
  const scale = fov / (fov + z2);

  return {
    x: x1 * scale + CANVAS_WIDTH / 2,
    y: y1 * scale + CANVAS_HEIGHT / 2,
    scale
  };
}

// === RENDERING ===
function render() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Sort objects by depth (painter's algorithm)
  const allObjects = [...vectorObjects, ...particles];
  allObjects.sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow(a.x - camera.x, 2) +
      Math.pow(a.z - camera.z, 2)
    );
    const distB = Math.sqrt(
      Math.pow(b.x - camera.x, 2) +
      Math.pow(b.z - camera.z, 2)
    );
    return distB - distA;
  });

  // Render all objects
  allObjects.forEach(obj => {
    if (obj.type === 'building') {
      renderBuilding(obj);
    } else if (obj.type === 'terrain') {
      renderTerrain(obj);
    } else {
      renderParticle(obj);
    }
  });

  // Update debug info
  if (DEBUG) {
    objCountElement.textContent = vectorObjects.length;
    particleCountElement.textContent = particles.length;
  }
}

function renderBuilding(building) {
  const { x, y, z, width, height, depth, color } = building;

  // Calculate 8 vertices of the building
  const vertices = [
    { x: x - width / 2, y: y - height / 2, z: z - depth / 2 },
    { x: x + width / 2, y: y - height / 2, z: z - depth / 2 },
    { x: x + width / 2, y: y + height / 2, z: z - depth / 2 },
    { x: x - width / 2, y: y + height / 2, z: z - depth / 2 },
    { x: x - width / 2, y: y - height / 2, z: z + depth / 2 },
    { x: x + width / 2, y: y - height / 2, z: z + depth / 2 },
    { x: x + width / 2, y: y + height / 2, z: z + depth / 2 },
    { x: x - width / 2, y: y + height / 2, z: z + depth / 2 }
  ];

  // Project vertices to 2D
  const projected = vertices.map(v => project3D(v.x, v.y, v.z));

  // Draw faces
  const faces = [
    [0, 1, 2, 3], // front
    [4, 5, 6, 7], // back
    [0, 4, 7, 3], // left
    [1, 5, 6, 2], // right
    [0, 1, 5, 4], // top
    [3, 2, 6, 7] // bottom
  ];

  faces.forEach(face => {
    ctx.beginPath();
    ctx.moveTo(projected[face[0]].x, projected[face[0]].y);

    for (let i = 1; i < face.length; i++) {
      ctx.lineTo(projected[face[i]].x, projected[face[i]].y);
    }

    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function renderTerrain(terrain) {
  const { x, y, z, size, color } = terrain;
  const projected = project3D(x, y, z);

  if (projected.scale > 0.1) {
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, size * projected.scale, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function renderParticle(particle) {
  const { x, y, z, size, color } = particle;
  const projected = project3D(x, y, z);

  if (projected.scale > 0.05) {
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, size * projected.scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// === INPUT HANDLING ===
function handleKeyDown(e) {
  keys[e.key.toLowerCase()] = true;

  if (e.key === ' ') {
    autoRotate = !autoRotate;
    e.preventDefault();
  }
}

function handleKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function handleResize() {
  canvas.width = Math.min(window.innerWidth, 1440);
  canvas.height = Math.min(window.innerHeight, 900);
}

// === ANIMATION LOOP ===
function animate(timestamp) {
  // Calculate FPS
  frameCount++;
  if (timestamp - lastFrameTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFrameTime = timestamp;
    if (DEBUG) fpsElement.textContent = fps;
  }

  // Update camera
  if (keys['w'] || keys['arrowup']) camera.z -= MOVE_SPEED;
  if (keys['s'] || keys['arrowdown']) camera.z += MOVE_SPEED;
  if (keys['a'] || keys['arrowleft']) camera.x -= MOVE_SPEED;
  if (keys['d'] || keys['arrowright']) camera.x += MOVE_SPEED;

  // Auto-rotate
  if (autoRotate) {
    camera.rotY += ROTATION_SPEED;
  }

  // Update particles
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;

    // Wrap around world
    if (p.x < -1500) p.x = 1500;
    if (p.x > 1500) p.x = -1500;
    if (p.z < -1500) p.z = 1500;
    if (p.z > 1500) p.z = -1500;
  });

  render();
  requestAnimationFrame(animate);
}

// === START ===
init();

