const LEVELS = ['debug', 'info', 'warn', 'error'];

export function createLogger(meta) {
  const formatPayload = (level, message, data) => ({
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
    project: meta.name,
    version: meta.version,
    codename: meta.codename,
  });

  const write = (level, message, data) => {
    const payload = formatPayload(level, message, data);
    console[level === 'debug' ? 'log' : level](payload);
  };

  return LEVELS.reduce((api, level) => {
    api[level] = (message, data) => write(level, message, data);
    return api;
  }, {});
}
