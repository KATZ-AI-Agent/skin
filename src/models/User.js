import mongoose from 'mongoose';
import { NETWORKS } from '../core/constants.js';
import { encrypt, decrypt } from '../utils/encryption.js';

// Wallet Schema Definition
const WalletSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    index: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  encryptedMnemonic: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['internal', 'walletconnect'],
    default: 'internal'
  },
  isAutonomous: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Main User Schema
const UserSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  wallets: {
    ethereum: [WalletSchema],
    base: [WalletSchema],
    solana: [WalletSchema]
  },
  settings: {
    defaultNetwork: {
      type: String,
      enum: Object.values(NETWORKS),
      default: NETWORKS.ETHEREUM
    },
    notifications: {
      enabled: {
        type: Boolean,
        default: true
      },
      showInChat: {
        type: Boolean,
        default: true
      },
      gemsToday: {
        type: Boolean,
        default: true
      }
    },
    trading: {
      autonomousEnabled: {
        type: Boolean,
        default: true
      },
      slippage: {
        ethereum: {
          type: Number,
          default: 3,
          min: 0.1,
          max: 50
        },
        base: {
          type: Number,
          default: 3,
          min: 0.1,
          max: 50
        },
        solana: {
          type: Number,
          default: 3,
          min: 0.1,
          max: 50
        }
      }
    }
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Add indexes
UserSchema.index({ 'wallets.ethereum.address': 1 });
UserSchema.index({ 'wallets.base.address': 1 });
UserSchema.index({ 'wallets.solana.address': 1 });
UserSchema.index({ 'settings.autonomousWallet.address': 1 });

// Pre-save middleware
UserSchema.pre('save', function(next) {
  if (this.telegramId && typeof this.telegramId !== 'string') {
    this.telegramId = this.telegramId.toString();
  }
  next();
});

// Instance Methods
UserSchema.methods = {
  // Get active wallet with proper error handling and validation
  getActiveWallet: function(network) {
    if (!network || !Object.values(NETWORKS).includes(network)) {
      throw new Error(`Invalid network: ${network}`);
    }

    if (!this.wallets?.[network]?.length) {
      return null;
    }

    // Return first wallet for network with basic info
    const wallet = this.wallets[network][0];
    return {
      address: wallet.address,
      type: wallet.type,
      isAutonomous: wallet.isAutonomous,
      createdAt: wallet.createdAt
    };
  },

  // Get decrypted wallet with proper validation and error handling
  getDecryptedWallet: function(network, address) {
    if (!network || !address) {
      throw new Error('Network and address are required');
    }

    const wallet = this.wallets[network]?.find(w => w.address === address);
    if (!wallet) {
      return null;
    }

    try {
      return {
        address: wallet.address,
        privateKey: decrypt(wallet.encryptedPrivateKey),
        mnemonic: decrypt(wallet.encryptedMnemonic),
        network,
        type: wallet.type || 'internal',
        isAutonomous: wallet.isAutonomous,
        createdAt: wallet.createdAt
      };
    } catch (error) {
      console.error(`Error decrypting wallet ${address}:`, error);
      throw new Error('Failed to decrypt wallet data');
    }
  },

  // Set autonomous wallet with validation
  setAutonomousWallet: async function(network, address) {
    if (!network || !address) {
      throw new Error('Network and address are required');
    }

    const wallet = this.wallets[network]?.find(w => w.address === address);
    if (!wallet) {
      return false;
    }

    try {
      wallet.isAutonomous = true;
      await this.save();
      return true;
    } catch (error) {
      console.error(`Error setting autonomous wallet ${address}:`, error);
      throw new Error('Failed to update wallet');
    }
  },

  // Add new wallet with encryption and validation
  addWallet: async function(network, walletData) {
    if (!network || !walletData?.address || !walletData?.privateKey || !walletData?.mnemonic) {
      throw new Error('Invalid wallet data');
    }

    if (!this.wallets[network]) {
      this.wallets[network] = [];
    }

    try {
      const encryptedWallet = {
        address: walletData.address,
        encryptedPrivateKey: encrypt(walletData.privateKey),
        encryptedMnemonic: encrypt(walletData.mnemonic),
        type: walletData.type || 'internal',
        isAutonomous: false,
        createdAt: new Date()
      };

      this.wallets[network].push(encryptedWallet);
      await this.save();
      return true;
    } catch (error) {
      console.error(`Error adding wallet for ${network}:`, error);
      throw new Error('Failed to add wallet');
    }
  },

  // Remove wallet
  removeWallet: async function(network, address) {
    if (!this.wallets[network]) return false;

    const initialLength = this.wallets[network].length;
    this.wallets[network] = this.wallets[network].filter(w => w.address !== address);

    if (this.wallets[network].length < initialLength) {
      return await this.save();
    }
    return false;
  },

  // Update wallet settings
  updateWalletSettings: async function(settings) {
    if (settings.defaultNetwork) {
      this.settings.defaultNetwork = settings.defaultNetwork;
    }
    if (settings.slippage) {
      Object.assign(this.settings.trading.slippage, settings.slippage);
    }
    if (typeof settings.autonomousEnabled === 'boolean') {
      this.settings.trading.autonomousEnabled = settings.autonomousEnabled;
    }
    return await this.save();
  }
};

// Static Methods
UserSchema.statics = {
  // Find user by telegram ID
  findByTelegramId: async function(telegramId) {
    return await this.findOne({ telegramId: telegramId.toString() }).exec();
  },

  // Get all users with autonomous trading enabled
  getAutonomousUsers: async function() {
    return await this.find({
      'settings.trading.autonomousEnabled': true
    }).exec();
  },

  // Get users by network
  getUsersByNetwork: async function(network) {
    return await this.find({
      [`wallets.${network}`]: { $exists: true, $ne: [] }
    }).exec();
  }
};

// Create the model
const User = mongoose.model('User', UserSchema);

export { User };
