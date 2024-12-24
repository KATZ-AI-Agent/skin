// src/services/db/DBAIInterface.js
import mongoose from 'mongoose';
import { ErrorHandler } from '../../core/errors/index.js';

// Define schemas
const GuidelineSchema = new mongoose.Schema({
  userId: String,
  content: String,
  category: String,
  createdAt: { type: Date, default: Date.now }
});

const StrategySchema = new mongoose.Schema({
  userId: String,
  name: String,
  description: String,
  parameters: Object,
  createdAt: { type: Date, default: Date.now }
});

const Guideline = mongoose.model('Guideline', GuidelineSchema);
const Strategy = mongoose.model('Strategy', StrategySchema);

class DBAIInterface {
  async saveUserGuideline(userId, guideline) {
    try {
      const doc = new Guideline({
        userId,
        content: guideline.content,
        category: guideline.category
      });
      return await doc.save();
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getUserGuidelines(userId) {
    try {
      return await Guideline.find({ userId }).sort('-createdAt');
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async saveTradingStrategy(userId, strategy) {
    try {
      const doc = new Strategy({
        userId,
        name: strategy.name,
        description: strategy.description,
        parameters: strategy.parameters
      });
      return await doc.save();
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTradingStrategies(userId) {
    try {
      return await Strategy.find({ userId }).sort('-createdAt');
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }
}

export const dbAIInterface = new DBAIInterface();
