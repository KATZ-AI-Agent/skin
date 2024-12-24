import mongoose from 'mongoose';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { DB_POOL_SIZE, DB_IDLE_TIMEOUT, DB_CONNECT_TIMEOUT } from './constants.js';
import { config } from './config.js';
import { EventEmitter } from 'events';
import { ErrorHandler } from './errors/index.js';

class Database extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.database = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.retries = 5;
    this.retryDelay = 5000;
  }

  async connect() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  async _initialize() {
    while (this.retries > 0) {
      try {
        console.log('🚀 Connecting to MongoDB Atlas...');

        // Mongoose connection options with increased timeouts
        const mongooseOptions = {
          serverApi: ServerApiVersion.v1,
          maxPoolSize: DB_POOL_SIZE || 50,
          minPoolSize: 10,
          connectTimeoutMS: 30000, // Increased to 30 seconds
          socketTimeoutMS: 360000, // Increased to 6 minutes
          serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
          heartbeatFrequencyMS: 10000,
          retryWrites: true,
          autoIndex: false,
          w: 'majority',
          bufferCommands: false // Disable buffering
        };

        // Connect with Mongoose
        await mongoose.connect(config.mongoUri, mongooseOptions);

        // MongoClient connection options
        const mongoClientOptions = {
          serverApi: ServerApiVersion.v1,
          maxPoolSize: DB_POOL_SIZE || 50,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 360000,
          retryWrites: true,
          w: 'majority'
        };

        // Connect using MongoClient
        this.client = new MongoClient(config.mongoUri, mongoClientOptions);
        await this.client.connect();

        // Get database reference
        this.database = this.client.db(config.mongoDatabase || 'KATZdatabase1');

        // Test connections
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

  getDatabase() {
    if (!this.isInitialized || !this.database) {
      throw new Error('Database not initialized. Call connect first.');
    }
    return this.database;
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
      }
      
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      this.isInitialized = false;
      this.initializationPromise = null;
      this.emit('disconnected');
    } catch (error) {
      console.error('Error during database disconnect:', error);
      throw error;
    }
  }

  /**
   * Get database instance
   * @returns {db} MongoDB database instance
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
