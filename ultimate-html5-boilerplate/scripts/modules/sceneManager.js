const CLEAR_COLOR = '#05060a';

export function createSceneManager({ canvas, context, eventBus, state, logger }) {
  const scenes = new Map();
  let activeScene = null;

  const defaultScene = {
    name: 'default',
    update(dt) {
      eventBus.emit('scene:update', { name: this.name, dt });
    },
    render() {
      context.fillStyle = CLEAR_COLOR;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#2f8af5';
      context.font = '24px "Inter", system-ui';
      context.textAlign = 'center';
      context.fillText('Ultimate HTML5 Boilerplate', canvas.width / 2, canvas.height / 2 - 20);
      context.font = '16px "Inter", system-ui';
      context.fillText('Ready for rich web apps and games', canvas.width / 2, canvas.height / 2 + 12);
      eventBus.emit('scene:render', { name: this.name });
    },
  };

  const register = (scene) => {
    scenes.set(scene.name, scene);
    logger.info('Scene registered', { scene: scene.name });
  };

  const use = (sceneName) => {
    if (!scenes.has(sceneName)) {
      logger.warn('Attempted to switch to unknown scene', { sceneName });
      return;
    }
    activeScene = scenes.get(sceneName);
    state.update((current) => ({ ...current, activeScene: sceneName }));
    logger.info('Scene activated', { scene: sceneName });
  };

  const update = (dt) => {
    if (!activeScene) return;
    activeScene.update?.(dt);
  };

  const render = (dt) => {
    if (!activeScene) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    activeScene.render?.(dt);
  };

  register(defaultScene);
  use(defaultScene.name);

  return { register, use, update, render };
}
