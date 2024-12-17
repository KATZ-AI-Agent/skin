import { CircuitBreaker } from './CircuitBreaker.js';
import { healthMonitor } from '../health/HealthMonitor.js';

class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
    this.isHealthMonitoringSetup = false; // Track health monitoring initialization
  }

  getBreaker(service, options = {}) {
    if (!this.breakers.has(service)) {
      const breaker = new CircuitBreaker(options);
      this.setupBreakerEvents(service, breaker);
      this.breakers.set(service, breaker);
    }
    return this.breakers.get(service);
  }

  setupBreakerEvents(service, breaker) {
    breaker.on('open', (error) => {
      console.error(`Circuit breaker OPEN for ${service}:`, error);
      healthMonitor.emit('serviceError', {
        service,
        error,
        type: 'CIRCUIT_BREAKER_OPEN',
      });
    });

    breaker.on('close', () => {
      console.log(`Circuit breaker CLOSED for ${service}`);
      healthMonitor.emit('serviceRecovered', {
        service,
        type: 'CIRCUIT_BREAKER_CLOSED',
      });
    });
  }

  setupHealthMonitoring() {
    if (this.isHealthMonitoringSetup) return; // Avoid duplicate setup

    healthMonitor.addCheck('circuitBreakers', async () => {
      const status = {};
      for (const [service, breaker] of this.breakers) {
        status[service] = breaker.getState();
      }
      return { status: 'healthy', details: status };
    });

    this.isHealthMonitoringSetup = true; // Mark as setup
    console.log('Health monitoring for circuit breakers initialized');
  }

  async executeWithBreaker(service, fn, options = {}) {
    const breaker = this.getBreaker(service, options);
    return breaker.execute(fn);
  }

  resetBreaker(service) {
    const breaker = this.breakers.get(service);
    if (breaker) {
      breaker.reset();
    }
  }

  getStatus() {
    const status = {};
    for (const [service, breaker] of this.breakers) {
      status[service] = breaker.getState();
    }
    return status;
  }

  cleanup() {
    this.breakers.clear();
  }
}

// Export a singleton instance
export const circuitBreakers = new CircuitBreakerRegistry();
