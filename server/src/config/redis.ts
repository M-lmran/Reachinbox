import IORedis from 'ioredis';
import { env } from './env';

// BullMQ requires maxRetriesPerRequest = null on the connection it uses.
export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Separate connection for application-level operations (rate limiting, health).
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

export async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
