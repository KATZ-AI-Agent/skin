import mongoose from 'mongoose';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { DB_POOL_SIZE, DB_IDLE_TIMEOUT, DB_CONNECT_TIMEOUT } from './constants.js';
import { config } from './config.js';
import { EventEmitter } from 'events';
import { ErrorHandler } from './errors/index.js';

// Constants for database configuration
const DB_CONFIG = {
  POOL_SIZE: 10,
  MIN_POOL_SIZE: 5,
  CONNECTION_TIMEOUT: 5000,
  SOCKET_TIMEOUT: 300000,
  SERVER_SELECTION_TIMEOUT: 5000,
  HEARTBEAT_FREQUENCY: 30000,
  RETRY_WRITES: true,
  AUTO_INDEX: false,
  WRITE_CONCERN: 'majority',
  BUFFER_COMMANDS: false,
  BUFFER_TIMEOUT: 5000,
  MAX_RETRIES: 5,
  RETRY_DELAY: 5000
};

class Database extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.database = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.retries = DB_CONFIG.MAX_RETRIES;
    this.retryDelay = DB_CONFIG.RETRY_DELAY;
  }

  /**
   * Connect to MongoDB database
   * @returns {Promise<boolean>} Connection status
   */
  async connect() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  /**
   * Initialize database connection with retries
   * @private
   * @returns {Promise<boolean>}
   */
  async _initialize() {
    while (this.retries > 0) {
      try {
        console.log('🚀 Connecting to MongoDB Atlas...');

        // Mongoose connection options
        const mongooseOptions = {
          serverApi: ServerApiVersion.v1,
          maxPoolSize: DB_CONFIG.POOL_SIZE || 10, // Controls the number of concurrent connections
          minPoolSize: 10, // Maintain a minimum pool size
          connectTimeoutMS: DB_CONFIG.CONNECTION_TIMEOUT || 5000, // Connection timeout
          socketTimeoutMS: DB_CONFIG.SOCKET_TIMEOUT, // 5 minutes Socket timeout
          serverSelectionTimeoutMS: DB_CONFIG.SERVER_SELECTION_TIMEOUT, // MongoDB server selection timeout
          heartbeatFrequencyMS: DB_CONFIG.HEARTBEAT_FREQUENCY, // 30 seconds
          retryWrites: true, // Enable retryable writes
          autoIndex: false, // Disable auto-indexing for production
          w: 'majority', // Majority write concern
        };

        console.log('🚀 Connecting to MongoDB Atlas with Mongoose...');
        await mongoose.connect(config.mongoUri, mongooseOptions);

        // MongoClient connection options
        const mongoClientOptions = {
          serverApi: ServerApiVersion.v1,
          maxPoolSize: DB_POOL_SIZE || 50,
          connectTimeoutMS: DB_CONNECT_TIMEOUT || 30000,
          socketTimeoutMS: 300000, // 5 minutes
          retryWrites: true,
          w: 'majority',
        };

        // Connect using MongoClient
        this.client = new MongoClient(config.mongoUri, mongoClientOptions);
        await this.client.connect();

        // Get database reference
        this.database = this.client.db(config.mongoDatabase || 'KATZdatabase1');

        // Test both connections
        await this._testConnections();

        this.isInitialized = true;
        this.emit('connected');
        console.log('✅ Successfully connected to MongoDB Atlas');

        return true;
      } catch (error) {
        await this._handleConnectionError(error);
      }
    }
  }

  /**
   * Test database connections
   * @private
   */
  async _testConnections() {
    try {
      // Test Mongoose connection
      await mongoose.connection.db.command({ ping: 1 });
      
      // Test MongoClient connection
      await this.database.command({ ping: 1 });
    } catch (error) {
      throw new Error('Failed to verify database connections: ' + error.message);
    }
  }

  /**
   * Handle connection errors and retries
   * @private
   * @param {Error} error - Connection error
   */
  async _handleConnectionError(error) {
    this.retries--;
    console.error(`❌ MongoDB connection failed. Retries left: ${this.retries}`, error);

    if (this.retries === 0) {
      this.isInitialized = false;
      this.initializationPromise = null;
      this.emit('error', error);
      throw new Error('Failed to connect to MongoDB after all retries');
    }

    console.log(`🔄 Retrying in ${this.retryDelay / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      console.log('🔌 Disconnecting from MongoDB...');
      
      if (this.client) {
        await this.client.close();
      }
      
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      this.isInitialized = false;
      this.initializationPromise = null;
      console.log('✅ Disconnected from MongoDB');
      this.emit('disconnected');
    } catch (error) {
      console.error('❌ MongoDB disconnection error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get database instance
   * @returns {Db} MongoDB database instance
   */
  getDatabase() {
    if (!this.isInitialized || !this.database) {
      throw new Error('Database not initialized. Call connect first.');
    }
    return this.database;
  }

  /**
   * Check database health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      // Check Mongoose connection
      if (mongoose.connection.readyState === 1) {
        console.log('✅ Mongoose connection is healthy');
      } else {
        throw new Error('Mongoose connection is not ready');
      }

      // Check MongoClient connection
      const pingResult = await this.database.command({ ping: 1 });
      if (!pingResult.ok) {
        throw new Error('MongoClient ping failed');
      }

      console.log('✅ MongoClient connection is healthy');
      return { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        mongooseState: mongoose.connection.readyState,
        clientConnected: this.client.topology.isConnected()
      };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }
}

// Export singleton instance
export const db = new Database();

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received. Closing MongoDB connections...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received. Closing MongoDB connections...');
  await db.disconnect();
  process.exit(0);
});
