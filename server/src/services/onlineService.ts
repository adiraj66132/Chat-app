import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

// When REDIS_URL is set we back presence + rate-limit buckets with Redis so the
// state is shared across Socket.IO instances (needed by the redis adapter).
// Otherwise we fall back to in-process maps for local dev.
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;

// In-process fallback maps (used only when REDIS_URL is unset).
const memoryUsers = new Map<string, Set<string>>();
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

const ONLINE_PREFIX = 'online:';
const RATE_PREFIX = 'rate:';

export function addUser(userId: string, socketId: string) {
  if (redis) {
    redis.sadd(`${ONLINE_PREFIX}${userId}`, socketId);
    return;
  }
  const sockets = memoryUsers.get(userId) || new Set();
  sockets.add(socketId);
  memoryUsers.set(userId, sockets);
}

export function removeUser(userId: string, socketId: string) {
  if (redis) {
    redis.srem(`${ONLINE_PREFIX}${userId}`, socketId);
    return;
  }
  const sockets = memoryUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) memoryUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean | Promise<boolean> {
  if (redis) {
    // ponytail: approximate — a user is online if the set has any member.
    return redis.exists(`${ONLINE_PREFIX}${userId}`).then((n) => n > 0);
  }
  return memoryUsers.has(userId);
}

export async function getOnlineUsers(): Promise<string[]> {
  if (redis) {
    const keys = await redis.keys(`${ONLINE_PREFIX}*`);
    return keys.map((k) => k.slice(ONLINE_PREFIX.length));
  }
  return Array.from(memoryUsers.keys());
}

// Returns the userId that is now fully offline (removed its last socket), or
// null if the user is still online on another device / not tracked.
export async function removeSocket(socketId: string): Promise<string | null> {
  if (redis) {
    const keys = await redis.keys(`${ONLINE_PREFIX}*`);
    for (const key of keys) {
      const userId = key.slice(ONLINE_PREFIX.length);
      const removed = await redis.srem(key, socketId);
      if (removed > 0) {
        const remaining = await redis.scard(key);
        if (remaining === 0) {
          await redis.del(key);
          return userId;
        }
        return null;
      }
    }
    return null;
  }
  for (const [userId, sockets] of memoryUsers.entries()) {
    if (sockets.has(socketId)) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        memoryUsers.delete(userId);
        return userId;
      }
      return null;
    }
  }
  return null;
}

// Per-connection sliding-window rate limiter. Shared across instances via Redis
// (INCR + PEXPIRE). Returns true if the request should be throttled.
export async function rateLimited(
  socketId: string,
  windowMs: number,
  max: number
): Promise<boolean> {
  if (redis) {
    const key = `${RATE_PREFIX}${socketId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, windowMs);
    return count > max;
  }
  const now = Date.now();
  const bucket = memoryBuckets.get(socketId);
  if (!bucket || now > bucket.resetAt) {
    memoryBuckets.set(socketId, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}
