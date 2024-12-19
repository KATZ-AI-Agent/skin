import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';
import { ErrorHandler } from '../../core/errors/index.js';
import { config } from '../../core/config.js';

class PumpFunService extends EventEmitter {
  constructor(networkConfig) {
    super();

    // WebSocket and API configurations
    this.websocketEndpoint = 'wss://pumpportal.fun/api/data';
    this.apiEndpoint = 'https://pumpportal.fun/api/trade-local';

    this.ws = null; // WebSocket instance
    this.connection = new Connection(networkConfig.rpcUrl, 'confirmed'); // Solana connection
    this.apiKey = config.pumpFunApiKey; // API Key for authenticated requests

    this.subscribers = new Map(); // Manage event subscriptions
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.messageQueue = []; // Queue for messages to be sent when WebSocket is ready
    this.isInitialized = false;

    this.maxReconnectAttempts = 10;
    this.startBatchProcessing();
  }

  /**
   * Establish WebSocket connection
   */
  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      console.log(`🌐 Connecting to PumpPortal WebSocket: ${this.websocketEndpoint}`);
      this.ws = new WebSocket(this.websocketEndpoint);

      // Bind WebSocket event handlers
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));
    } catch (error) {
      console.error('❌ Pumpfun WebSocket connection error:', error);
      await ErrorHandler.handle(error);
      this.handleReconnect();
    }
  }

  handleOpen() {
    console.log(`✅ Pumpfun WebSocket connected to ${this.websocketEndpoint}`);
    this.reconnectAttempts = 0;
    this.isInitialized = true;
    this.flushQueue(); // Flush queued messages
    this.startHeartbeat(); // Start WebSocket heartbeat
    this.emit('connected');
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('📩 Pumpfun WebSocket message received:', JSON.stringify(message, null, 2));
  
      // Check if the message contains `txType` and process accordingly
      if (message.txType) {
        switch (message.txType) {
          case 'create':
            this.handleCreateMessage(message);
            break;
          // You can add more cases for other `txType` values as needed
          default:
            console.log(`ℹ️ Unhandled Pumpfun txType: "${message.txType}"`);
        }
      } else {
        console.warn('⚠️ Missing txType in Pumpfun New Token message. Ignoring message:', message);
      }
    } catch (error) {
      console.error('❌ Error processing Pumpfun WebSocket message:', error);
    }
  }

  handleCreateMessage(message) {
    try {
      console.log('🎉 Handling subscribeNewToken message:', message);
  
      // Based on current Pumpfun output - Extract important details from the "create" message
      const {
        signature,
        mint,
        traderPublicKey,
        initialBuy,
        marketCapSol,
        name,
        symbol,
        uri,
      } = message;
  
      this.emit('newTokenCreated', {
        signature,
        mint,
        traderPublicKey,
        initialBuy,
        marketCapSol,
        name,
        symbol,
        uri,
      });
  
      console.log('✅ Successfully processed Pumpfun subscribeNewToken message.');
    } catch (error) {
      console.error('❌ Error handling Pumpfun subscribeNewToken message:', error);
    }
  }

  handleClose() {
    console.warn(`🔌 Pumpfun WebSocket connection closed.`);
    this.isInitialized = false;
    this.stopHeartbeat();
    this.handleReconnect();
  }

  handleError(error) {
    console.error('❌ Pumpfun WebSocket error:', error);
    this.emit('error', error);
    this.handleReconnect();
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Pumpfun Max reconnect attempts reached. Giving up.');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000); // Exponential backoff
    console.warn(`🔄 Pumpfun Reconnecting in ${delay / 1000}s...`);
    setTimeout(() => this.connect(), delay);
  }

  startHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('⚠️ Pumpfun No pong received. Terminating connection...');
          // Disble terminate keeps cutting connection on every ping
          //this.ws.terminate();
          this.handleReconnect();
        }, 5000);
      }
    }, 600000); // Ping every 6 hour
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    clearTimeout(this.heartbeatTimeout);
  }

  startBatchProcessing() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
        const message = this.messageQueue.shift();
        this.ws.send(JSON.stringify(message));
      }
    }, 50); // Send queued messages every 50ms
  }

  /**
   * Subscribe to WebSocket streams
   * @param {string} method Subscription method (e.g., subscribeNewToken)
   * @param {array} keys Keys for subscription (accounts or tokens)
   * @param {function} callback Callback for received data
   */
  subscribe(method, keys = [], callback) {
    const payload = { method, keys };
    this.send(payload);
    if (!this.subscribers.has(method)) {
      this.subscribers.set(method, []);
    }
    this.subscribers.get(method).push(callback);
  }

  /**
   * Unsubscribe from WebSocket streams
   * @param {string} method Subscription method (e.g., unsubscribeNewToken)
   * @param {array} keys Keys for unsubscription
   */
  unsubscribe(method, keys = []) {
    const payload = { method: `unsubscribe${method.slice(9)}`, keys };
    this.send(payload);
    this.subscribers.delete(method);
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Fetch and subscribe to new token events
   * @param {function} callback Callback for new token data
   */
  fetchNewTokens(callback) {
    this.subscribe('subscribeNewToken', [], callback);
  }

  /**
   * Execute a trade via API
   */
  async executeTrade(options) {
    const { publicKey, action, mint, amount, denominatedInSol, slippage, priorityFee, pool, privateKey } = options;

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`, // Include API key in the header
        },
        body: JSON.stringify({ publicKey, action, mint, amount, denominatedInSol, slippage, priorityFee, pool }),
      });

      if (response.ok) {
        const transactionBuffer = await response.arrayBuffer();
        const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionBuffer));
        const signerKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        transaction.sign([signerKeypair]);
        const signature = await this.connection.sendTransaction(transaction);
        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
        return signature;
      } else {
        const error = await response.text();
        console.error('Trade API Error:', error);
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      await ErrorHandler.handle(error);
    }
  }

  async checkHealth() {
    try {
      // Check RPC health
      const latestBlockhash = await this.connection.getLatestBlockhash();
      if (!latestBlockhash) {
        throw new Error('❌ Failed to fetch latest blockhash');
      }

      // Check WebSocket connection
      const wsStatus = this.ws?.readyState === WebSocket.OPEN;
      if (!wsStatus) {
        throw new Error('❌ Pumpfun WebSocket is not connected');
      }

      // Check API health
      try {
        const apiResponse = await fetch(this.apiEndpoint, { method: 'GET' });

        if (!apiResponse.ok) {
          // If API returns an error but is reachable, consider it alive
          const errorText = await apiResponse.text();
          if (errorText.includes('Must supply publicKey')) {
            console.log('✅ API is reachable but requires authentication.');
            return {
              status: 'healthy',
              latestBlockhash,
              ws: { connected: true },
              api: { reachable: true },
            };
          } else {
            throw new Error(`API unreachable: ${apiResponse.statusText}`);
          }
        }
      } catch (apiError) {
        const errorMessage = apiError.message || 'Unknown error';
        if (errorMessage.includes('Must supply publicKey')) {
          console.log('✅ API is reachable but requires authentication.');
          return {
            status: 'healthy',
            latestBlockhash,
            ws: { connected: true },
            api: { reachable: true },
          };
        } else {
          throw new Error(`API unreachable: ${errorMessage}`);
        }
      }

      console.log('✅ PumpFunService is healthy');
      return {
        status: 'healthy',
        latestBlockhash,
        ws: { connected: true },
        api: { reachable: true },
      };
    } catch (error) {
      console.error('❌ PumpFunService health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up PumpFunService...');
    if (this.ws) {
      this.ws.terminate();
    }
    this.stopHeartbeat();
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

export const pumpFunService = new PumpFunService({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
});
