import { RateLimiter } from './RateLimiter.js';

// Rate limiter configurations
const RATE_LIMITS = {
  messages: {
    windowMs: 60000,  // 1 minute window
    max: 300         // 300 messages per window
  },
  trades: {
    windowMs: 300000, // 5 minute window
    max: 100         // 100 trades per window
  },
  alerts: {
    windowMs: 60000,  // 1 minute window
    max: 500         // 500 alerts per window
  },
  scans: {
    windowMs: 60000,  // 1 minute window
    max: 100         // 100 scans per window
  },
  polling: {
    windowMs: 60000,  // 1 minute window
    max: 600         // 600 polls per window
  },
  callback: {
    windowMs: 60000,  // 1 minute window
    max: 300         // 300 callbacks per window
  }
};

// Create rate limiters map
const limiters = new Map();

// Get or create rate limiter for action
function getLimiter(action) {
  if (!limiters.has(action)) {
    const config = RATE_LIMITS[action] || RATE_LIMITS.messages;
    const limiter = new RateLimiter(config);
    limiters.set(action, limiter);
  }
  return limiters.get(action);
}

// Check rate limit for user and action
export async function checkRateLimit(userId, action) {
  const limiter = getLimiter(action);
  return limiter.isRateLimited(userId, action);
}

// Export configurations and types
export { RATE_LIMITS };