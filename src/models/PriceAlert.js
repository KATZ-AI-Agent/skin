import mongoose from 'mongoose';

const PriceAlertSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  tokenAddress: {
    type: String,
    required: true
  },
  network: {
    type: String,
    required: true,
    enum: ['ethereum', 'base', 'solana']
  },
  targetPrice: {
    type: Number,
    required: true
  },
  condition: {
    type: String,
    required: true,
    enum: ['above', 'below']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  swapAction: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['buy', 'sell']
    },
    amount: String, // Can be number or percentage (e.g. "50%")
    walletAddress: String
  },
  walletType: {
    type: String,
    enum: ['internal', 'walletconnect'],
    required: true
  },
  preApproved: {
    type: Boolean,
    default: false
  },
  executionResult: {
    hash: String,
    error: String,
    executedAt: Date,
    price: String,
    gasCost: String
  }
});

// Add index for finding active alerts
// Optimize query performance with compound indexes
PriceAlertSchema.index({ isActive: 1, network: 1, tokenAddress: 1 });


// Add methods for status updates
PriceAlertSchema.methods.markExecuted = async function(result) {
  this.isActive = false;
  this.executionResult = {
    hash: result.hash || result.signature,
    executedAt: new Date(),
    price: result.price,
    gasCost: result.gasCost
  };
  return this.save();
};

PriceAlertSchema.methods.markFailed = async function(error) {
  this.isActive = false;
  this.executionResult = {
    error: error.message,
    executedAt: new Date()
  };
  return this.save();
};

export const PriceAlert = mongoose.model('PriceAlert', PriceAlertSchema);