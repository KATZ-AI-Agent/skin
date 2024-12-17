/**
 * @typedef {Object} NetworkConfig
 * @property {string} name - Network display name
 * @property {string} rpcUrl - Network RPC endpoint URL
 * @property {number} [chainId] - Network chain ID (EVM only)
 * @property {string} [alchemyApiKey] - Alchemy API key (EVM only)
 */

/**
 * @typedef {Object} GasPrice
 * @property {string} price - Raw gas price value
 * @property {string} formatted - Formatted gas price with units
 */

/**
 * @typedef {Object} NetworkStatus
 * @property {string} network - Network identifier
 * @property {boolean} connected - Connection status
 * @property {number} blockNumber - Current block/slot number
 * @property {GasPrice} gasPrice - Current gas/fee price
 */

export const NETWORK_TYPES = {
  EVM: 'evm',
  SOLANA: 'solana'
};