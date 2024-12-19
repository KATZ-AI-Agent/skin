import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import { healthMonitor } from '../health/HealthMonitor.js';
import { rateLimiter } from '../rate-limiting/RateLimiter.js';
import { walletService } from '../../services/wallet/index.js';
import { pumpFunService } from '../../services/pumpfun/index.js';
import { gemsService } from '../../services/gems/GemsService.js';
import { priceAlertService } from '../../services/priceAlerts.js';
import { timedOrderService } from '../../services/timedOrders.js';
import { aiMetricsService } from '../../services/aiMetricsService.js';
import { flipperMode } from '../../services/pumpfun/FlipperMode.js';
import { config } from '../config.js';
import { User } from '../../models/User.js';
import { ErrorHandler } from '../errors/index.js';
import os from 'os';

const app = express();

// WebSocket setup
const wsServer = new WebSocketServer({ noServer: true });
const websocketClients = new Set();

wsServer.on('connection', (socket) => {
  websocketClients.add(socket);
  socket.on('close', () => websocketClients.delete(socket));
});

function broadcastUpdate(data) {
  const message = JSON.stringify(data);
  websocketClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Unified chart generation
async function generateChart(chartConfig) {
  try {
    const quickChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify(chartConfig)
    )}`;
    const response = await fetch(quickChartUrl);
    if (!response.ok) throw new Error('QuickChart.io request failed');
    return await response.buffer();
  } catch (primaryError) {
    console.error('Primary chart generation failed:', primaryError);
    return null;
  }
}

// Metrics fetching
async function fetchMetrics() {
  try {
    const activeUsers = await User.countDocuments({ isActive: true });
    const [
      pumpFunMetrics,
      priceAlertMetrics,
      timedOrderMetrics,
      aiMetrics,
      flipperMetrics,
    ] = await Promise.allSettled([
      pumpFunService.checkHealth(),
      priceAlertService.getMetrics(),
      timedOrderService.getMetrics(),
      aiMetricsService.fetchLiveMetrics(),
      flipperMode.fetchMetrics(),
    ]);

    return {      
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      osLoadAvg: os.loadavg(),
      activeUsers,
      wallets: await walletService.fetchWalletMetrics(),
      pumpFun: pumpFunMetrics.status === 'fulfilled' ? pumpFunMetrics.value : 'Error',
      gemsToday: await gemsService.scanGems(),
      priceAlerts: priceAlertMetrics.status === 'fulfilled' ? priceAlertMetrics.value : 'Error',
      timedOrders: timedOrderMetrics.status === 'fulfilled' ? timedOrderMetrics.value : 'Error',
      aiMetrics: aiMetrics.status === 'fulfilled' ? aiMetrics.value : 'Error',
      flipperMetrics: flipperMetrics.status === 'fulfilled' ? flipperMetrics.value : 'Error',
    };
  } catch (error) {
    await ErrorHandler.handle(error);
    console.warn(error);
    return { error: 'Failed to fetch some metrics. Try again later.' };
  }
}

// Routes
app.get('/', async (req, res) => {
  try {
    const metrics = await fetchMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    await ErrorHandler.handle(error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

app.get('/health', async (req, res) => {
  try {
    const health = await healthMonitor.checkHealth();
    res.json(health);
  } catch (error) {
    console.error('Error fetching health:', error);
    await ErrorHandler.handle(error);
    res.status(500).json({ error: 'Failed to fetch health data' });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await fetchMetrics();
    res.json(metrics);
    broadcastUpdate({ type: 'metrics', data: metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    await ErrorHandler.handle(error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.get('/charts/flipper-mode', async (req, res) => {
  try {
    const flipperMetrics = await flipperMode.collectMetrics();
    const chartConfig = {
      type: 'bar',
      data: {
        labels: ['Total Trades', 'Profitable Trades', 'Average Profit (%)'],
        datasets: [
          {
            label: 'Flip Mode Stats',
            data: [
              flipperMetrics.totalTrades || 0,
              flipperMetrics.profitableTrades || 0,
              flipperMetrics.avgProfit || 0,
            ],
            backgroundColor: ['#007bff', '#28a745', '#ffc107'],
          },
        ],
      },
      options: { plugins: { title: { display: true, text: 'Flipper Statistics' } } },
    };

    const chartBuffer = await generateChart(chartConfig);
    res.set('Content-Type', 'image/png');
    res.send(chartBuffer);
  } catch (error) {
    console.error('Error generating Flip Mode chart:', error);
    await ErrorHandler.handle(error);
    res.status(500).json({ error: 'Failed to generate Flip Mode chart' });
  }
});

// Dashboard initialization
export function startMonitoringDashboard(port = config.monitoring?.dashboardPort || 3000) {
  const server = app.listen(port, () => {
    console.log(`📊 Monitoring Dashboard running on http://localhost:${port}`);
    console.log(`
      Available Endpoints:
        - Home Page:              GET /
        - Health:                 GET /health
        - Metrics:                GET /metrics
        - Flipper Metrics:        GET /metrics/flipper-mode
        - Flipper Chart:          GET /charts/flipper-mode
        - Alerts:                 POST /alerts
        - Historical Trends:      GET /charts/historical
        - Users:                  GET /user-insights/:userId
    `);
  });

  server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (ws) => {
      wsServer.emit('connection', ws, req);
    });
  });
}

// Global error handlers
process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  await ErrorHandler.handle(reason);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await ErrorHandler.handle(error);
});
