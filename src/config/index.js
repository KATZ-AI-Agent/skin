import dotenv from 'dotenv';
import { validateConfig } from '../utils/validation.js';

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  smartContractAddress: process.env.SMART_CONTRACT_ADDRESS,
  mongoUri: process.env.MONGO_URI,
  mongoEncryptionKey: process.env.MONGO_ENCRYPTION_KEY,
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
  solanaApiKey: process.env.SOLANA_API_KEY,
  networks: {
    ethereum: {
      name: 'Ethereum',
      rpcUrl: process.env.ETHEREUM_RPC_URL,
      chainId: 1
    },
    base: {
      name: 'Base',
      rpcUrl: process.env.BASE_RPC_URL, 
      chainId: 8453
    },
    solana: {
      name: 'Solana',
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    }
  }
};

validateConfig(config);