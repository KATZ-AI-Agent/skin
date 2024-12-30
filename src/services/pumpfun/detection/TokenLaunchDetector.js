
import PQueue from 'p-queue';
import { EventEmitter } from 'events';
import { quickNodeService } from '../../quicknode/QuickNodeService.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class TokenLaunchDetector extends EventEmitter {
  constructor() {
    super();
    this.primaryWs = null;
    this.backupWs = null;
    this.tokenValidationQueue = new PQueue({ concurrency: 3 });
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async validateToken(token) {
    try {
      // Validate token metadata
      const metadata = await quickNodeService.getTokenMetadata(token.address);
      if (!metadata) return false;

      // Check liquidity requirements
      const liquidity = await quickNodeService.getTokenLiquidity(token.address);
      if (liquidity < 5) return false; // Minimum 5 SOL liquidity

      // Verify token contract
      const contractInfo = await quickNodeService.getAccountInfo(token.address);
      if (!contractInfo?.executable) return false;

      return true;
    } catch (error) {
      await ErrorHandler.handle(error);
      return false;
    }
  }

  async handleTokenUpdate(token) {
    return this.tokenValidationQueue.add(async () => {
      try {
        const isValid = await this.validateToken(token);
        if (isValid) {
          this.emit('validToken', token);
        }
      } catch (error) {
        await ErrorHandler.handle(error);
      }
    });
  }
}

export const tokenLaunchDetector = new TokenLaunchDetector();