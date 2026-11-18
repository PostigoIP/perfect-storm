import { describe, it, expect, vi } from 'vitest';
import { createBus } from '../src/bus.js';

describe('createBus', () => {
  it('delivers a payload to every listener of that type once', () => {
    const bus = createBus();
    const a = vi.fn(), b = vi.fn(), other = vi.fn();
    bus.on('case', a); bus.on('case', b); bus.on('thunder', other);
    bus.emit('case', { id: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith({ id: 1 });
    expect(b).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
  it('on() returns an unsubscribe function', () => {
    const bus = createBus();
    const a = vi.fn();
    const off = bus.on('case', a);
    off();
    bus.emit('case', 1);
    expect(a).not.toHaveBeenCalled();
  });
  it('a throwing listener does not stop the others', () => {
    const bus = createBus();
    const b = vi.fn();
    bus.on('case', () => { throw new Error('x'); });
    bus.on('case', b);
    expect(() => bus.emit('case', 1)).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
