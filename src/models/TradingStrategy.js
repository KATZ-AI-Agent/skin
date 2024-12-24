// src/models/TradingStrategy.js
import mongoose from 'mongoose';

const TradingStrategySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  criteria: {
    minLiquidity: Number,
    minHolders: Number,
    maxPositions: Number,
    profitTarget: Number,
    stopLoss: Number,
    timeLimit: Number,
    socialMetrics: {
      minTweetCount: Number,
      minLikes: Number,
      minRetweets: Number
    },
    technicalMetrics: {
      minVolume24h: Number,
      maxSlippage: Number,
      minMarketCap: Number
    }
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const TradingStrategy = mongoose.model('TradingStrategy', TradingStrategySchema);
