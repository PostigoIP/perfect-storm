// One event stream for the whole app: 'case', 'thunder', 'tick', 'reset'.
export function createBus() {
  const listeners = new Map();
  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    emit(type, payload) {
      for (const fn of listeners.get(type) ?? []) {
        try { fn(payload); } catch (err) { console.error(`[bus:${type}]`, err); }
      }
    },
  };
}
