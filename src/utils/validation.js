import { ErrorTypes } from '../core/errors/ErrorTypes.js';

export function validateConfig(config) {
  const requiredFields = [
    'botToken',
    'openaiApiKey',
    'mongoUri',
    'mongoEncryptionKey'
  ];

  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new Error(ErrorTypes.VALIDATION_ERROR, 
      `Missing required configuration: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }

  return true;
}

export function validateTradeParams(params) {
  const required = ['action', 'tokenAddress', 'amount', 'walletAddress'];
  const missing = required.filter(field => !params[field]);

  if (missing.length > 0) {
    throw new Error(ErrorTypes.VALIDATION_ERROR,
      `Missing required trade parameters: ${missing.join(', ')}`,
      { missing }
    );
  }

  return true;
}