// src/services/ai/ContextManager.js

class AIContextManager {
    constructor() {
      this.contexts = new Map();
    }
  
    async getContext(userId) {
      return this.contexts.get(userId) || [];
    }
  
    async updateContext(userId, message, response) {
      const context = await this.getContext(userId);
      context.push({ message, response });
      
      // Keep last 10 messages for context
      if (context.length > 10) {
        context.shift();
      }
      
      this.contexts.set(userId, context);
    }
  }
  
  export const contextManager = new AIContextManager();
  