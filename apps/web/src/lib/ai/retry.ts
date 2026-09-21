export interface RetryOptions<T> {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  fallbackFn?: () => Promise<T>;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Execute an async operation with exponential backoff retries and optional provider fallback.
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 8000,
    backoffFactor = 2,
    fallbackFn,
    shouldRetry = defaultShouldRetry,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const isRetryable = shouldRetry(error);

      if (attempt > maxRetries || !isRetryable) {
        if (fallbackFn) {
          console.warn(`[RetryEngine] Primary provider failed after ${attempt} attempts. Triggering fallback provider.`);
          return await fallbackFn();
        }
        throw error;
      }

      // Calculate jittered delay
      const jitter = Math.random() * 200;
      const actualDelay = Math.min(delay + jitter, maxDelayMs);

      console.warn(
        `[RetryEngine] Attempt ${attempt}/${maxRetries} failed: ${
          error instanceof Error ? error.message : String(error)
        }. Retrying in ${Math.round(actualDelay)}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      delay *= backoffFactor;
    }
  }

  throw new Error("[RetryEngine] Execution failed: max retries reached.");
}

function defaultShouldRetry(error: unknown): boolean {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Retry on rate limits (429), timeouts, or server errors (5xx)
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("overloaded") ||
    msg.includes("service unavailable") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("timeout") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("socket hang up")
  ) {
    return true;
  }

  // SDK errors often carry status/code instead of message text.
  const withStatus = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const statusNums = [withStatus.status, withStatus.statusCode]
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  if (statusNums.some((n) => n === 429 || (n >= 500 && n <= 599))) return true;
  const code = String(withStatus.code ?? "").toLowerCase();
  if (code.includes("rate_limit") || code.includes("overloaded") || code.includes("timeout") || code.includes("unavailable")) {
    return true;
  }

  return false;
}
