import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { monitoringSystem } from '../../core/monitoring/Monitor.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { User } from '../../models/User.js';
import { dextools } from '../dextools/index.js';
import { walletService } from '../../services/wallet/index.js';
import { transactionQueue } from '../queue/TransactionQueue.js';
import { db } from '../../core/database.js'; // MongoDB instance

class FlipperMode extends EventEmitter {
  constructor() {
    super();

    // State management
    this.openPositions = new Map();
    this.positionStats = new Map();
    this.blacklistedTokens = new Set();
    this.priceWebsockets = new Map();

    // MongoDB collections (initialized lazily)
    this.userMetricsCollection = null;
    this.systemMetricsCollection = null;

    // Queue for processing new tokens
    this.tokenQueue = new PQueue({
      concurrency: 1,
      interval: 500,
      intervalCap: 1,
    });

    // Configuration
    this.config = {
      minLiquidity: 5, // SOL
      minHolders: 100,
      maxPositions: 3,
      profitTarget: 30, // %
      stopLoss: 15, // %
      timeLimit: 15 * 60 * 1000, // 15 minutes
      gasBuffer: 0.01, // SOL
      buyAmount: 0.1, // SOL per trade
    };

    // Runtime state
    this.isRunning = false;
    this.userId = null;
    this.walletAddress = null;

    // Indicates whether the class is initialized
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Get the initialized database instance
      const database = db.getDatabase(); 

      // Initialize MongoDB collections
      this.userMetricsCollection = database.collection('userMetrics');
      this.systemMetricsCollection = database.collection('systemMetrics');

      // Register with the monitoring system
      monitoringSystem.registerComponent('flipperMode', {
        getMetrics: this.collectMetrics.bind(this),
        getHealth: () => ({ status: this.isRunning ? 'healthy' : 'stopped' }),
      });

      // Start periodic snapshots for system metrics
      this.snapshotSystemMetrics();

      this.initialized = true;
      console.log('FlipperMode initialized successfully.');
    } catch (error) {
      console.error('Error during FlipperMode initialization:', error);
      throw error;
    }
  }

  snapshotSystemMetrics() {
    setInterval(async () => {
      try {
        if (!this.systemMetricsCollection) return;

        const aggregatedMetrics = await this.systemMetricsCollection.aggregate([
          {
            $group: {
              _id: null,
              totalTrades: { $sum: '$totalTrades' },
              totalProfit: { $sum: '$totalProfit' },
              profitableTrades: { $sum: '$profitableTrades' },
            },
          },
        ]).toArray();

        const snapshot = {
          timestamp: new Date(),
          totalTrades: aggregatedMetrics[0]?.totalTrades || 0,
          totalProfit: aggregatedMetrics[0]?.totalProfit || 0,
          profitableTrades: aggregatedMetrics[0]?.profitableTrades || 0,
        };

        await db.getDatabase().collection('systemMetricsSnapshots').insertOne(snapshot);
        console.log('System metrics snapshot saved successfully.');
      } catch (error) {
        console.error('Error saving system metrics snapshot:', error);
      }
    }, 600000); // Snapshot every hour
  }

  async start(userId, walletAddress, customConfig = {}) {
    // Ensure the class is initialized before starting
    if (!this.initialized) {
      throw new Error('FlipperMode must be initialized before starting.');
    }

    // Wrap execution in a circuit breaker to prevent excessive failures
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        if (this.isRunning) {
          throw new Error('FlipperMode is already running.');
        }

        try {
          console.log('Starting FlipperMode...');
          const wallet = await walletService.getWallet(userId, walletAddress);

          if (!wallet) {
            throw new Error('Wallet not found. Please ensure the wallet address is correct.');
          }

          const balance = await walletService.getBalance(userId, walletAddress);
          const requiredBalance =
            this.config.maxPositions * (this.config.buyAmount + this.config.gasBuffer);

          if (balance < requiredBalance) {
            throw new Error(`Insufficient balance. You need at least ${requiredBalance} SOL.`);
          }

          if (wallet.type === 'walletconnect') {
            const user = await User.findOne({ telegramId: userId.toString() }).lean();
            if (!user?.settings?.trading?.autonomousEnabled) {
              throw new Error('Autonomous trading is disabled. Enable it in your wallet settings.');
            }
          }

          this.config = { ...this.config, ...customConfig };
          this.userId = userId;
          this.walletAddress = walletAddress;
          this.isRunning = true;

          await this.setupPriceMonitoring();

          this.emit('started', { userId, walletAddress, config: this.config, wallet: wallet.type });
          console.log('FlipperMode started successfully.');
          return { action: 'start', config: this.config };
        } catch (error) {
          console.error('Error starting FlipperMode:', error);
          this.cleanup();
          throw error;
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }
  
  async stop(bot, userId) {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        if (!this.isRunning) return;
  
        try {
          // Clear token queue
          this.tokenQueue.clear();
  
          // Close all positions
          const closePromises = Array.from(this.openPositions.values()).map(async (position) => {
            try {
              await this.closePosition(position.token.address, 'manual_stop');
            } catch (error) {
              // Handle the error and notify the user
              const message = `🚨 *Trade Closure Failed* 🚨\n` +
                `- Token: ${position.token.name} (${position.token.address})\n` +
                `- Reason: ${error.message || 'Unknown error'}\n` +
                `Please check the trade manually.`;
  
              console.error(`Failed to close position for ${position.token.name}:`, error);
  
              // Send the message to the user via the bot
              if (bot && userId) {
                try {
                  await bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
                } catch (botError) {
                  console.error('Failed to send notification via bot:', botError);
                }
              }
  
              // Log the error for further inspection
              await ErrorHandler.handle(error, bot, userId);
            }
          });
  
          await Promise.allSettled(closePromises);
  
          // Calculate final stats
          const stats = this.calculateStats();
  
          // Cleanup
          this.cleanup();
  
          this.emit('stopped', { stats });
  
          return {
            action: 'stop',
            stats
          };
        } catch (error) {
          // Log and handle the overall error
          await ErrorHandler.handle(error, bot, userId); // Log and notify
          console.error('Error occurred while stopping FlipperMode:', error);
          this.cleanup();
          this.emit('error', error);
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }  

  /**
   * Save live system metrics and dynamically adjust PQueue based on system load.
   * 
   * Dynamically updates:
   * 1. PQueue interval to handle increased/decreased load.
   * 2. Live system metrics for real-time dashboard updates.
  */
  async saveLiveSystemMetrics() {
    try {
      // Calculate queue size and dynamically adjust PQueue interval
      const queueSize = this.tokenQueue.size;
      const baseInterval = 500; // Base interval in ms
      const additionalDelay = queueSize * 50; // Add 50ms per queued token
      this.tokenQueue.interval = Math.min(baseInterval + additionalDelay, 2000); // Cap interval to 2000ms

      // Log dynamic adjustment for monitoring/debugging purposes
      console.log(`Adjusted PQueue interval: ${this.tokenQueue.interval}ms for queue size: ${queueSize}`);

      // Prepare live system metrics
      const liveMetrics = {
        activePositions: this.openPositions.size, // Current number of open positions
        openTokens: Array.from(this.openPositions.keys()), // Tokens being actively traded
        lastUpdated: new Date(), // Timestamp for real-time metrics
      };

      // Persist live metrics to MongoDB
      await this.systemMetricsCollection.updateOne(
        { _id: 'live' }, // Identifier for live metrics
        { $set: liveMetrics }, // Replace or update with new metrics
        { upsert: true } // Create document if it doesn't exist
      );

      // Log successful update
      console.log('Live system metrics saved successfully.');
    } catch (error) {
      // Log any errors that occur during metrics saving
      console.error('Error saving live system metrics:', error);
    }
  }

  async processNewToken(token) {
    await this.saveLiveSystemMetrics(); // Save live metrics during processing
  
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        if (!this.shouldProcessToken(token)) {
          return;
        }
  
        return this.tokenQueue.add(async () => {
          try {
            const wallet = await walletService.getWallet(this.userId, this.walletAddress);
  
            // For external wallets, request approval first
            if (wallet.type === 'walletconnect') {
              const approvalStatus = await walletService.checkAndRequestApproval(
                token.address,
                this.walletAddress,
                this.config.buyAmount
              );
  
              if (!approvalStatus.approved) {
                throw new Error('Token approval required');
              }
            }
  
            // Queue the buy transaction
            const txResult = await transactionQueue.addTransaction({
              id: `flip_buy_${token.address}_${Date.now()}`,
              type: 'buy',
              network: 'solana',
              userId: this.userId,
              tokenAddress: token.address,
              amount: this.config.buyAmount,
              priority: 1,
              requiresApproval: wallet.type === 'walletconnect',
            });
  
            // Track position
            const position = {
              token,
              entryPrice: txResult.price,
              amount: txResult.amount,
              entryTime: Date.now(),
              txHash: txResult.hash,
              walletType: wallet.type,
            };
  
            this.openPositions.set(token.address, position);
            await this.monitorPosition(position);
  
            this.emit('entryExecuted', { token, result: txResult });
          } catch (error) {
            console.error('Error processing token:', error);
  
            // Log the error using the custom ErrorHandler
            await ErrorHandler.handle(error, null, this.userId);
  
            // Blacklist the token and emit an error event
            // this.blacklistedTokens.add(token.address);
            this.emit('error', error);
          }
        });
      },
      BREAKER_CONFIGS.pumpfun
    );
  }  

  shouldProcessToken(token) {
    if (!this.isRunning || 
        token.network !== 'solana' ||
        token.liquidity < this.config.minLiquidity ||
        token.holders < this.config.minHolders ||
        this.openPositions.has(token.address) ||
        this.openPositions.size >= this.config.maxPositions ||
        this.blacklistedTokens.has(token.address)) {
      return false;
    }
    return true;
  }

  async monitorPosition(position) {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        try {
          // Subscribe to price updates
          const ws = await dextools.subscribeToPriceUpdates(
            'solana',
            position.token.address,
            (price) => this.updatePosition(position.token.address, price)
          );

          this.priceWebsockets.set(position.token.address, ws);

          // Set position timeout
          setTimeout(() => {
            this.closePosition(position.token.address, 'timeout')
              .catch(error => console.error('Error closing position on timeout:', error));
          }, this.config.timeLimit);

        } catch (error) {
          await ErrorHandler.handle(error, null, this.userId); // Log and notify
          console.warn('Error monitoring position:', error);
          this.emit('error', error);
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }

  async updatePosition(tokenAddress, currentPrice) {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        const position = this.openPositions.get(tokenAddress);
        if (!position) return;

        try {
          // Update position stats
          const stats = this.positionStats.get(tokenAddress) || {
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            highPrice: position.entryPrice,
            lowPrice: position.entryPrice,
            updates: 0
          };

          stats.currentPrice = currentPrice;
          stats.highPrice = Math.max(stats.highPrice, currentPrice);
          stats.lowPrice = Math.min(stats.lowPrice, currentPrice);
          stats.updates++;
          this.positionStats.set(tokenAddress, stats);

          // Calculate profit/loss
          const profitLoss = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

          // Check exit conditions
          if (profitLoss >= this.config.profitTarget) {
            await this.closePosition(tokenAddress, 'take_profit');
          } else if (profitLoss <= -this.config.stopLoss) {
            await this.closePosition(tokenAddress, 'stop_loss');
          }
        } catch (error) {
          await ErrorHandler.handle(error, null, this.userId); // Log and notify
          console.warn('Error updating position:', error);
          this.emit('error', error);
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }

  async closePosition(tokenAddress, reason = 'manual') {
    return circuitBreakers.executeWithBreaker(
      'pumpfun',
      async () => {
        const position = this.openPositions.get(tokenAddress);
        if (!position) return;
  
        try {
          const wallet = await walletService.getWallet(this.userId, this.walletAddress);
  
          // For external wallets, check if pre-approved
          if (wallet.type === 'walletconnect' && !position.preApproved) {
            const approvalStatus = await walletService.checkAndRequestApproval(
              tokenAddress,
              this.walletAddress,
              position.amount
            );
  
            if (!approvalStatus.approved) {
              throw new Error('Token approval required for selling');
            }
            position.preApproved = true;
          }
  
          // Queue the sell transaction
          const result = await transactionQueue.addTransaction({
            id: `flip_sell_${tokenAddress}_${Date.now()}`,
            type: 'sell',
            network: 'solana',
            userId: this.userId,
            tokenAddress,
            amount: position.amount,
            priority: 2, // Higher priority for exits
          });
  
          // Update position stats
          const stats = this.positionStats.get(tokenAddress);
          if (stats) {
            stats.exitPrice = result.price;
            stats.exitTime = Date.now();
            stats.reason = reason;
            stats.profitLoss = ((result.price - position.entryPrice) / position.entryPrice) * 100;
          }
  
          // Normalize metrics
          const normalizedMetrics = {
            ...this.calculateMetricsForPosition(stats),
            avgHoldTime: parseFloat(stats.avgHoldTime.toFixed(2)), // Normalize to 2 decimal places
          };
  
          // Save metrics to MongoDB
          await this.saveUserMetrics(this.userId, normalizedMetrics);
          await this.saveSystemMetrics(normalizedMetrics);
  
          // Cleanup
          this.openPositions.delete(tokenAddress);
          const ws = this.priceWebsockets.get(tokenAddress);
          if (ws) {
            ws.close();
            this.priceWebsockets.delete(tokenAddress);
          }
  
          this.emit('exitExecuted', {
            token: position.token,
            reason,
            result,
            stats,
          });
  
          return result;
        } catch (error) {
          await ErrorHandler.handle(error, null, this.userId);
          console.error('Error closing position:', error);
          this.emit('error', error);
        }
      },
      BREAKER_CONFIGS.pumpfun
    );
  }  

  calculateMetricsForPosition(position) {
    const profit = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100;
    return {
      totalTrades: 1,
      profitable: profit > 0 ? 1 : 0,
      totalProfit: profit,
      avgHoldTime: (position.exitTime - position.entryTime) / 60000, // in minutes
    };
  }

  async saveUserMetrics(userId, stats) {
    try {
      await this.userMetricsCollection.updateOne(
        { userId },
        {
          $set: {
            userId,
            lastUpdated: new Date(),
          },
          $inc: {
            totalTrades: stats.totalTrades,
            profitableTrades: stats.profitable,
            totalProfit: stats.totalProfit,
            avgHoldTime: stats.avgHoldTime * stats.totalTrades, // For aggregated calculation later
          },
        },
        { upsert: true }
      );
    } catch (error) {
        console.warn('Error saving user metrics:', error);
        monitoringSystem.reportCriticalError({
        component: 'FlipperMode',
        message: 'Failed to save user ' + userId + 'trade metrics',
        error,
      });
    }
  }

  async saveSystemMetrics(stats) {
    try {
      await this.systemMetricsCollection.updateOne(
        { _id: 'global' },
        {
          $set: { lastUpdated: new Date() },
          $inc: {
            totalTrades: stats.totalTrades,
            profitableTrades: stats.profitable,
            totalProfit: stats.totalProfit,
            totalHoldTime: stats.avgHoldTime * stats.totalTrades, // For aggregated calculation later
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving system metrics:', error);
      monitoringSystem.reportCriticalError({
        component: 'FlipperMode',
        message: 'Failed to save system metrics',
        error,
      });
    }
  }

  getOpenPositions() {
    return Array.from(this.openPositions.values()).map(position => {
      const stats = this.positionStats.get(position.token.address);
      return {
        ...position,
        currentPrice: stats?.currentPrice || position.entryPrice,
        profitLoss: stats ? ((stats.currentPrice - position.entryPrice) / position.entryPrice) * 100 : 0,
        timeElapsed: Math.floor((Date.now() - position.entryTime) / 60000) // minutes
      };
    });
  }

  calculateStats() {
    const stats = {
      totalTrades: this.positionStats.size,
      profitable: 0,
      totalProfit: 0,
      avgHoldTime: 0,
      bestTrade: 0,
      worstTrade: 0
    };

    for (const [_, position] of this.positionStats) {
      if (!position.exitPrice) continue;

      const profit = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100;
      
      if (profit > 0) stats.profitable++;
      stats.totalProfit += profit;
      stats.avgHoldTime += (position.exitTime - position.entryTime);
      stats.bestTrade = Math.max(stats.bestTrade, profit);
      stats.worstTrade = Math.min(stats.worstTrade, profit);
    }

    if (stats.totalTrades > 0) {
      stats.avgHoldTime = Math.floor(stats.avgHoldTime / (stats.totalTrades * 60000)); // minutes
      stats.winRate = (stats.profitable / stats.totalTrades) * 100;
      stats.avgProfit = stats.totalProfit / stats.totalTrades;
    }

    return stats;
  }

  /**
 * Fetch aggregated metrics for dashboard consumption.
 * @returns {Object} Aggregated metrics including user and system-level stats.
 */
async fetchMetrics() {
  try {
    // Ensure collections are initialized
    if (!this.userMetricsCollection || !this.systemMetricsCollection) {
      throw new Error('Metrics collections are not initialized.');
    }

    // Fetch user metrics
      const userMetrics = await this.userMetricsCollection.find({}).toArray();
      if (!userMetrics) {
        console.warn('No user metrics found.');
      }

      // Fetch system metrics
      const systemMetrics = await this.systemMetricsCollection.findOne({ _id: 'global' });
      if (!systemMetrics) {
        console.warn('No system metrics found.');
      }

      // Prepare live metrics
      const liveMetrics = {
        activePositions: this.openPositions.size || 0,
        tokensBeingTracked: Array.from(this.openPositions.keys()) || [],
        lastSnapshot: systemMetrics?.lastUpdated || new Date(),
      };

      // Aggregate system metrics
      const aggregatedSystemMetrics = {
        totalTrades: systemMetrics?.totalTrades || 0,
        totalProfit: systemMetrics?.totalProfit || 0,
        profitableTrades: systemMetrics?.profitableTrades || 0,
        averageHoldTime: systemMetrics?.totalHoldTime
          ? (systemMetrics.totalHoldTime / systemMetrics.totalTrades).toFixed(2)
          : 0,
        winRate: systemMetrics?.totalTrades
          ? ((systemMetrics.profitableTrades / systemMetrics.totalTrades) * 100).toFixed(2)
          : 0,
        lastUpdated: systemMetrics?.lastUpdated || new Date(),
      };

      // Map user-level metrics
      const userLevelMetrics = (userMetrics || []).map((userMetric) => ({
        userId: userMetric.userId,
        totalTrades: userMetric.totalTrades || 0,
        profitableTrades: userMetric.profitableTrades || 0,
        totalProfit: userMetric.totalProfit || 0,
        averageHoldTime: userMetric.avgHoldTime || 0,
        winRate: userMetric.totalTrades
          ? ((userMetric.profitableTrades / userMetric.totalTrades) * 100).toFixed(2)
          : 0,
        lastUpdated: userMetric.lastUpdated || new Date(),
      }));

      // Combine all metrics into a single object
      const combinedMetrics = {
        systemMetrics: aggregatedSystemMetrics,
        liveMetrics: liveMetrics,
        userMetrics: userLevelMetrics,
      };

      console.log('Fetched metrics successfully:', combinedMetrics);
      return combinedMetrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw new Error('Failed to fetch metrics. Please check the collections or database connection.');
    }
  }

  cleanup() {
    // Stop monitoring
    this.isRunning = false;
    this.userId = null;
    this.walletAddress = null;

    // Clear queues and caches
    this.tokenQueue.clear();
    this.openPositions.clear();
    this.positionStats.clear();
    this.blacklistedTokens.clear();

    // Close websockets
    for (const ws of this.priceWebsockets.values()) {
      ws.close();
    }
    this.priceWebsockets.clear();

    // Remove from monitoring
    monitoringSystem.unregisterComponent('flipperMode');

    // Clear listeners
    this.removeAllListeners();
  }
}

export const flipperMode = new FlipperMode();

// Handle cleanup on process termination
process.on('SIGINT', () => {
  flipperMode.cleanup();
});

process.on('SIGTERM', () => {
  flipperMode.cleanup();
});