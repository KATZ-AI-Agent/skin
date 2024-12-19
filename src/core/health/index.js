import { HealthMonitor } from './HealthMonitor.js';

export const healthMonitor = new HealthMonitor({
  checkInterval: 60000, // 1 minute
  criticalServices: ['database', 'networks', 'walletService'],
  warningThreshold: 0.8, // 80% of max rate limit
  errorThreshold: 0.95 // 95% of max rate limit
});

// Set up health check endpoints
healthMonitor.addEndpoint('/health', async () => {
  const status = await healthMonitor.checkHealth();
  return {
    status: status.critical ? 'error' : 'ok',
    services: status.services,
    timestamp: new Date()
  };
});

// Start monitoring
healthMonitor.start();