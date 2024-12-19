import axios from 'axios';
import pRetry from 'p-retry';
import { checkRateLimit } from '../../core/rate-limiting/index.js';

const DEXTOOLS_API_KEY = 'QA2MWclN829VYyqBuCNmg5ei4vqnxtyAaHaOOzch';
const ALCHEMY_API_KEY = 'ip7ONCr6sDycSojM_PZoWawrVM_2c0RW';
const DEXTOOLS_BASE_URL = 'https://public-api.dextools.io/trial/v2';
const ALCHEMY_BASE_URL = 'https://api.g.alchemy.com/prices/v1';

// Axios instances
const dextoolsAxios = axios.create({
  baseURL: DEXTOOLS_BASE_URL,
  timeout: 30000,
  headers: {
    accept: 'application/json',
    'x-api-key': DEXTOOLS_API_KEY,
  },
});

const alchemyAxios = axios.create({
  baseURL: ALCHEMY_BASE_URL,
  timeout: 30000,
  headers: { accept: 'application/json' },
});

// Helper function to perform requests with retry and rate limiting
async function makeRequest(axiosInstance, endpoint, params = {}, userId, action) {
  return pRetry(
    async () => {
      const response = await axiosInstance.get(endpoint, { params });
      return response.data;
    },
    {
      retries: 3,
      minTimeout: 2000,
      onFailedAttempt: (error) =>
        console.warn(`Retrying ${endpoint}:`, error.message),
    }
  );
}

export async function dextoolsRequest(endpoint, params = {}, userId) {
  return makeRequest(dextoolsAxios, endpoint, params, userId, 'scans');
}

export async function alchemyRequest(endpoint, params = {}, userId) {
  return makeRequest(alchemyAxios, endpoint, params, userId, 'alerts');
}
