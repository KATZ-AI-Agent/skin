// src/utils/encryption.js
import CryptoJS from 'crypto-js';
import { config } from '../core/config.js';

const ENCRYPTION_KEY = config.mongoEncryptionKey;

export function encrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  if (!text) {
    return null;
  }

  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(ciphertext) {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }

  if (!ciphertext) {
    return null;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}
