import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';
import { dextools } from '../../services/dextools/index.js';
import { timedOrderService } from '../../services/timedOrders.js';
import { priceAlertService } from '../../services/priceAlerts.js';
import { networkState } from '../../services/networkState.js';
import { db } from '../database.js';
import WebSocket from 'ws';

class MonitoringSystem extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      orders: new Map(),
      alerts: new Map(),
      websockets: new Map(),
      errors: new Map(),
      performance: new Map(),
    };
    this.healthChecks = new Map();
    this.initialized = false;

    // WebSocket-specific properties
    this.webSocketEndpoints = [
      'wss://api.dextools.io/ws',
      'wss://api.dextools.io/ws',
    ];
    this.currentEndpoint = 0;
    this.ws = null;
    this.reconnectInterval = 10000; // Initial reconnect interval
    this.maxReconnectInterval = 30000; // Max reconnect interval
    this.maxReconnectAttempts = 10; // Max reconnect attempts
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.messageQueue = []; // Buffer for WebSocket messages
    this.batchBuffer = []; // Batch buffer for messages
    this.batchInterval = 50; // Batch processing interval in ms

    this.startBatchProcessing(); // Start batch message processing
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Set up health checks
      //this.setupHealthChecks();

      // Start monitoring loops
      this.startMetricsCollection();
      this.startHealthMonitoring();
      //this.startPerformanceMonitoring();

      // Establish WebSocket connection
      await this.connectWebSocket();

      // Proper logging and decoding websocket data
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data); // Parse JSON message
          console.log('Received WebSocket message:', JSON.stringify(message, null, 2)); // Log readable JSON
          this.handleMessage(message); // Call the handler
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });           

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Error initializing monitoring system:', error);
      await ErrorHandler.handle(error);
      this.emit('error', error);
    }
  }

  setupHealthChecks() {
    // Health check for the database
    this.healthChecks.set('database', async () => {
      const dbStatus = await db.isHealthy();
      return dbStatus
        ? { status: 'healthy' }
        : { status: 'unhealthy', message: 'Database connection issue' };
    });

    // Health check for WebSocket connections
    this.healthChecks.set('websockets', async () => {
      const healthy = await this.checkWebSocketConnections();
      return healthy
        ? { status: 'healthy' }
        : { status: 'unhealthy', message: 'WebSocket connection issue' };
    });

    // Health check for timed orders
    this.healthChecks.set('timedOrders', async () => {
      const orderMetrics = await timedOrderService.getMetrics();
      return orderMetrics
        ? { status: 'healthy' }
        : { status: 'unhealthy', message: 'Timed orders service issue' };
    });

    // Health check for price alerts
    this.healthChecks.set('priceAlerts', async () => {
      const alertMetrics = await priceAlertService.getMetrics();
      return alertMetrics
        ? { status: 'healthy' }
        : { status: 'unhealthy', message: 'Price alerts service issue' };
    });

    // Health check for dextools integration
    this.healthChecks.set('dextools', async () => {
      try {
        const trendingTokens = await dextools.fetchTrendingTokens('ethereum');
        return trendingTokens
          ? { status: 'healthy' }
          : { status: 'unhealthy', message: 'DexTools API issue' };
      } catch (error) {
        return { status: 'unhealthy', message: `DexTools API error: ${error.message}` };
      }
    });

    console.log('Health checks initialized.');
  }

  async checkHealth() {
    const results = {};
    for (const [key, check] of this.healthChecks.entries()) {
      try {
        results[key] = await check();
      } catch (error) {
        results[key] = { status: 'unhealthy', message: error.message || 'Error running health check' };
      }
    }
    return results;
  }

  // WebSocket Management
  async connectWebSocket() {
    const endpoint = this.switchEndpoint();
    console.log(`🔄 Attempting to connect to WebSocket: ${endpoint}`);
    
    this.ws = new WebSocket(endpoint);
  
    this.ws.on('open', () => {
      this.reconnectAttempts = 0; // Reset attempts on success
      console.log(`✅ WebSocket connected to ${endpoint}.`);
      this.emit('webSocketConnected');
      this.flushQueue();
      this.startHeartbeat();
    });
  
    this.ws.on('close', () => {
      console.warn(`🔌 WebSocket disconnected from ${endpoint}.`);
      this.emit('webSocketDisconnected');
      this.stopHeartbeat();
  
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = calculateReconnectInterval(); // Use adaptive interval
        console.log(`Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => this.connectWebSocket(), delay);
      } else {
        console.error('Max reconnect attempts reached. Giving up.');
      }
    });

    this.ws.on('unexpected-response', (req, res) => {
      console.error(`❌ WebSocket unexpected response on ${endpoint}:`, {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
      });
    });
  
    this.ws.on('error', (error) => {
      console.error(`❌ WebSocket error on endpoint ${endpoint}:`, error);
      this.emit('error', error);
      this.ws.close(); // Trigger reconnect logic
    });
  }
  
  // Exponential backoff combined with Jitter for an adaptive and distributed reconnect strategy
  calculateReconnectInterval() {
    const base = Math.min(baseInterval * 2 ** reconnectAttempts, maxInterval);
    const jitter = Math.random() * base * 0.5; // Add jitter (50% of base)
    return base + jitter;
  }

  switchEndpoint() {
    this.currentEndpoint = (this.currentEndpoint + 1) % this.webSocketEndpoints.length;
    return this.webSocketEndpoints[this.currentEndpoint];
  }

  startHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.heartbeatTimeout = setTimeout(() => {
          console.error('No pong received. Closing connection.');
          this.ws.terminate();
        }, 5000); // 5-second timeout for pong
      }
    }, 30000); // Ping every 30 seconds
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    clearTimeout(this.heartbeatTimeout);
  }

  startBatchProcessing() {
    setInterval(() => {
      if (this.batchBuffer.length > 0 && this.ws.readyState === WebSocket.OPEN) {
        const batchedMessage = { type: 'batch', data: [...this.batchBuffer] };
        this.ws.send(JSON.stringify(batchedMessage));
        this.batchBuffer = [];
      }
    }, this.batchInterval);
  }

  sendWebSocketMessage(message, batch = false) {
    if (batch) {
      this.batchBuffer.push(message);
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0 && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    if (!message.type) {
      console.warn('Received message with undefined type:', JSON.stringify(message, null, 2));
      return;
    }
  
    switch (message.type) {
      case 'pong':
        clearTimeout(this.heartbeatTimeout);
        console.log('Pong received, heartbeat alive.');
        break;
      case 'update':
        console.log('Update message:', message.data);
        break;
      // Add more cases for expected types
      default:
        console.warn('Unhandled message type:', message.type, JSON.stringify(message, null, 2));
    }
  }  

  async checkWebSocketConnections() {
    let healthy = true;
    if (this.ws.readyState !== WebSocket.OPEN) {
      healthy = false;
      this.emit('websocketError', {
        connection: this.webSocketEndpoints[this.currentEndpoint],
        state: this.ws.readyState,
      });
    }
    return healthy;
  }

  // Metrics Collection
  startMetricsCollection() {
    setInterval(async () => {
      try {
        const orders = await timedOrderService.getMetrics();
        console.log('Timed Orders Metrics:', JSON.stringify(orders, null, 2));
        this.metrics.orders = orders;
  
        const alerts = await priceAlertService.getMetrics();
        console.log('Price Alerts Metrics:', JSON.stringify(alerts, null, 2));
        this.metrics.alerts = alerts;
  
        this.emit('metricsCollected', this.metrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
        this.emit('error', error);
      }
    }, 180000); // Every 3 minutea
  }  

  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const health = await this.checkHealth();
        this.emit('healthCheck', health);

        const criticalServices = ['database', 'websockets'];
        const criticalIssues = criticalServices.filter((service) => health[service]?.status === 'error');

        if (criticalIssues.length > 0) {
          this.emit('criticalError', {
            services: criticalIssues,
            health,
          });
        }
      } catch (error) {
        console.error('Error in health monitoring:', error);
        this.emit('error', error);
      }
    }, 300000); // Every 5mins
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      try {
        const metrics = {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime(),
          websocketLatency: this.calculateWebSocketLatency(),
          orderExecutionTimes: this.calculateOrderExecutionTimes(),
          alertProcessingTimes: this.calculateAlertProcessingTimes(),
        };

        this.metrics.performance = metrics;
        this.emit('performanceMetrics', metrics);

        this.checkPerformanceThresholds(metrics);
      } catch (error) {
        console.error('❌ Error in performance monitoring:', error);
        this.emit('error', error);
      }
    }, 300000); // Every 5 minutes
  }

  calculateWebSocketLatency() {
    const latencies = new Map();
    for (const [key, ws] of this.metrics.websockets) {
      latencies.set(key, ws.latency || 0); // Fallback to 0 if latency undefined
    }
    return latencies;
  }

  calculateOrderExecutionTimes() {
    return {
      average: this.metrics.orders.get('averageExecutionTime') || 0,
      max: this.metrics.orders.get('maxExecutionTime') || 0,
      min: this.metrics.orders.get('minExecutionTime') || 0,
    };
  }

  calculateAlertProcessingTimes() {
    return {
      average: this.metrics.alerts.get('averageProcessingTime') || 0,
      max: this.metrics.alerts.get('maxProcessingTime') || 0,
      min: this.metrics.alerts.get('minProcessingTime') || 0,
    };
  }

  checkPerformanceThresholds(metrics) {
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      this.emit('performanceWarning', {
        type: 'memory',
        value: memoryUsagePercent,
        threshold: 80,
      });
    }

    for (const [key, latency] of metrics.websocketLatency) {
      if (latency > 1000) {
        this.emit('performanceWarning', {
          type: 'websocket',
          connection: key,
          latency,
          threshold: 1000,
        });
      }
    }

    if (metrics.orderExecutionTimes.average > 30000) {
      this.emit('performanceWarning', {
        type: 'orderExecution',
        value: metrics.orderExecutionTimes.average,
        threshold: 30000,
      });
    }
  }

  cleanup() {
    if (this.ws) {
      this.ws.terminate();
    }
    this.stopHeartbeat();
    this.messageQueue = [];
    this.batchBuffer = [];
    this.healthChecks.clear();
    this.metrics = {
      orders: new Map(),
      alerts: new Map(),
      websockets: new Map(),
      errors: new Map(),
      performance: new Map(),
    };
    this.removeAllListeners();
    console.log('Monitoring system cleaned up.');
  }
}

export const monitoringSystem = new MonitoringSystem();

process.on('SIGINT', () => monitoringSystem.cleanup());
process.on('SIGTERM', () => monitoringSystem.cleanup());
