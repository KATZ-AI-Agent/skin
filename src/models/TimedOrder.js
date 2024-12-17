import mongoose from 'mongoose';

const TimedOrderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true
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
  action: {
    type: String,
    required: true,
    enum: ['buy', 'sell']
  },
  amount: {
    type: String,
    required: true
  },
  executeAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'executed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  orderType: {
    type: String,
    enum: ['standard', 'limit', 'stop', 'trailing', 'multi', 'chain', 'conditional'],
    default: 'standard'
  },
  conditions: {
    limitPrice: Number,
    stopPrice: Number,
    trailAmount: Number,
    targetPrice: Number,
    dependencies: [{
      orderId: mongoose.Schema.Types.ObjectId,
      condition: String
    }],
    multiOrderConfig: {
      totalAmount: String,
      orderCount: Number,
      intervalMinutes: Number
    }
  },
  executionResult: {
    hash: String,
    error: String,
    executedAt: Date,
    price: String,
    gasCost: String,
    partialFills: [{
      amount: String,
      price: String,
      timestamp: Date
    }]
  }
});

// Add index for finding active orders
TimedOrderSchema.index({ status: 1, executeAt: 1 });

// Add methods for status updates
TimedOrderSchema.methods.markExecuted = async function(result) {
  this.status = 'executed';
  this.executionResult = {
    hash: result.hash || result.signature,
    executedAt: new Date(),
    price: result.price,
    gasCost: result.gasCost
  };
  return this.save();
};

TimedOrderSchema.methods.markFailed = async function(error) {
  this.status = 'failed';
  this.executionResult = {
    error: error.message,
    executedAt: new Date()
  };
  return this.save();
};

// Add methods for advanced order types
TimedOrderSchema.methods.updateTrailingStop = async function(newPrice) {
  if (this.orderType !== 'trailing') return;
  
  const trailAmount = this.conditions.trailAmount;
  const newStopPrice = newPrice * (1 - trailAmount/100);
  
  if (newStopPrice > this.conditions.stopPrice) {
    this.conditions.stopPrice = newStopPrice;
    await this.save();
  }
};

TimedOrderSchema.methods.checkConditions = async function(marketData) {
  if (this.orderType !== 'conditional') return true;
  
  // Implement condition checking logic
  const condition = this.conditions;
  switch(condition.type) {
    case 'price':
      return marketData.price >= condition.value;
    case 'volume':
      return marketData.volume24h >= condition.value;
    case 'dependency':
      const dependentOrder = await this.model('TimedOrder').findById(condition.orderId);
      return dependentOrder?.status === 'executed';
    default:
      return false;
  }
};

export const TimedOrder = mongoose.model('TimedOrder', TimedOrderSchema);