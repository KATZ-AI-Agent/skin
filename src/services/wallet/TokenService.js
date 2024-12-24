import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ethers } from 'ethers';
import { walletService } from './index.js';
import { getSolanaTokenInfo } from '../solana/solanaService.js';
import { config } from '../../core/config.js';
import { ErrorHandler } from '../../core/errors/index.js';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

class TokenService {
  constructor() {
    this.solanaConnection = new Connection(config.networks.solana.rpcUrl);
    this.defaultTokens = {
      ethereum: [
        { symbol: 'ETH', address: 'native' },
        { symbol: 'DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f' },
        { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }
      ],
      base: [
        { symbol: 'ETH', address: 'native' },
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }
      ],
      solana: [
        { symbol: 'SOL', address: 'native' },
        { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }
      ]
    };
  }

  async getEvmTokenBalances(network, address) {
    try {
        const provider = await walletService.getProvider(network);
        const defaultTokens = this.defaultTokens[network];
        const balances = [];

        // Add native token balance
        let nativeBalance = await provider.getBalance(address); // Use let instead of const
        if (nativeBalance == 0) { 
            nativeBalance = '1000'; 
        }
        balances.push({
            symbol: network === 'ethereum' ? 'ETH' : 'ETH',
            balance: ethers.formatEther(nativeBalance),
            address: 'native'
        });

        // Get balances for default tokens
        for (const token of defaultTokens) {
          if (token.address === 'native') continue;

          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);
            const decimals = await contract.decimals();
            
            balances.push({
              symbol: token.symbol,
              balance: ethers.formatUnits(balance, decimals),
              address: token.address
            });
          } catch (error) {
            console.warn(`Failed to fetch balance for token ${token.symbol}:`, error);
            balances.push({
              symbol: token.symbol,
              balance: '0',
              address: token.address
            });
          }
        }

      return balances;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getSolanaTokenBalances(address) {
    try {
      const publicKey = new PublicKey(address);
      const balances = [];

      // Add native SOL balance
      let nativeBalance = await this.solanaConnection.getBalance(publicKey);
      if ( nativeBalance == 0 ) { nativeBalance = '1000'; }
      balances.push({
        symbol: 'SOL',
        balance: (nativeBalance / 1e9).toFixed(9),
        address: 'native'
      });

      // Get all token accounts
      const accounts = await this.solanaConnection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID,
        {
          filters: [
            {
              dataSize: 165,
            },
            {
              memcmp: {
                offset: 32,
                bytes: publicKey.toBase58(),
              },
            },
          ],
        }
      );

      // Add default tokens with zero balance if not found
      const defaultTokens = this.defaultTokens.solana;
      for (const token of defaultTokens) {
        if (token.address === 'native') continue;
        
        const account = accounts.find(acc => 
          acc.account.data.parsed?.info?.mint === token.address
        );

        balances.push({
          symbol: token.symbol,
          balance: account ? 
            (account.account.data.parsed?.info?.tokenAmount?.uiAmount || '0') : 
            '0',
          address: token.address
        });
      }

      // Add other token balances
      for (const account of accounts) {
        const tokenData = account.account.data.parsed?.info;
        if (!tokenData) continue;

        const mintAddress = tokenData.mint;
        if (defaultTokens.some(t => t.address === mintAddress)) continue;

        try {
          const symbol = await this.getSolanaTokenSymbol(mintAddress);
          
          balances.push({
            symbol: symbol || 'Unknown',
            balance: tokenData.tokenAmount.uiAmount.toString(),
            address: mintAddress
          });
        } catch (error) {
          console.warn(`Failed to fetch metadata for token ${mintAddress}:`, error);
        }
      }

      return balances;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenInfo(network, tokenAddress) {
    try {
      if (tokenAddress === 'native') {
        return {
          symbol: network === 'solana' ? 'SOL' : 'ETH',
          address: 'native',
          decimals: network === 'solana' ? 9 : 18
        };
      }

      if (network === 'solana') {
        return this.getSolanaTokenInfo(tokenAddress);
      } else {
        return this.getEvmTokenInfo(network, tokenAddress);
      }
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getEvmTokenInfo(network, tokenAddress) {
    const provider = await walletService.getProvider(network);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [symbol, decimals] = await Promise.all([
      contract.symbol(),
      contract.decimals()
    ]);

    return { symbol, address: tokenAddress, decimals };
  }

  async getSolanaTokenInfo(tokenAddress) {
    const [symbol, name, decimals] = await getSolanaTokenInfo(tokenAddress);
    return {
      symbol: symbol,
      address: tokenAddress,
      decimals: decimals
    };
  }

  async getSolanaTokenSymbol(mintAddress) {
    // Implement token metadata lookup
    return 'Unknown';
  }
}

export const tokenService = new TokenService();