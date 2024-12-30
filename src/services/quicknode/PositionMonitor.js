import { quickNodeService } from './QuickNodeService.js';
import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';
import { positionMonitor } from '../quicknode/PositionMonitor.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';

export class PositionMonitor extends EventEmitter {
  constructor() {
    super();
    this.positions = new Map();
    this.subscriptions = new Map();
  }

  async monitorPosition(position) {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        try {
          // Set up redundant price feeds
          await this.positionMonitor.setupRedundantPriceFeeds(position.token);
  
          // Listen for price updates
          this.positionMonitor.on('priceUpdate', ({ tokenAddress, price, updates }) => {
            this.updatePosition(tokenAddress, price);
          });
  
          // Set position timeout
          setTimeout(() => {
            this.closePosition(position.token.address, 'timeout')
              .catch(error => this.handleError(error, {
                operation: 'closePosition',
                reason: 'timeout',
                position
              }));
          }, this.config.timeLimit);
  
        } catch (error) {
          await this.handleError(error, {
            operation: 'monitorPosition',
            position
          });
        }
      },
      BREAKER_CONFIGS.pumpfun
    );  
  }

  async handleTokenUpdate(tokenAddress, update) {
    try {
      const position = this.positions.get(tokenAddress);
      if (!position) return;

      // Calculate metrics
      const metrics = {
        price: update.price,
        volume: update.volume,
        liquidity: update.liquidity,
        timestamp: new Date()
      };

      this.emit('update', {
        token: tokenAddress,
        metrics
      });
    } catch (error) {
      await ErrorHandler.handle(error);
      this.emit('error', { token: tokenAddress, error });
    }
  }

  async stopMonitoring(tokenAddress) {
    const subscription = this.subscriptions.get(tokenAddress);
    if (subscription) {
      await quickNodeService.unsubscribe(subscription);
      this.subscriptions.delete(tokenAddress);
      this.positions.delete(tokenAddress);
    }
  }

  cleanup() {
    for (const [tokenAddress] of this.subscriptions) {
      this.stopMonitoring(tokenAddress);
    }
    this.removeAllListeners();
  }
}

export const positionMonitor = new PositionMonitor();