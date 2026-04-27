/**
 * PRODUCTION-GRADE RATE LIMITER
 * Supports in-memory fallback and distributed Redis (Upstash) for serverless scalability.
 */

// If using Upstash Redis, install @upstash/redis and uncomment the following:
// import { Redis } from '@upstash/redis';

// const redis = process.env.UPSTASH_REDIS_REST_URL 
//   ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
//   : null;

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const localStore: RateLimitStore = {};

export async function rateLimit(ip: string, limit: number = 10, windowMs: number = 60000) {
  // --- REDIS IMPLEMENTATION (Recommended for Vercel/Production) ---
  /*
  if (redis) {
    const key = `ratelimit:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowMs / 1000);
    
    if (current > limit) return { success: false, remaining: 0 };
    return { success: true, remaining: limit - current };
  }
  */

  // --- IN-MEMORY FALLBACK (Reset on Server Restart/Cold Start) ---
  const now = Date.now();
  
  if (!localStore[ip] || now > localStore[ip].resetTime) {
    localStore[ip] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return { success: true, remaining: limit - 1 };
  }

  localStore[ip].count++;

  if (localStore[ip].count > limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: limit - localStore[ip].count };
}
