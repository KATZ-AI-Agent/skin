import { EventEmitter } from 'events';
import { aiMetricsService } from '../../services/aiMetricsService.js';
import { db } from '../database.js';
import { walletService } from '../../services/wallet/index.js';
import { pumpFunService } from '../../services/pumpfun/index.js';
import { ErrorHandler } from '../errors/index.js';
import { config } from '../config.js';

export class HealthMonitor extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.monitoringInterval = null;
    this.intervalDuration = config?.monitoringInterval || 60000; // Default to 1 minute
    this.isInitialized = false;
    this.restartAttempts = new Map(); // Track restart attempts per service
    this.maxRestartAttempts = 5; // Limit the number of restart attempts
    this.errorLogs = []; // Store error logs for reference
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔧 Initializing HealthMonitor dependencies...');
      
      // Initialize dependencies (lazy loading or setup as needed)
      await aiMetricsService.initialize()

      console.log('✅ Dependencies initialized. Setting up health checks...');
      
      // Setup health checks only after dependencies are ready
      await this.setupChecks();

      this.isInitialized = true;
      console.log('✅ HealthMonitor initialized successfully.');
    } catch (error) {
      console.error('❌ Failed to initialize HealthMonitor:', error);
      await ErrorHandler.handle(error);
    }
  }

  async setupChecks() {
    this.addCheck('database', async () => this.checkDatabaseHealth());
    this.addCheck('aiMetrics', async () => this.checkServiceHealth(aiMetricsService));
    this.addCheck('walletService', async () => walletService.checkHealth());
    this.addCheck('pumpFun', async () => pumpFunService.checkHealth());
  }  

  addCheck(name, checkFn) {
    this.services.set(name, checkFn);
  }

  async checkDatabaseHealth() {
    try {
      await db.checkHealth();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      throw new Error(`Database unreachable: ${error.message}`);
    }
  }

  async checkServiceHealth(service) {
    try {
      if (service.checkHealth) {
        return await service.checkHealth();
      }
      throw new Error(`Health check not implemented for service ${service.constructor.name}`);
    } catch (error) {
      throw new Error(`${service.constructor.name} unreachable: ${error.message}`);
    }
  }

  async checkHealth() {
    const results = {};
    for (const [name, checkFn] of this.services) {
      try {
        results[name] = await checkFn();
      } catch (error) {
        const formattedError = {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString(),
        };
  
        results[name] = formattedError;
  
        this.logError(error, `Health check failed for service: ${name}`);
        this.emit('serviceError', { service: name, error: formattedError });
  
        // Attempt to restart the service
        await this.restartService(name);
      }
    }
    return results;
  }  

  logError(error, context = null) {
    const logEntry = {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };
    this.errorLogs.push(logEntry);

    // Limit logs to prevent memory overflow
    if (this.errorLogs.length > 100) {
      this.errorLogs.shift();
    }

    console.error('🔴 Logged error:', logEntry);
  }

  async restartService(serviceName) {
    const restartCount = this.restartAttempts.get(serviceName) || 0;

    if (restartCount >= this.maxRestartAttempts) {
      console.warn(`Max restart attempts reached for service: ${serviceName}`);
      return;
    }

    console.warn(`Attempting to restart service: ${serviceName} (Attempt ${restartCount + 1})`);

    const exponentialDelay = Math.min(1000 * 2 ** restartCount, 30000);
    this.restartAttempts.set(serviceName, restartCount + 1);

    setTimeout(async () => {
      try {
        const service = this.getServiceInstance(serviceName);
        if (service && service.initialize) {
          await service.initialize();
          console.log(`✅ Service ${serviceName} restarted successfully.`);
          this.restartAttempts.delete(serviceName); // Reset restart attempts on success
        } else {
          console.error(`Restart logic not implemented for service: ${serviceName}`);
        }
      } catch (error) {
        console.error(`Failed to restart service: ${serviceName}`, error);
        await ErrorHandler.handle(error);
      }
    }, exponentialDelay);
  }

  getServiceInstance(serviceName) {
    const serviceMap = {
      database: db,
      aiMetrics: aiMetricsService,
      walletService: walletService,
      pumpFun: pumpFunService,
    };

    return serviceMap[serviceName];
  }

  async startMonitoring() {
    const executeHealthCheck = async () => {
      try {
        const health = await this.checkHealth();
        this.emit('healthCheck', health);

        // Check for critical issues
        const criticalServices = ['database', 'networks'];
        const criticalIssues = criticalServices.filter(
          (service) => health[service]?.status === 'error'
        );

        if (criticalIssues.length > 0) {
          this.emit('criticalError', {
            services: criticalIssues,
            health,
          });
        }
      } catch (error) {
        console.error('Error during health monitoring:', error);
        await ErrorHandler.handle(error);
      } finally {
        this.monitoringInterval = setTimeout(executeHealthCheck, this.intervalDuration);
      }
    };

    console.log('⏳ Starting HealthMonitor health checks...');
    await executeHealthCheck();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearTimeout(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  cleanup() {
    this.stopMonitoring();
    this.removeAllListeners();
    console.log('🧹 HealthMonitor cleaned up.');
  }
}

export const healthMonitor = new HealthMonitor();