import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  mapConcurrent,
  handleRateLimitHeaders,
  getRateLimitStatus,
  setRateLimitResetTimestamp,
  clearGitHubCache,
  GitHubRateLimitError,
} from '../github.ts';

describe('GitHub Rate Limit and Concurrency Protections', () => {
  beforeEach(() => {
    clearGitHubCache();
  });

  describe('mapConcurrent', () => {
    it('handles empty input array', async () => {
      const results = await mapConcurrent([], 3, async (x) => x);
      assert.deepStrictEqual(results, []);
    });

    it('preserves array order regardless of item resolution timing', async () => {
      const items = [100, 10, 50, 5, 20];
      const results = await mapConcurrent(items, 2, async (val) => {
        await new Promise((r) => setTimeout(r, val));
        return `done-${val}`;
      });

      assert.deepStrictEqual(results, [
        'done-100',
        'done-10',
        'done-50',
        'done-5',
        'done-20',
      ]);
    });

    it('strictly respects the concurrency limit', async () => {
      let active = 0;
      let maxActive = 0;
      const items = Array.from({ length: 15 }, (_, i) => i);
      const concurrencyLimit = 3;

      await mapConcurrent(items, concurrencyLimit, async () => {
        active++;
        if (active > maxActive) {
          maxActive = active;
        }
        await new Promise((r) => setTimeout(r, 20));
        active--;
      });

      assert.ok(maxActive <= concurrencyLimit, `Expected maxActive <= ${concurrencyLimit}, got ${maxActive}`);
      assert.strictEqual(active, 0);
    });
  });

  describe('handleRateLimitHeaders', () => {
    it('returns null on normal non-rate-limit 403 errors (e.g. permission denied)', () => {
      const headers = new Headers({
        'x-ratelimit-remaining': '4900',
        'x-ratelimit-reset': '1790967000',
      });
      const res = { status: 403, headers };
      const result = handleRateLimitHeaders(res, 'Resource not accessible by personal access token');
      assert.strictEqual(result, null);
    });

    it('handles explicit retry-after header on secondary rate limit or 429', () => {
      const headers = new Headers({
        'x-ratelimit-remaining': '4750',
        'x-ratelimit-reset': '1790967001', // Primary window 1 hour away
        'retry-after': '30',
      });
      const res = { status: 403, headers };
      const before = Date.now();
      const result = handleRateLimitHeaders(res, 'You have exceeded a secondary rate limit.');

      assert.ok(result !== null);
      assert.strictEqual(result.isRateLimit, true);
      assert.strictEqual(result.isSecondary, true);
      // resetAt should be ~30 seconds from now, NOT 1 hour away!
      const diffMs = result.resetAt.getTime() - before;
      assert.ok(diffMs >= 29000 && diffMs <= 32000, `Expected ~30s delay, got ${diffMs}ms`);
    });

    it('cools down for 60s (NOT 1 hour) when secondary rate limit has no retry-after header', () => {
      const headers = new Headers({
        'x-ratelimit-remaining': '4750', // Still has quota!
        'x-ratelimit-reset': '1790999999', // 1 hour away
      });
      const res = { status: 403, headers };
      const before = Date.now();
      const result = handleRateLimitHeaders(res, 'You have exceeded a secondary rate limit. Please wait.');

      assert.ok(result !== null);
      assert.strictEqual(result.isSecondary, true);
      // Must NOT use x-ratelimit-reset (1790999999). Must use 60s cooldown!
      const diffMs = result.resetAt.getTime() - before;
      assert.ok(diffMs >= 59000 && diffMs <= 62000, `Expected ~60s cooldown, got ${diffMs}ms`);
    });

    it('uses x-ratelimit-reset when primary quota is actually exhausted (remaining === 0)', () => {
      const resetEpochSec = Math.floor(Date.now() / 1000) + 1800; // 30 mins
      const headers = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpochSec),
      });
      const res = { status: 403, headers };
      const result = handleRateLimitHeaders(res, 'API rate limit exceeded');

      assert.ok(result !== null);
      assert.strictEqual(result.isSecondary, false);
      assert.strictEqual(result.resetAt.getTime(), resetEpochSec * 1000);
    });

    it('detects 429 status code as rate limit', () => {
      const headers = new Headers({
        'retry-after': '45',
      });
      const res = { status: 429, headers };
      const result = handleRateLimitHeaders(res, 'Too Many Requests');

      assert.ok(result !== null);
      assert.strictEqual(result.isRateLimit, true);
      assert.strictEqual(result.isSecondary, true);
    });
  });

  describe('getRateLimitStatus and clearGitHubCache', () => {
    it('returns isRateLimited = true when reset timestamp is in the future', () => {
      const future = Date.now() + 120000; // 2 minutes
      setRateLimitResetTimestamp(future);

      const status = getRateLimitStatus();
      assert.strictEqual(status.isRateLimited, true);
      assert.ok(status.resetAt !== null);
      assert.strictEqual(status.resetMinutes, 2);
    });

    it('clears rate limit and caches when clearGitHubCache is invoked', () => {
      setRateLimitResetTimestamp(Date.now() + 600000);
      assert.strictEqual(getRateLimitStatus().isRateLimited, true);

      clearGitHubCache();
      const status = getRateLimitStatus();
      assert.strictEqual(status.isRateLimited, false);
      assert.strictEqual(status.resetAt, null);
    });

    it('GitHubRateLimitError records whether the limit was secondary or primary', () => {
      const resetDate = new Date(Date.now() + 60000);
      const err = new GitHubRateLimitError('Secondary limit', resetDate, true);
      assert.strictEqual(err.isSecondary, true);
      assert.strictEqual(err.resetMinutes, 1);
    });
  });
});
