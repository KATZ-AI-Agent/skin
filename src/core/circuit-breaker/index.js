import { CircuitBreaker } from './CircuitBreaker.js';
import { EventEmitter } from 'events';

// Default circuit breaker configurations
export const BREAKER_CONFIGS = {
  // Bot errors - More lenient settings
  botErrors: {
    failureThreshold: 10,
    resetTimeout: 60000,
    halfOpenRetries: 3,
    monitorInterval: 10000,
    maxQueueSize: 500
  },

  // Polling errors - Stricter settings to prevent overload
  polling: {
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenRetries: 3,
    monitorInterval: 30000,
    maxQueueSize: 1000
  },

  // DEXTools API - Handle transient failures
  dextools: {
    failureThreshold: 8,
    resetTimeout: 30000,
    halfOpenRetries: 3,
    monitorInterval: 10000,
    maxQueueSize: 100
  },

  // OpenAI - Critical service handling
  openai: {
    failureThreshold: 7,
    resetTimeout: 20000,
    halfOpenRetries: 3,
    monitorInterval: 10000,
    maxQueueSize: 50
  },

  // PumpFun - Real-time processing
  pumpfun: {
    failureThreshold: 10,
    resetTimeout: 5000,
    halfOpenRetries: 3,
    monitorInterval: 5000,
    maxQueueSize: 200
  }
};

class CircuitBreakerRegistry extends EventEmitter {
  constructor() {
    super();
    this.breakers = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize default breakers
      for (const [service, config] of Object.entries(BREAKER_CONFIGS)) {
        const breaker = new CircuitBreaker(config);
        
        // Set up event listeners
        breaker.on('open', (error) => this.emit('breakerOpen', { service, error }));
        breaker.on('close', () => this.emit('breakerClose', { service }));
        breaker.on('half-open', () => this.emit('breakerHalfOpen', { service }));
        breaker.on('reset', () => this.emit('breakerReset', { service }));
        breaker.on('status', (status) => this.emit('breakerStatus', { service, status }));
        
        this.breakers.set(service, breaker);
      }

      this.initialized = true;
      console.log('✅ Circuit breakers initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing circuit breakers:', error);
      throw error;
    }
  }

  getBreaker(service) {
    if (!this.initialized) {
      throw new Error('Circuit breakers not initialized. Call initialize() first.');
    }

    if (!this.breakers.has(service)) {
      const config = BREAKER_CONFIGS[service] || BREAKER_CONFIGS.botErrors;
      const breaker = new CircuitBreaker(config);
      
      breaker.on('open', (error) => this.emit('breakerOpen', { service, error }));
      breaker.on('close', () => this.emit('breakerClose', { service }));
      breaker.on('reset', () => this.emit('breakerReset', { service }));
      
      this.breakers.set(service, breaker);
    }
    return this.breakers.get(service);
  }

  async executeWithBreaker(service, fn) {
    if (!this.initialized) {
      throw new Error('Circuit breakers not initialized. Call initialize() first.');
    }

    const breaker = this.getBreaker(service);
    return breaker.execute(fn);
  }

  getStatus() {
    if (!this.initialized) {
      throw new Error('Circuit breakers not initialized. Call initialize() first.');
    }

    const status = {};
    for (const [service, breaker] of this.breakers) {
      status[service] = breaker.getState();
    }
    return status;
  }

  reset(service) {
    if (!this.initialized) {
      throw new Error('Circuit breakers not initialized. Call initialize() first.');
    }

    const breaker = this.breakers.get(service);
    if (breaker) {
      breaker.reset();
    }
  }

  cleanup() {
    this.breakers.clear();
    this.removeAllListeners();
    this.initialized = false;
  }
}

// Export singleton instance
export const circuitBreakers = new CircuitBreakerRegistry();