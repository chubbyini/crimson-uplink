interface RateLimitEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 60000);
    if (entry.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Check rate limit for a given identifier (e.g. User ID or IP).
 * @param identifier Unique key (e.g. UID)
 * @param limit Maximum requests allowed within window (default 15)
 * @param windowMs Window duration in milliseconds (default 60000 = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 15,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(identifier) || { timestamps: [] };

  // Filter out timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const resetMs = windowMs - (now - oldest);
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  entry.timestamps.push(now);
  memoryStore.set(identifier, entry);

  return {
    success: true,
    limit,
    remaining: limit - entry.timestamps.length,
    resetMs: windowMs,
  };
}
