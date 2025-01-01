import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';
import { circuitBreakers, BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { quickNodeService } from './QuickNodeService.js';

export class PositionMonitor extends EventEmitter {
  constructor() {
    super();
    this.positions = new Map();
    this.subscriptions = new Map();
    this.priceFeeds = new Map();
    this.updateBuffer = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  async monitorPosition(position) {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        try {
          // Set up redundant price feeds with retry logic
          await this.setupRedundantPriceFeeds(position.token);

          // Set up position timeout with grace period
          const timeoutId = setTimeout(() => {
            this.emit('positionTimeout', position.token.address);
          }, position.timeLimit + 5000); // 5s grace period

          // Store monitoring state
          this.positions.set(position.token.address, {
            ...position,
            timeoutId,
            monitoringStarted: Date.now()
          });

          return true;
        } catch (error) {
          await this.handleMonitoringError(error, position);
          throw error;
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }

  async setupRedundantPriceFeeds(token) {
    try {
      // Primary feed
      const primaryFeed = await quickNodeService.subscribeToTokenUpdates(
        token.address,
        (update) => this.handlePriceUpdate(token.address, update)
      );

      // Backup oracle
      const backupOracle = await quickNodeService.setupPriceOracle(token.address);

      this.priceFeeds.set(token.address, {
        primary: primaryFeed,
        backup: backupOracle
      });

      // Reset reconnect attempts on success
      this.reconnectAttempts.delete(token.address);

    } catch (error) {
      await this.handleFeedSetupError(error, token);
    }
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
      this.emit('error', { tokenAddress, error });
    }
  }

  async processBufferedUpdates(tokenAddress) {
    const updates = this.updateBuffer.get(tokenAddress) || [];
    if (updates.length === 0) return;

    try {
      // Calculate average price from buffered updates
      const avgPrice = updates.reduce((sum, update) => sum + update.price, 0) / updates.length;

      // Verify with backup oracle
      const feeds = this.priceFeeds.get(tokenAddress);
      if (feeds?.backup) {
        const backupPrice = await feeds.backup.getPrice();
        const priceDiff = Math.abs(avgPrice - backupPrice) / avgPrice;

        // If prices differ by more than 1%, use backup price
        if (priceDiff > 0.01) {
          this.emit('priceMismatch', {
            tokenAddress,
            avgPrice,
            backupPrice,
            difference: priceDiff
          });
          this.emit('priceUpdate', {
            tokenAddress,
            price: backupPrice,
            source: 'backup'
          });
          return;
        }
      }

      this.emit('priceUpdate', {
        tokenAddress,
        price: avgPrice,
        updates: updates.length,
        source: 'primary'
      });

    } catch (error) {
      await ErrorHandler.handle(error);
      this.emit('error', { tokenAddress, error });
    } finally {
      // Clear buffer
      this.updateBuffer.set(tokenAddress, []);
    }
  }

  async handleMonitoringError(error, position) {
    const attempts = this.reconnectAttempts.get(position.token.address) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(position.token.address, attempts + 1);
      const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), 30000);
      
      setTimeout(() => {
        this.setupRedundantPriceFeeds(position.token)
          .catch(error => this.emit('error', { 
            tokenAddress: position.token.address, 
            error 
          }));
      }, delay);
    } else {
      this.emit('maxRetriesReached', position.token.address);
    }
  }

  async handleFeedSetupError(error, token) {
    await ErrorHandler.handle(error);
    this.emit('feedSetupError', {
      tokenAddress: token.address,
      error: error.message
    });
  }

  stopMonitoring(tokenAddress) {
    // Clear timeout
    const position = this.positions.get(tokenAddress);
    if (position?.timeoutId) {
      clearTimeout(position.timeoutId);
    }

    // Clear feeds
    const feeds = this.priceFeeds.get(tokenAddress);
    if (feeds) {
      feeds.primary?.unsubscribe?.();
      feeds.backup?.close?.();
    }

    // Clear data
    this.positions.delete(tokenAddress);
    this.priceFeeds.delete(tokenAddress);
    this.updateBuffer.delete(tokenAddress);
    this.reconnectAttempts.delete(tokenAddress);
  }

  cleanup() {
    // Clear all timeouts and subscriptions
    for (const [tokenAddress] of this.positions) {
      this.stopMonitoring(tokenAddress);
    }

    // Clear all maps
    this.positions.clear();
    this.subscriptions.clear();
    this.priceFeeds.clear();
    this.updateBuffer.clear();
    this.reconnectAttempts.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}