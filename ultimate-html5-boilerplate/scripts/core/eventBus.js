export function createEventBus() {
  const listeners = new Map();

  const on = (event, handler) => {
    const handlers = listeners.get(event) ?? new Set();
    handlers.add(handler);
    listeners.set(event, handlers);
    return () => off(event, handler);
  };

  const off = (event, handler) => {
    const handlers = listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      listeners.delete(event);
    }
  };

  const emit = (event, payload) => {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  };

  const clear = () => listeners.clear();

  return { on, off, emit, clear };
}
