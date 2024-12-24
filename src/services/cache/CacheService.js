// Only for the Dexscreener Uris as some retrieve 60 results per query but valid for only 60 mins
class CacheService {
    constructor() {
      this.cache = new Map();
    }
  
    async get(key) {
      const cached = this.cache.get(key);
      if (!cached) return null;
      
      if (Date.now() > cached.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return cached.data;
    }
  
    async set(key, data, duration) {
      this.cache.set(key, {
        data,
        expiresAt: Date.now() + duration
      });
    }
  
    clear() {
      this.cache.clear();
    }
  }
  
  export const cacheService = new CacheService();
  