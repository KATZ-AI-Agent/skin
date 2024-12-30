import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';
import { quickNodeService } from '../quicknode/QuickNodeService.js';

export class ErrorRecoverySystem extends EventEmitter {
  constructor() {
    super();
    this.recoveryStrategies = new Map();
    this.setupDefaultStrategies();
  }

  setupDefaultStrategies() {
    // WebSocket disconnection recovery
    this.recoveryStrategies.set('WEBSOCKET_DISCONNECT', async (context) => {
      const { ws, endpoint } = context;
      await this.reconnectWebSocket(ws, endpoint);
    });

    // Transaction failure recovery
    this.recoveryStrategies.set('TRANSACTION_FAILED', async (context) => {
      const { tx, error } = context;
      await this.retryTransaction(tx, error);
    });

    // RPC node failure recovery
    this.recoveryStrategies.set('RPC_FAILURE', async (context) => {
      const { operation } = context;
      await this.switchRpcNode(operation);
    });
  }

  async handleError(error, context) {
    try {
      const errorType = this.classifyError(error);
      const strategy = this.recoveryStrategies.get(errorType);

      if (strategy) {
        console.log(`Attempting recovery for ${errorType}`);
        await strategy(context);
        this.emit('recovered', { type: errorType, context });
      } else {
        await ErrorHandler.handle(error);
        this.emit('unrecoverable', { error, context });
      }
    } catch (recoveryError) {
      await ErrorHandler.handle(recoveryError);
      this.emit('recoveryFailed', { error: recoveryError, context });
    }
  }

  classifyError(error) {
    if (error.message?.includes('WebSocket')) return 'WEBSOCKET_DISCONNECT';
    if (error.message?.includes('transaction')) return 'TRANSACTION_FAILED';
    if (error.message?.includes('RPC')) return 'RPC_FAILURE';
    return 'UNKNOWN';
  }

  async reconnectWebSocket(ws, endpoint) {
    try {
      ws.terminate();
      const newWs = await quickNodeService.createWebSocketConnection(endpoint);
      return newWs;
    } catch (error) {
      throw new Error(`WebSocket reconnection failed: ${error.message}`);
    }
  }

  async retryTransaction(tx, error) {
    try {
      // Prepare new transaction with updated parameters
      const updatedTx = await quickNodeService.prepareSmartTransaction({
        ...tx,
        priorityFee: await quickNodeService.fetchEstimatePriorityFees(),
        options: { maxRetries: 3 }
      });

      // Send transaction
      return await quickNodeService.sendSmartTransaction(updatedTx);
    } catch (retryError) {
      throw new Error(`Transaction retry failed: ${retryError.message}`);
    }
  }

  async switchRpcNode(operation) {
    try {
      await quickNodeService.switchToBackupNode();
      return await operation();
    } catch (error) {
      throw new Error(`RPC node switch failed: ${error.message}`);
    }
  }
}

export const errorRecoverySystem = new ErrorRecoverySystem();