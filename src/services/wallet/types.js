/**
 * @typedef {Object} WalletData
 * @property {string} address - Wallet address
 * @property {string} privateKey - Encrypted private key
 * @property {string} mnemonic - Encrypted mnemonic phrase
 * @property {string} network - Network identifier
 * @property {Date} createdAt - Wallet creation timestamp
 */

/**
 * @typedef {Object} WalletBalance
 * @property {string} total - Total balance in native currency
 * @property {Object.<string, string>} tokens - Token balances by address
 */

/**
 * @typedef {Object} SignedTransaction
 * @property {string} hash - Transaction hash
 * @property {string} rawTransaction - Signed raw transaction
 */

export const WALLET_TYPES = {
  STANDARD: 'standard',
  AUTONOMOUS: 'autonomous'
};