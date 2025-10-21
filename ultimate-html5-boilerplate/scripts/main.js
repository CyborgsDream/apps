import { createLogger } from './core/logger.js';
import { createState } from './core/state.js';
import { createEventBus } from './core/eventBus.js';
import { createGameLoop } from './systems/gameLoop.js';
import { createSceneManager } from './modules/sceneManager.js';

const meta = Object.freeze({
  name: 'Ultimate HTML5 Boilerplate',
  version: '0.0.1',
  codename: 'Aurora',
});

const logger = createLogger(meta);
const eventBus = createEventBus();
const state = createState({
  status: 'booting',
  lastFrameTime: performance.now(),
  playing: true,
});

function bindMetadata() {
  document.querySelector('[data-bind="version"]').textContent = meta.version;
  document.querySelector('[data-bind="codename"]').textContent = meta.codename;
  document.querySelector('[data-bind="year"]').textContent = new Date().getFullYear();
}

function bindControls(loop) {
  const statusEl = document.querySelector('[data-bind="status"]');
  eventBus.on('status:changed', (value) => {
    statusEl.textContent = value;
  });

  document.querySelector('[data-action="toggle-loop"]').addEventListener('click', () => {
    const playing = state.update((current) => ({ ...current, playing: !current.playing })).playing;
    eventBus.emit('loop:toggle', playing);
    statusEl.textContent = playing ? 'Loop running' : 'Loop paused';
  });

  document.querySelector('[data-action="reset-state"]').addEventListener('click', () => {
    state.replace({ status: 'reset', lastFrameTime: performance.now(), playing: true });
    loop.reset();
    statusEl.textContent = 'State reset';
    logger.info('State reset triggered');
  });
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      logger.info('Service worker registered', { scope: registration.scope });
    } catch (error) {
      logger.warn('Service worker registration failed', error);
    }
  } else {
    logger.warn('Service workers not supported in this browser');
  }
}

function bootstrap() {
  bindMetadata();
  const canvas = document.getElementById('primary-canvas');
  const context = canvas.getContext('2d');

  const sceneManager = createSceneManager({ canvas, context, eventBus, state, logger });
  const loop = createGameLoop({
    update: (dt) => {
      sceneManager.update(dt);
    },
    render: (dt) => {
      sceneManager.render(dt);
    },
    logger,
    eventBus,
    state,
  });

  bindControls(loop);
  registerServiceWorker();
  loop.start();

  state.update((current) => ({ ...current, status: 'running' }));
  eventBus.emit('status:changed', 'Loop running');
  logger.info('Bootstrap complete');
}

document.addEventListener('DOMContentLoaded', bootstrap);
