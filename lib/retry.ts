/**
 * Retry utility with exponential backoff for storage operations.
 * Used by the heartbeat system to handle transient network/Supabase failures.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 10000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 to randomize delay (default: 0.3) */
  jitter?: number;
  /** Called on each retry with attempt number and error */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Retries an async function with exponential backoff.
 * Returns the result on success, or throws on final failure.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = 0.3,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) {
        break;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitterAmount = exponentialDelay * jitter * Math.random();
      const delay = Math.min(exponentialDelay + jitterAmount, maxDelayMs);

      onRetry?.(attempt + 1, err);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wraps a function with retry logic, returning { success, data, error } 
 * instead of throwing. Useful for heartbeat operations where we want 
 * to track success/failure without try/catch at every call site.
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<{ success: boolean; data?: T; error?: unknown }> {
  try {
    const data = await retryWithBackoff(fn, options);
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
