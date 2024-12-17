export const ErrorTypes = {
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK: 'NETWORK',
  DATABASE: 'DATABASE',
  VALIDATION: 'VALIDATION',
  AUTH: 'AUTH',
  WALLET: 'WALLET',
  API: 'API',
};

export class BaseError extends Error {
  constructor(message, type = 'DEFAULT', isCritical = false) {
    super(message);
    this.type = type;
    this.isCritical = isCritical;
  }
}

// Define specific error classes more needed for APIs
export class RateLimitError extends BaseError {
  constructor(message = 'Rate limit exceeded') {
    super(message, ErrorTypes.RATE_LIMIT, false);
  }
}

export class DatabaseError extends BaseError {
  constructor(message = 'Database error occurred') {
    super(message, ErrorTypes.DATABASE, true);
  }
}

export class NetworkError extends BaseError {
  constructor(message = 'Network error occurred') {
    super(message, ErrorTypes.NETWORK, false);
  }
}

export class WalletError extends BaseError {
  constructor(message = 'Wallet operation failed') {
    super(message, ErrorTypes.WALLET, true);
  }
}
