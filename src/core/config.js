import dotenv from 'dotenv';
import { validateConfig } from '../utils/validation.js';
import { NETWORKS } from './constants.js';

dotenv.config();

// Validate encryption key
const ENCRYPTION_KEY = process.env.MONGO_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'base64').length !== 32) {
  throw new Error('Invalid or missing 32-byte encryption key');
}

class Config {
  constructor() {
    this.botToken = process.env.BOT_TOKEN;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.smartContractAddress = process.env.SMART_CONTRACT_ADDRESS;
    this.mongoUri = process.env.MONGO_URI;
    this.mongoEncryptionKey = ENCRYPTION_KEY;
    this.alchemyApiKey = process.env.ALCHEMY_API_KEY || 'ip7ONCr6sDycSojM_PZoWawrVM_2c0RW';
    this.solanaApiKey = process.env.SOLANA_API_KEY || 'ip7ONCr6sDycSojM_PZoWawrVM_2c0RW';
    this.apifyApiKey = process.env.APIFY_API_KEY;

    // QuickNode Configuration
    this.quickNode = {
      apiKey: process.env.QUICKNODE_API_KEY,
      evmEndpoint: process.env.QUICKNODE_EVM_ENDPOINT || 'https://api.quicknode.com/v1/your-evm-endpoint',
      solanaEndpoint: process.env.QUICKNODE_SOLANA_ENDPOINT || 'https://api.quicknode.com/v1/your-solana-endpoint'
    };

    // Dextools Configuration

    this.dextoolsBaseUrl = process.env.DEXTOOLS_BASE_URL,
    this.dextoolsApiKey = process.env.DEXTOOLS_API_KEY,

    // Network configurations
    this.networks = {
      [NETWORKS.ETHEREUM]: {        
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        alchemyApiKey: process.env.ALCHEMY_API_KEY,
        fallbackRpcUrls: this.parseFallbackUrls(process.env.ETHEREUM_FALLBACK_RPC_URLS),
        chainId: 1,
        name: 'eth-mainnet',
      },
      [NETWORKS.BASE]: {        
        rpcUrl: process.env.BASE_RPC_URL,
        alchemyApiKey: process.env.ALCHEMY_API_KEY,
        fallbackRpcUrls: this.parseFallbackUrls(process.env.BASE_FALLBACK_RPC_URLS),
        chainId: 8453,
        name: 'base-mainnet',
      },
      [NETWORKS.SOLANA]: {
        name: 'Solana',
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      },
    };

    this.cacheSettings = {
      duration: 5 * 60 * 1000, // 5 minutes default
    };

    // Dashboard Monitoring TG End Point for KATZ Agent
    this.monitoring = {
      dashboardPort: process.env.DASHBOARD_PORT || 3000, // Default to port 3000
    };

    // Validate and initialize configuration
    validateConfig(this);
  }

  /**
   * Parse comma-separated fallback URLs into an array.
   */
  parseFallbackUrls(urlString) {
    return urlString ? urlString.split(',').map((url) => url.trim()) : [];
  }

  getNetworkConfig(network) {
    const networkConfig = this.networks[network];
    if (!networkConfig) {
      throw new Error(`Invalid network requested: ${network}`);
    }
    return networkConfig;
  }
}

export const config = new Config();