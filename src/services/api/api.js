// src/services/api/api.js
import axios from 'axios';
import pRetry from 'p-retry';
import { config } from '../../core/config.js';

// Create axios instances using config
const dextoolsAxios = axios.create({
  baseURL: config.dextoolsUri,
  timeout: 30000,
  headers: {
    accept: 'application/json',
    'x-api-key': config.dextoolsApiKey
  }
});

const alchemysAxios = axios.create({
  baseURL: 'https://api.g.alchemy.com/prices/v1',
  timeout: 30000,
  headers: {
    accept: 'application/json',
    'x-api-key': config.alchemyApiKey
  }
});

// Helper function for requests with retry
async function makeRequest(axiosInstance, endpoint, params = {}, action) {
  return pRetry(
    async () => {
      const response = await axiosInstance.get(endpoint, { params });
      return response.data;
    },
    {
      retries: 3,
      minTimeout: 2000,
      onFailedAttempt: error => 
        console.warn(`Retrying ${endpoint}:`, error.message)
    }
  );
}

export async function dextoolsRequest(endpoint, params = {}) {
  return makeRequest(dextoolsAxios, endpoint, params, 'scans');
}

export async function alchemyRequest(endpoint, params = {}) {
  return makeRequest(alchemysAxios, endpoint, params, 'alerts');
}
