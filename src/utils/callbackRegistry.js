import { EventEmitter } from 'events';

class CallbackRegistry extends EventEmitter {
  constructor() {
    super();
    this.callbacks = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
      this.emit('initialized');
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  register(id, callback) {
    this.callbacks.set(id, callback);
  }

  unregister(id) {
    this.callbacks.delete(id);
  }

  async execute(id, ...args) {
    const callback = this.callbacks.get(id);
    if (callback) {
      try {
        return await callback(...args);
      } catch (error) {
        this.emit('error', { id, error });
        throw error;
      }
    }
  }

  cleanup() {
    this.callbacks.clear();
    this.removeAllListeners();
    this.initialized = false;
  }
}

export const callbackRegistry = new CallbackRegistry();