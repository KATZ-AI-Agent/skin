import { EventEmitter } from 'events';
import { quickNodeService } from '../../quicknode/QuickNodeService.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class EnhancedPositionMonitor extends EventEmitter {
  constructor() {
    super();
    this.priceFeeds = new Map();
    this.backupOracles = new Map();
    this.updateBuffer = new Map();
    this.reconnectTimeouts = new Map();
  }

  async setupRedundantPriceFeeds(token) {
    try {
      // Primary WebSocket feed
      const primaryWs = await quickNodeService.subscribeToTokenUpdates(
        token.address,
        (update) => this.handlePriceUpdate(token.address, update)
      );

      // Backup price oracle
      const backupOracle = await quickNodeService.setupPriceOracle(token.address);

      this.priceFeeds.set(token.address, primaryWs);
      this.backupOracles.set(token.address, backupOracle);

      // Setup reconnection handling
      this.setupReconnectHandler(token.address, primaryWs);

    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  setupReconnectHandler(tokenAddress, ws) {
    ws.on('close', () => {
      if (!this.reconnectTimeouts.has(tokenAddress)) {
        const timeout = setTimeout(() => {
          this.setupRedundantPriceFeeds({ address: tokenAddress })
            .catch(error => ErrorHandler.handle(error));
        }, 1000);
        this.reconnectTimeouts.set(tokenAddress, timeout);
      }
    });
  }

  async handlePriceUpdate(tokenAddress, update) {
    try {
      // Buffer updates
      if (!this.updateBuffer.has(tokenAddress)) {
        this.updateBuffer.set(tokenAddress, []);
      }
      this.updateBuffer.get(tokenAddress).push(update);

      // Process buffered updates every 100ms
      setTimeout(() => {
        this.processBufferedUpdates(tokenAddress);
      }, 100);

    } catch (error) {
      await ErrorHandler.handle(error);
    }
  }

  async processBufferedUpdates(tokenAddress) {
    const updates = this.updateBuffer.get(tokenAddress) || [];
    if (updates.length === 0) return;

    // Calculate average price from buffered updates
    const avgPrice = updates.reduce((sum, update) => sum + update.price, 0) / updates.length;

    this.emit('priceUpdate', {
      tokenAddress,
      price: avgPrice,
      updates: updates.length
    });

    // Clear buffer
    this.updateBuffer.set(tokenAddress, []);
  }

  cleanup() {
    // Close all WebSocket connections
    for (const ws of this.priceFeeds.values()) {
      ws.close();
    }
    this.priceFeeds.clear();

    // Clear all timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();

    // Clear all buffers
    this.updateBuffer.clear();
    this.backupOracles.clear();
  }
}