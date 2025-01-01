import { quickNodeService } from '../../quicknode/QuickNodeService.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import PQueue from 'p-queue';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import WebSocket from 'ws';

// Keep direct RPC access for redundancy
const RPC_ENDPOINT = 'https://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764';
const WS_ENDPOINT = 'wss://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764';

export class SolanaWallet {
  constructor() {
    // Keep direct connection for fallback
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    this.queue = new PQueue({ concurrency: 1 });
    this.webSocket = null;
    this.state = {
      initialized: false,
      wsReady: false,
    };
    this.pingInterval = null;
    this.healthCheckInterval = null;
    this.quickNode = null;
  }

  async initialize() {
    return this.queue.add(async () => {
      if (this.state.initialized) return;
      
      try {
        console.log('🔄 Initializing SolanaWallet...');
        
        // Initialize QuickNode
        this.quickNode = quickNodeService;
        await this.quickNode.initialize();
        
        // Setup WebSocket connection
        await this.setupWebSocket();
        
        // Start health monitoring
        this.startHealthChecks();
        
        this.state.initialized = true;
        console.log('✅ SolanaWallet initialized.');
      } catch (error) {
        console.error('❌ Error initializing SolanaWallet:', error);
        throw error;
      }
    });
  }

  async getGasPrice() {
    try {
      // Try QuickNode's priority fee estimation first
      const priorityFees = await this.quickNode.solana.fetchEstimatePriorityFees({
        last_n_blocks: 20
      });

      if (priorityFees?.per_compute_unit?.recommended) {
        const feeInSOL = (priorityFees.per_compute_unit.recommended / 1e9).toFixed(9);
        return {
          price: priorityFees.per_compute_unit.recommended.toString(),
          formatted: `${feeInSOL} SOL`,
          source: 'quicknode'
        };
      }

      // Fallback to direct RPC method
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey('11111111111111111111111111111111');
      
      const message = transaction.compileMessage();
      const feeResult = await this.connection.getFeeForMessage(message, 'confirmed');
      
      if (feeResult?.value) {
        const feeInSOL = (feeResult.value / 1e9).toFixed(9);
        return {
          price: feeResult.value.toString(),
          formatted: `${feeInSOL} SOL`,
          source: 'rpc'
        };
      }

      throw new Error('Gas fee data unavailable');
    } catch (error) {
      console.error('❌ Error fetching gas price:', error);
      return {
        price: '5000',
        formatted: '0.000005 SOL',
        source: 'default'
      };
    }
  }

  // Keep WebSocket setup for direct price monitoring
  async setupWebSocket() {
    if (!WS_ENDPOINT) throw new Error('No WebSocket endpoint available.');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_ENDPOINT);

      ws.on('open', () => {
        this.webSocket = ws;
        this.state.wsReady = true;
        console.log(`✅ WebSocket connected: ${WS_ENDPOINT}`);
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
        this.webSocket.ping();
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
        const [quickNodeSlot, rpcSlot] = await Promise.all([
          this.quickNode.solana.connection.getSlot(),
          this.connection.getSlot()
        ]);
        console.log(`✅ Health Check Passed: QuickNode Slot: ${quickNodeSlot}, RPC Slot: ${rpcSlot}`);
      } catch (error) {
        console.warn('⚠️ Health Check Failed. Attempting to reconnect...');
        this.initialize();
      }
    }, 1800000); // Every 30 minutes
  }

  async createWallet() {
    const mnemonic = bip39.generateMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed).derive("m/44'/501'/0'/0'");
    const keypair = Keypair.fromSeed(hdkey.privateKey);
    await this.setupTokenReception(keypair.publicKey.toString());
    return {
      address: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      mnemonic,
    };
  }

  async setupTokenReception(walletAddress) {
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(walletPubkey, {
      programId: TOKEN_PROGRAM_ID,
    });
    if (!tokenAccounts.value.length) {
      console.log('🔄 No token accounts found. Creating...');
      await this.createTokenAccountIfNeeded(walletPubkey, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    }
  }

  async createTokenAccountIfNeeded(walletPubkey, tokenMint) {
    const mint = new PublicKey(tokenMint);
    const associatedAddress = await getAssociatedTokenAddress(mint, walletPubkey);
    try {
      await getAccount(this.connection, associatedAddress);
    } catch {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(walletPubkey, associatedAddress, walletPubkey, mint)
      );
      await this.sendTransaction(tx);
    }
  }

  async getBalance(address) {
    try {
      // Try QuickNode first
      const balance = await this.quickNode.solana.connection.getBalance(new PublicKey(address));
      return (balance / 1e9).toFixed(9);
    } catch (error) {
      // Fallback to direct RPC
      const balance = await this.connection.getBalance(new PublicKey(address));
      return (balance / 1e9).toFixed(9);
    }
  }

  async getTokenBalance(walletAddress, tokenMint) {
    try {
      // Try QuickNode first
      const response = await this.quickNode.solana.connection.getParsedTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { mint: new PublicKey(tokenMint) }
      );
      
      if (!response?.value?.length) {
        // Fallback to direct RPC
        const rpcResponse = await this.connection.getParsedTokenAccountsByOwner(
          new PublicKey(walletAddress),
          { mint: new PublicKey(tokenMint) }
        );
        return rpcResponse?.value?.length
          ? rpcResponse.value[0].account.data.parsed.info.tokenAmount.uiAmount
          : '0';
      }
      
      return response.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }

  async signTransaction(transaction, privateKey) {
    const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    transaction.sign(keypair);
    return transaction;
  }

  async sendTransaction(transaction) {
    try {
      // Use QuickNode's smart transaction sending
      const smartTx = await this.quickNode.prepareSmartTransaction(transaction);
      const result = await this.quickNode.sendSmartTransaction(smartTx);

      return {
        signature: result.signature,
        success: true
      };
    } catch (error) {
      // Fallback to direct RPC
      try {
        const signature = await this.connection.sendTransaction(transaction);
        return {
          signature,
          success: true
        };
      } catch (rpcError) {
        await ErrorHandler.handle(rpcError);
        throw rpcError;
      }
    }
  }

  async getSlot() {
    try {
      return await this.quickNode.solana.connection.getSlot('finalized');
    } catch (error) {
      return await this.connection.getSlot('finalized');
    }
  }

  cleanup() {
    this.webSocket?.close();
    clearInterval(this.healthCheckInterval);
    clearTimeout(this.pingInterval);
    console.log('✅ Cleaned up SolanaWallet resources.');
  }
}