import WebSocket from 'ws';
import { EventEmitter } from 'events';

class DexToolsWebSocket extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.messageQueue = new Map(); // Buffer messages for each connection
    this.heartbeatIntervals = new Map();
    this.batchBuffers = new Map(); // Batch messages for each connection
    this.batchInterval = 50; // Batch processing interval in ms

    this.startBatchProcessing(); // Start batch processing
  }

  async subscribeToPriceUpdates(network, tokenAddress) {
    console.log("🔄 Subscribing to price update websockets...");
    const key = `${network}:${tokenAddress}`;
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }

    try {
      const ws = new WebSocket(`wss://ws.dextools.io/${network}/price/${tokenAddress}`);

      ws.on('open', () => {
        console.log(`WebSocket connected for ${key}`);
        this.reconnectAttempts.set(key, 0); // Reset reconnection attempts
        this.messageQueue.set(key, []); // Initialize message queue
        this.batchBuffers.set(key, []); // Initialize batch buffer
        this.startHeartbeat(key, ws); // Start heartbeat
        this.emit('connected', { network, tokenAddress });
      });

      ws.on('message', (data) => {
        try {
          const price = JSON.parse(data.toString());
          this.emit('priceUpdate', { network, tokenAddress, price });
        } catch (error) {
          console.error(`Error parsing price update for ${key}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${key}:`, error);
        this.emit('error', { network, tokenAddress, error });
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for ${key}`);
        this.stopHeartbeat(key); // Stop heartbeat
        this.handleReconnect(network, tokenAddress);
      });

      this.connections.set(key, ws);
      return ws;
    } catch (error) {
      console.error(`Error creating WebSocket for ${key}:`, error);
      throw error;
    }
  }

  async handleReconnect(network, tokenAddress) {
    const key = `${network}:${tokenAddress}`;
    const attempts = this.reconnectAttempts.get(key) || 0;

    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(key, attempts + 1);
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);

      console.log(`Reconnecting ${key} in ${delay}ms... (attempt ${attempts + 1})`);

      setTimeout(() => {
        this.subscribeToPriceUpdates(network, tokenAddress)
          .catch((error) => {
            console.error(`Reconnection failed for ${key}:`, error);
          });
      }, delay);
    } else {
      console.error(`Max reconnection attempts reached for ${key}`);
      this.cleanupConnection(key);
      this.emit('maxRetriesReached', { network, tokenAddress });
    }
  }

  startHeartbeat(key, ws) {
    if (this.heartbeatIntervals.has(key)) {
      clearInterval(this.heartbeatIntervals.get(key));
    }

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        const timeout = setTimeout(() => {
          console.error(`No pong received for ${key}. Terminating connection.`);
          ws.terminate();
        }, 30000); // 5-second timeout for pong

        ws.once('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'pong') {
              clearTimeout(timeout); // Reset timeout on pong
            }
          } catch {
            // Ignore non-pong messages
          }
        });
      }
    }, 60000); // Send ping every 60 seconds

    this.heartbeatIntervals.set(key, interval);
  }

  stopHeartbeat(key) {
    const interval = this.heartbeatIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(key);
    }
  }

  startBatchProcessing() {
    setInterval(() => {
      for (const [key, buffer] of this.batchBuffers) {
        const ws = this.connections.get(key);
        if (ws && ws.readyState === WebSocket.OPEN && buffer.length > 0) {
          const batchedMessage = { type: 'batch', data: [...buffer] };
          ws.send(JSON.stringify(batchedMessage));
          this.batchBuffers.set(key, []); // Clear batch buffer
        }
      }
    }, this.batchInterval);
  }

  sendMessage(network, tokenAddress, message, batch = false) {
    const key = `${network}:${tokenAddress}`;
    const ws = this.connections.get(key);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!this.messageQueue.has(key)) {
        this.messageQueue.set(key, []);
      }
      this.messageQueue.get(key).push(message); // Buffer message if WebSocket is not ready
      return;
    }

    if (batch) {
      if (!this.batchBuffers.has(key)) {
        this.batchBuffers.set(key, []);
      }
      this.batchBuffers.get(key).push(message); // Add to batch buffer
    } else {
      ws.send(JSON.stringify(message)); // Send directly
    }
  }

  flushQueue(key) {
    const ws = this.connections.get(key);
    if (ws && ws.readyState === WebSocket.OPEN && this.messageQueue.has(key)) {
      const queue = this.messageQueue.get(key);
      while (queue.length > 0) {
        ws.send(JSON.stringify(queue.shift()));
      }
    }
  }

  cleanupConnection(key) {
    const ws = this.connections.get(key);
    if (ws) {
      ws.terminate(); // Close WebSocket immediately
    }
    this.stopHeartbeat(key);
    this.connections.delete(key);
    this.reconnectAttempts.delete(key);
    this.messageQueue.delete(key);
    this.batchBuffers.delete(key);
  }

  unsubscribe(network, tokenAddress) {
    const key = `${network}:${tokenAddress}`;
    this.cleanupConnection(key);
  }

  cleanup() {
    for (const key of this.connections.keys()) {
      this.cleanupConnection(key);
    }
    this.removeAllListeners();
    console.log('DexToolsWebSocket cleaned up.');
  }
}

export const dexToolsWebSocket = new DexToolsWebSocket();

// Handle cleanup on process termination
process.on('SIGINT', () => {
  dexToolsWebSocket.cleanup();
});

process.on('SIGTERM', () => {
  dexToolsWebSocket.cleanup();
});
