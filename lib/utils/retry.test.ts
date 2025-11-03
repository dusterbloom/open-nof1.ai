import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

    await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toThrow('persistent error');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry on 4xx client errors', async () => {
    const error: any = new Error('Bad Request');
    error.status = 400;
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn)).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should retry on 5xx server errors', async () => {
    const error: any = new Error('Internal Server Error');
    error.status = 500;
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on 429 rate limit errors', async () => {
    const error: any = new Error('Too Many Requests');
    error.status = 429;
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error1'))
      .mockRejectedValueOnce(new Error('error2'))
      .mockResolvedValue('success');

    const start = Date.now();
    await retryWithBackoff(fn, { initialDelayMs: 100 });
    const elapsed = Date.now() - start;

    // Should have delays: 100ms + 200ms = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxDelayMs cap', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error1'))
      .mockRejectedValueOnce(new Error('error2'))
      .mockResolvedValue('success');

    const start = Date.now();
    await retryWithBackoff(fn, {
      initialDelayMs: 1000,
      maxDelayMs: 1500,
      exponentialBase: 2
    });
    const elapsed = Date.now() - start;

    // First retry: 1000ms, second retry: capped at 1500ms (not 2000ms)
    // Total should be around 2500ms, not 3000ms
    expect(elapsed).toBeGreaterThanOrEqual(2500);
    expect(elapsed).toBeLessThan(3500);
  });

  it('should use custom shouldRetry function', async () => {
    const error = new Error('custom error');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      retryWithBackoff(fn, { shouldRetry })
    ).rejects.toThrow('custom error');

    expect(fn).toHaveBeenCalledTimes(1); // No retries
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('should retry on network errors with ECONNREFUSED', async () => {
    const error: any = new Error('Connection refused');
    error.code = 'ECONNREFUSED';
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on network errors with ETIMEDOUT', async () => {
    const error: any = new Error('Connection timed out');
    error.code = 'ETIMEDOUT';
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on 401 unauthorized errors', async () => {
    const error: any = new Error('Unauthorized');
    error.status = 401;
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn)).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should retry on CCXT NetworkError', async () => {
    // Mock CCXT NetworkError
    class NetworkError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
      }
    }

    const error = new NetworkError('Network error occurred');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use environment variables for configuration', async () => {
    // Set environment variables
    process.env.MAX_RETRIES = '2';
    process.env.INITIAL_RETRY_DELAY_MS = '50';

    const fn = vi.fn().mockRejectedValue(new Error('error'));

    await expect(retryWithBackoff(fn)).rejects.toThrow('error');

    // Should respect MAX_RETRIES from env (2), so total calls = 3 (initial + 2 retries)
    expect(fn).toHaveBeenCalledTimes(3);

    // Clean up
    delete process.env.MAX_RETRIES;
    delete process.env.INITIAL_RETRY_DELAY_MS;
  });
});
