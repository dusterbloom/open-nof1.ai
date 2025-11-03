/**
 * Retry utility with exponential backoff
 *
 * Retries a function up to maxRetries times with exponential backoff.
 * Only retries on transient errors (network, timeout, 5xx).
 * Does NOT retry on client errors (4xx, validation errors).
 */

interface RetryOptions {
  maxRetries?: number; // Default: 3
  initialDelayMs?: number; // Default: 100
  maxDelayMs?: number; // Default: 5000
  exponentialBase?: number; // Default: 2
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = Number(process.env.MAX_RETRIES) || 3,
    initialDelayMs = Number(process.env.INITIAL_RETRY_DELAY_MS) || 100,
    maxDelayMs = Number(process.env.MAX_RETRY_DELAY_MS) || 5000,
    exponentialBase = 2,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(exponentialBase, attempt),
        maxDelayMs
      );

      console.warn(
        `[RETRY] Attempt ${attempt + 1}/${maxRetries} failed. ` +
          `Retrying in ${delay}ms... Error: ${error.message || error}`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable
 * Retries on: network errors, timeouts, 5xx server errors
 * Does NOT retry on: 4xx client errors, validation errors
 */
function isRetryableError(error: any): boolean {
  // Network errors (connection refused, timeout, etc.)
  if (
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ENOTFOUND" ||
    error.message?.includes("timeout") ||
    error.message?.includes("network")
  ) {
    return true;
  }

  // CCXT errors
  if (error.constructor?.name === "NetworkError") {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // HTTP 429 (rate limit) - should retry with backoff
  if (error.status === 429) {
    return true;
  }

  // Do NOT retry on 4xx client errors (bad request, auth, etc.)
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false;
  }

  // Default: retry if unsure (safe approach)
  return true;
}
