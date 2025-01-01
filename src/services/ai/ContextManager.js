import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';

export class AIContextManager extends EventEmitter {
  constructor() {
    super();
    this.conversations = new Map();
    this.maxHistory = 10;
  }

  async getContext(userId) {
    try {
      return this.conversations.get(userId) || [];
    } catch (error) {
      await ErrorHandler.handle(error);
      return [];
    }
  }

  async updateContext(userId, message, response) {
    try {
      const context = await this.getContext(userId);
      
      // Add new message and response
      const newMessages = [
        { 
          role: 'user',
          content: message,
          timestamp: Date.now()
        },
        {
          role: 'assistant', 
          content: response,
          timestamp: Date.now()
        }
      ];

      // Update context with new messages
      const updatedContext = [...context, ...newMessages];

      // Keep only last N messages
      if (updatedContext.length > this.maxHistory * 2) {
        updatedContext.splice(0, 2);
      }

      this.conversations.set(userId, updatedContext);
      this.emit('contextUpdated', { userId, context: updatedContext });
    } catch (error) {
      await ErrorHandler.handle(error);
    }
  }

  async clearContext(userId) {
    try {
      this.conversations.delete(userId);
      this.emit('contextCleared', { userId });
    } catch (error) {
      await ErrorHandler.handle(error);
    }
  }

  cleanup() {
    this.conversations.clear();
    this.removeAllListeners();
  }
}

export const contextManager = new AIContextManager();