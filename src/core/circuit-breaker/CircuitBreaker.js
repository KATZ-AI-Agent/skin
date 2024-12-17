import { EventEmitter } from 'events';

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

export class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenRetries = options.halfOpenRetries || 3;
    this.monitorInterval = options.monitorInterval || 10000;
    this.maxQueueSize = options.maxQueueSize || 100;

    this.state = STATES.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
    this.retryCount = 0;
    this.queue = [];
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastError: null,
      lastSuccess: null
    };

    this.startMonitoring();
  }

  async execute(fn) {
    this.metrics.totalCalls++;

    if (this.state === STATES.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = STATES.HALF_OPEN;
        this.emit('half-open');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Circuit breaker queue is full');
    }

    try {
      const result = await fn();
      this.onSuccess();
      this.metrics.successfulCalls++;
      this.metrics.lastSuccess = new Date();
      return result;
    } catch (error) {
      this.onFailure(error);
      this.metrics.failedCalls++;
      this.metrics.lastError = error;
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.retryCount = 0;
    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.CLOSED;
      this.emit('close');
    }
  }

  onFailure(error) {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === STATES.HALF_OPEN) {
      this.retryCount++;
      if (this.retryCount >= this.halfOpenRetries) {
        this.state = STATES.OPEN;
        this.emit('open', error);
      }
    } else if (this.failures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.emit('open', error);
    }
  }

  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      retryCount: this.retryCount,
      queueSize: this.queue.length,
      metrics: this.metrics
    };
  }

  startMonitoring() {
    setInterval(() => {
      this.emit('status', this.getState());
    }, this.monitorInterval);
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
    this.retryCount = 0;
    this.queue = [];
    this.emit('reset');
  }
}