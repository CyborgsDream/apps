export function createGameLoop({ update, render, logger, eventBus, state }) {
  let rafId = null;
  let lastTime = performance.now();

  const tick = (time) => {
    const { playing } = state.get();
    if (!playing) return;

    const delta = (time - lastTime) / 1000;
    lastTime = time;

    try {
      update(delta);
      render(delta);
    } catch (error) {
      logger.error('Loop iteration failed', error);
      eventBus.emit('loop:error', error);
      stop();
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  const start = () => {
    if (rafId !== null) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
    eventBus.emit('loop:start');
    logger.info('Loop started');
  };

  const stop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
    eventBus.emit('loop:stop');
    logger.info('Loop stopped');
  };

  const reset = () => {
    stop();
    state.update((current) => ({ ...current, playing: true, lastFrameTime: performance.now() }));
    start();
    logger.info('Loop reset');
  };

  eventBus.on('loop:toggle', (playing) => {
    if (playing) {
      start();
    } else {
      stop();
    }
  });

  return { start, stop, reset };
}
