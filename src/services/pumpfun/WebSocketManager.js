import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ErrorHandler } from '../../core/errors/index.js';

export class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  async createConnection(endpoint, options = {}) {
    const key = `${endpoint}:${JSON.stringify(options)}`;
    
    try {
      if (this.connections.has(key)) {
        return this.connections.get(key);
      }

      const ws = new WebSocket(endpoint, options);
      
      ws.on('open', () => {
        console.log(`WebSocket connected to ${endpoint}`);
        this.reconnectAttempts.set(key, 0);
        this.emit('connected', { endpoint });
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for ${endpoint}`);
        this.handleReconnect(endpoint, options);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${endpoint}:`, error);
        this.emit('error', { endpoint, error });
      });

      this.connections.set(key, ws);
      return ws;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async handleReconnect(endpoint, options) {
    const key = `${endpoint}:${JSON.stringify(options)}`;
    const attempts = this.reconnectAttempts.get(key) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      this.emit('maxRetriesReached', { endpoint });
      return;
    }

    this.reconnectAttempts.set(key, attempts + 1);
    const delay = this.reconnectDelay * Math.pow(2, attempts);

    setTimeout(() => {
      this.createConnection(endpoint, options)
        .catch(error => this.emit('error', { endpoint, error }));
    }, delay);
  }

  closeConnection(endpoint, options = {}) {
    const key = `${endpoint}:${JSON.stringify(options)}`;
    const ws = this.connections.get(key);
    
    if (ws) {
      ws.close();
      this.connections.delete(key);
      this.reconnectAttempts.delete(key);
    }
  }

  cleanup() {
    for (const [key, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
    this.reconnectAttempts.clear();
    this.removeAllListeners();
  }
}

export const wsManager = new WebSocketManager();