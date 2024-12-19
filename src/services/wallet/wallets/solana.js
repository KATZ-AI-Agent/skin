import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { BaseWallet } from './base.js';
import PQueue from 'p-queue';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import WebSocket from 'ws';
import axios from 'axios';

const RPC_ENDPOINTS = {
  primary: ['https://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764'],
  fallback: ['https://solana-mainnet-fallback.example.com'],
};

const WS_ENDPOINTS = [
  'wss://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764',
];

const TIMEOUT_CONFIG = { initial: 5000, max: 15000, increment: 2000 };

export class SolanaWallet extends BaseWallet {
  constructor(networkConfig) {
    super(networkConfig);
    this.connection = null;
    this.state = {
      rpcEndpoint: null,
      wsReady: false,
      initialized: false,
    };
    this.queue = new PQueue({ concurrency: 1 });
    this.webSocket = null;
    this.pendingMessages = [];
    this.retryAttempts = 0;
    this.pingInterval = null;
    this.healthCheckInterval = null;
  }

  async initialize() {
    return this.queue.add(async () => {
      if (this.state.initialized) return;
      console.log('🔄 Initializing SolanaWallet...');
      await this.setupRpcConnection();
      await this.setupWebSocket();
      this.startHealthChecks();
      this.state.initialized = true;
      console.log('✅ SolanaWallet initialized.');
    });
  }

  async setupRpcConnection() {
    const endpoints = [...RPC_ENDPOINTS.primary, ...RPC_ENDPOINTS.fallback];
    for (const endpoint of endpoints) {
      try {
        const version = await this.rpcRequest(endpoint, 'getVersion', []);
        this.state.rpcEndpoint = endpoint;console.log(`✅ Successfully connected to Solana RPC endpoint: ${JSON.stringify(endpoint)}\n🔹 RPC Version: ${JSON.stringify(version)}`);
        return;
      } catch (error) {
        console.warn(`⚠️ Failed to connect to RPC: ${endpoint}`, error.message);
      }
    }
    throw new Error('❌ All RPC connections failed.');
  }

  async rpcRequest(endpoint, method, params = []) {
    try {
      const response = await axios.post(
        endpoint,
        { jsonrpc: '2.0', id: 1, method, params },
        { timeout: TIMEOUT_CONFIG.initial }
      );
      if (response.data.error) throw new Error(response.data.error.message);
      return response.data.result;
    } catch (error) {
      throw new Error(`RPC Request Error: ${error.message}`);
    }
  }

  /** WebSocket Setup */
  async setupWebSocket() {
    const endpoint = WS_ENDPOINTS[0];
    if (!endpoint) throw new Error('No WebSocket endpoint available.');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);

      ws.on('open', () => {
        this.webSocket = ws;
        this.state.wsReady = true;
        console.log(`✅ WebSocket connected: ${endpoint}`);
        this.heartbeat();
        resolve();
      });

      ws.on('message', (msg) => console.log('📥 WebSocket Message:', msg.toString()));
      ws.on('error', (err) => reject(err));
      ws.on('close', () => this.reconnectWebSocket());
    });
  }

  heartbeat() {
    if (this.pingInterval) clearTimeout(this.pingInterval);
  
    this.pingInterval = setTimeout(() => {
      if (this.webSocket?.readyState === WebSocket.OPEN) {
        console.log('🔄 Sending heartbeat ping...');
        const startTime = Date.now(); // Capture the start time of the ping
  
        this.webSocket.ping(); // Send ping
  
        // Listen for the "pong" response
        this.webSocket.once('pong', () => {
          const latency = Date.now() - startTime; // Calculate the ping time
          console.log(`✅ Pong received. Latency: ${latency}ms`);
        });
      } else {
        console.warn('⚠️ WebSocket is not open. Skipping heartbeat ping.');
      }
    }, 60000); // 60 seconds
  }  

  reconnectWebSocket() {
    console.warn('⚠️ Reconnecting WebSocket...');
    setTimeout(() => this.setupWebSocket(), 5000);
  }

  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const response = await this.connection.rpcRequest('getHealth');
  
        if (response.error) {
          console.warn(
            `⚠️ Health Check Failed: ${response.error.message} (Code: ${response.error.code})`
          );
          console.warn('⚠️ Attempting to reconnect RPC...');
          await this.setupRpcConnection();
        } else {
          console.log('✅ Health Check Passed: Node is healthy');
        }
      } catch (error) {
        console.error('❌ Health Check Error:', error.message);
        console.warn('⚠️ Attempting to reconnect RPC...');
        await this.setupRpcConnection();
      }
    }, 1800000); // Every 30 minutes
  }  

  /** Wallet Methods */
  async createWallet() {
    const mnemonic = bip39.generateMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed).derive("m/44'/501'/0'/0'");
    const keypair = Keypair.fromSeed(hdkey.privateKey);
    await this.setupTokenReception(keypair.publicKey.toString());
    return { address: keypair.publicKey.toString(), privateKey: Buffer.from(keypair.secretKey).toString('hex'), mnemonic };
  }

  async setupTokenReception(walletAddress) {
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccounts = await this.rpcRequest(this.state.rpcEndpoint, 'getTokenAccountsByOwner', [
      walletPubkey.toString(),
      { programId: TOKEN_PROGRAM_ID },
    ]);
    if (!tokenAccounts.value.length) {
      console.log('🔄 No token accounts found. Creating...');
      await this.createTokenAccountIfNeeded(walletPubkey, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
    }
  }

  async createTokenAccountIfNeeded(walletPubkey, tokenMint) {
    const mint = new PublicKey(tokenMint);
    const associatedAddress = await getAssociatedTokenAddress(mint, walletPubkey);
    try {
      await getAccount(this.state.rpcEndpoint, associatedAddress);
    } catch {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(walletPubkey, associatedAddress, walletPubkey, mint)
      );
      await this.sendTransaction(tx);
    }
  }

  async getBalance(address) {
    const balance = await this.rpcRequest(this.state.rpcEndpoint, 'getBalance', [address]);
    return (balance / 1e9).toFixed(9);
  }

  async getTokenBalance(walletAddress, tokenMint) {
    const response = await this.rpcRequest(this.state.rpcEndpoint, 'getTokenAccountsByOwner', [
      walletAddress,
      { mint: tokenMint },
    ]);
    return response?.value?.length ? response.value[0].amount : '0';
  }

  async getSlot() {
    return await this.rpcRequest(this.state.rpcEndpoint, 'getSlot', ['finalized']);
  }

  async getGasPrice() {
    try {
      // Fetch recent blockhash and fee calculator
      const response = await this.rpcRequest(this.state.rpcEndpoint, 'getRecentBlockhash', []);
      const feePerSignature = response?.value?.feeCalculator?.lamportsPerSignature;
  
      if (feePerSignature) {
        const feeInSOL = (feePerSignature / 1e9).toFixed(9);
        console.log(`💰 Solana Gas Fee: ${feePerSignature} lamports (${feeInSOL} SOL)`);
  
        return {
          price: feePerSignature.toString(),
          formatted: `${feeInSOL} SOL`,
          source: 'getRecentBlockhash',
        };
      }
  
      throw new Error('Fee data unavailable');
    } catch (error) {
      console.warn('⚠️ Failed to fetch Solana gas fees directly. Using fallback value.');
      const fallbackFee = 5000; // Default fallback fee
      return {
        price: fallbackFee.toString(),
        formatted: `${(fallbackFee / 1e9).toFixed(9)} SOL`,
        source: 'default',
      };
    }
  }  

  async signTransaction(transaction, privateKey) {
    const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    transaction.sign([keypair]);
    return transaction;
  }

  async sendTransaction(transaction) {
    const serialized = transaction.serialize().toString('base64');
    return await this.rpcRequest(this.state.rpcEndpoint, 'sendTransaction', [serialized]);
  }

  cleanup() {
    this.webSocket?.close();
    clearInterval(this.healthCheckInterval);
    clearTimeout(this.pingInterval);
    console.log('✅ Cleaned up SolanaWallet resources.');
  }
}
