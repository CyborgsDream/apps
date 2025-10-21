export function createState(initialState = {}) {
  let value = Object.freeze({ ...initialState });
  const subscribers = new Set();

  const get = () => value;

  const notify = () => {
    for (const callback of subscribers) {
      callback(value);
    }
  };

  const update = (updater) => {
    value = Object.freeze({ ...updater(value) });
    notify();
    return value;
  };

  const replace = (nextValue) => {
    value = Object.freeze({ ...nextValue });
    notify();
    return value;
  };

  const subscribe = (callback) => {
    subscribers.add(callback);
    callback(value);
    return () => subscribers.delete(callback);
  };

  return { get, update, replace, subscribe };
}
