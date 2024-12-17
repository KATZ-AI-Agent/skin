export * from './Monitor.js';

// Set up monitoring event handlers
import { monitoringSystem } from './Monitor.js';
import { bot } from '../bot.js';

// Handle critical errors
monitoringSystem.on('criticalError', async ({ services, health }) => {
  console.error('Critical service failure:', services);
  
  // Notify admin
  try {
    await bot.sendMessage(
      process.env.ADMIN_CHAT_ID,
      `🚨 *Critical Service Failure*\n\n` +
      `Services: ${services.join(', ')}\n\n` +
      `Health Report:\n${JSON.stringify(health, null, 2)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error notifying admin:', error);
  }
});

// Handle performance warnings
monitoringSystem.on('performanceWarning', async (warning) => {
  console.warn('Performance warning:', warning);
  
  try {
    await bot.sendMessage(
      process.env.ADMIN_CHAT_ID,
      `⚠️ *Performance Warning*\n\n` +
      `Type: ${warning.type}\n` +
      `Value: ${warning.value}\n` +
      `Threshold: ${warning.threshold}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error notifying admin:', error);
  }
});

// Log metrics collection
monitoringSystem.on('metricsCollected', (metrics) => {
  console.log('Metrics collected:', metrics);
});

// Log health checks
monitoringSystem.on('healthCheck', (health) => {
  console.log('Health check results:', health);
});