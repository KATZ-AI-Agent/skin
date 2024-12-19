import CryptoJS from 'crypto-js';
import { config } from '../core/config.js';

const ENCRYPTION_KEY = config.mongoEncryptionKey;

// Helper function to get parsed AES key
function getParsedKey() {
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
}

// ENCRYPT FUNCTION: Simple call with AES-CBC and IV
export function encrypt(text) {
  if (!text) return null;

  try {
    const key = getParsedKey();
    const iv = CryptoJS.lib.WordArray.random(16); // Random 16-byte IV

    // Perform AES encryption
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Return combined format: IV:Ciphertext (Base64 encoded)
    const combined = `${CryptoJS.enc.Base64.stringify(iv)}:${encrypted.toString()}`;
    return combined;
  } catch (error) {
    console.error('Encryption error:', error.message || error);
    throw new Error('Failed to encrypt data');
  }
}

// DECRYPT FUNCTION: Handles both legacy and new encrypted formats
export function decrypt(ciphertext) {
  console.log('🔍 Decrypt function received ciphertext:', ciphertext);
  
  if (!ciphertext) {
    console.warn('⚠️ Empty ciphertext provided for decryption.', ciphertext);
    return null;
  }

  try {
    if (ciphertext.includes(':')) {
      // NEW FORMAT: Contains IV and Ciphertext
      const [ivBase64, encryptedData] = ciphertext.split(':');
      console.log('🔑 Parsed IV:', ivBase64);
      console.log('🔒 Encrypted Data:', encryptedData);

      const iv = CryptoJS.enc.Base64.parse(ivBase64);
      const key = getParsedKey(); // New format uses parsed key

      const bytes = CryptoJS.AES.decrypt(encryptedData, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      console.log('✅ Decrypted text:', decryptedText);

      if (!decryptedText) throw new Error('Decryption failed. Possible key mismatch.');
      return decryptedText;
    } else {
      // LEGACY FORMAT: Use the raw ENCRYPTION_KEY string directly
      console.log('🔒 Legacy decryption attempt with raw key...');
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      console.log('✅ Legacy decrypted text:', decryptedText);

      if (!decryptedText) throw new Error('Legacy decryption failed. Possible key mismatch.');
      return decryptedText;
    }
  } catch (error) {
    console.warn('❌ Decryption error:', error.message || error);
    return null; // Fail gracefully
  }
}

