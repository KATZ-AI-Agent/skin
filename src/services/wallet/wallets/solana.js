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

const RPC_ENDPOINT = 'https://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764';
const WS_ENDPOINT = 'wss://lingering-red-liquid.solana-mainnet.quiknode.pro/a2a21741d8c9370d63a0789ab9eb93f926e11764';

export class SolanaWallet {
  constructor() {
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    this.queue = new PQueue({ concurrency: 1 });
    this.webSocket = null;
    this.state = {
      initialized: false,
      wsReady: false,
    };
    this.pingInterval = null;
    this.healthCheckInterval = null;
  }

  async initialize() {
    return this.queue.add(async () => {
      if (this.state.initialized) return;
      console.log('🔄 Initializing SolanaWallet...');
      await this.setupWebSocket();
      this.startHealthChecks();
      this.state.initialized = true;
      console.log('✅ SolanaWallet initialized.');
    });
  }

  async getGasPrice() {
    try {
      // Fetch the recent blockhash from the connection
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      console.log(`🔹 Fetched recent blockhash: ${blockhash}`);
  
      // Create a new transaction and set the recent blockhash
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
  
      // Set a dummy fee payer (required to compile the transaction message)
      const dummyPublicKey = new PublicKey('11111111111111111111111111111111'); // Replace with an actual public key if needed
      transaction.feePayer = dummyPublicKey;
  
      // Compile the transaction message
      const message = transaction.compileMessage();
  
      // Fetch the fee for the compiled message
      const feeResult = await this.connection.getFeeForMessage(message, 'confirmed');
      console.log(`🔹 Fee result:`, feeResult);
  
      // If the fee value is present, calculate and log it
      if (feeResult?.value) {
        const feeInSOL = (feeResult.value / 1e9).toFixed(9);
        console.log(`💰 Gas Fee: ${feeResult.value} lamports (${feeInSOL} SOL)`);
        return {
          price: feeResult.value.toString(),
          formatted: `${feeInSOL} SOL`,
          source: 'getFeeForMessage',
        };
      }
  
      throw new Error('Gas fee data unavailable.');
    } catch (error) {
      // Log the full error details for better debugging
      console.error('❌ Error fetching gas price:', error.message);
      return {
        price: '5000', // Fallback fee in lamports
        formatted: '0.000005 SOL', // Fallback formatted fee
        source: 'default',
      };
    }
  }
  
  
  /** WebSocket Setup */
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
        const slot = await this.connection.getSlot();
        console.log(`✅ Health Check Passed: Current Slot: ${slot}`);
      } catch (error) {
        console.warn('⚠️ Health Check Failed. Attempting to reconnect...');
        this.initialize();
      }
    }, 1800000); // Every 30 minutes
  }

  async signTransaction(transaction, privateKey) {
    const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    transaction.sign(keypair);
    return transaction;
  }

  //From wallet needs passing here
  async sendTransaction(transaction) {
    try {
      // Prepare as smart transaction
      const smartTx = await quickNodeService.prepareSmartTransaction(transaction);
      
      // Send with optimized fees
      const result = await quickNodeService.sendSmartTransaction(smartTx);

      return {
        signature: result.signature,
        success: true
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  /** Wallet Methods */
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
    const balance = await this.connection.getBalance(new PublicKey(address));
    return (balance / 1e9).toFixed(9);
  }

  async getTokenBalance(walletAddress, tokenMint) {
    const response = await this.connection.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
      mint: new PublicKey(tokenMint),
    });
    return response?.value?.length
      ? response.value[0].account.data.parsed.info.tokenAmount.uiAmount
      : '0';
  }

  async getSlot() {
    return await this.connection.getSlot('finalized');
  }

  cleanup() {
    this.webSocket?.close();
    clearInterval(this.healthCheckInterval);
    clearTimeout(this.pingInterval);
    console.log('✅ Cleaned up SolanaWallet resources.');
  }
}
