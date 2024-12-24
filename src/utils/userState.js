import { EventEmitter } from 'events';
import { ErrorTypes } from '../core/errors/ErrorTypes.js';

class UserStateManager extends EventEmitter {
  constructor() {
    super();
    this.states = new Map();
    this.data = new Map();
  }

  async setState(userId, state) {
    try {
      this.states.set(userId.toString(), state);
      this.emit('stateChanged', { userId, state });
    } catch (error) {
      throw new Error(ErrorTypes.STATE_ERROR, 'Failed to set user state', { userId, state });
    }
  }

  async getState(userId) {
    try {
      return this.states.get(userId.toString());
    } catch (error) {
      throw new Error(ErrorTypes.STATE_ERROR, 'Failed to get user state', { userId });
    }
  }

  async clearUserState(userId) {
    try {
      this.states.delete(userId.toString());
      this.data.delete(userId.toString());
      this.emit('stateCleared', { userId });
    } catch (error) {
      throw new Error(ErrorTypes.STATE_ERROR, 'Failed to clear user state', { userId });
    }
  }

  async setUserData(userId, data) {
    try {
      this.data.set(userId.toString(), data);
      this.emit('dataChanged', { userId, data });
    } catch (error) {
      throw new Error(ErrorTypes.STATE_ERROR, 'Failed to set user data', { userId });
    }
  }

  async getUserData(userId) {
    try {
      return this.data.get(userId.toString());
    } catch (error) {
      throw new Error(ErrorTypes.STATE_ERROR, 'Failed to get user data', { userId });
    }
  }

  cleanup() {
    this.states.clear();
    this.data.clear();
    this.removeAllListeners();
  }
}

export const UserState = new UserStateManager();