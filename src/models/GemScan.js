import mongoose from 'mongoose';

const GemScanSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  tokens: [{
    symbol: String,
    name: String,
    address: String,
    network: {
      type: String,
      enum: ['ethereum', 'base', 'solana']
    },
    logo: String,
    dextoolsUrl: String,
    metrics: {
      impressions: Number,
      retweets: Number,
      likes: Number,
      tweetCount: Number,
      rating: Number
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  scanTime: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient date queries
GemScanSchema.index({ date: 1, 'tokens.rating': -1 });

export const GemScan = mongoose.model('GemScan', GemScanSchema);