import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  mapConcurrent,
  handleRateLimitHeaders,
  getRateLimitStatus,
  setRateLimitResetTimestamp,
  clearGitHubCache,
  getGitHubCacheStats,
  getCachedPullRequest,
  getRepoPullRequests,
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

  describe('prDetailsCache eviction and bounded memory behavior', () => {
    it('overwrites stale updatedAt snapshots and prunes closed PRs instead of leaking', async () => {
      const originalFetch = globalThis.fetch;
      let openPrs = [
        {
          id: 1,
          number: 10,
          title: 'PR 10',
          body: 'body 10',
          state: 'open',
          draft: false,
          html_url: 'https://github.com/org/repo/pull/10',
          created_at: '2026-08-12T10:00:00Z',
          updated_at: '2026-08-12T10:00:00Z',
          head: { ref: 'feat-10', sha: 'sha10' },
          base: { ref: 'main' },
          user: { login: 'alice', avatar_url: '', html_url: '' },
        },
        {
          id: 2,
          number: 11,
          title: 'PR 11',
          body: 'body 11',
          state: 'open',
          draft: false,
          html_url: 'https://github.com/org/repo/pull/11',
          created_at: '2026-08-12T10:00:00Z',
          updated_at: '2026-08-12T10:00:00Z',
          head: { ref: 'feat-11', sha: 'sha11' },
          base: { ref: 'main' },
          user: { login: 'bob', avatar_url: '', html_url: '' },
        },
      ];

      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        const makeJsonResponse = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });

        if (url.includes('/graphql')) {
          return makeJsonResponse({
            data: {
              repository: {
                pullRequests: {
                  nodes: openPrs.map((p) => ({
                    number: p.number,
                    mergeable: 'MERGEABLE',
                    mergeStateStatus: 'CLEAN',
                  })),
                },
              },
            },
          });
        }
        if (url.includes('/pulls?state=open')) return makeJsonResponse(openPrs);
        if (url.includes('/pulls/10') && !url.includes('/comments') && !url.includes('/reviews') && !url.includes('/commits')) {
          return makeJsonResponse({ mergeable: true, mergeable_state: 'clean' });
        }
        if (url.includes('/pulls/11') && !url.includes('/comments') && !url.includes('/reviews') && !url.includes('/commits')) {
          return makeJsonResponse({ mergeable: true, mergeable_state: 'clean' });
        }
        if (url.includes('/issues/10/comments')) {
          return makeJsonResponse([
            {
              id: 500,
              user: { login: 'alice', avatar_url: '', html_url: '', type: 'User' },
              body: 'Human comment',
              created_at: '2026-08-12T10:05:00Z',
              updated_at: '2026-08-12T10:05:00Z',
              html_url: '',
              performed_via_github_app: { slug: 'some-app', name: 'Large App Metadata' },
            },
          ]);
        }
        if (url.includes('/status')) return makeJsonResponse({ state: 'success' });
        return makeJsonResponse([]);
      }) as typeof fetch;

      try {
        await getRepoPullRequests('org/repo', 'test-token', true);
        assert.strictEqual(getGitHubCacheStats().prDetailsSize, 2);
        const cached10 = getCachedPullRequest('org/repo', 10);
        assert.ok(cached10);
        assert.strictEqual('performed_via_github_app' in (cached10.comments[0] || {}), false);

        // Update PR #10's updated_at and close PR #11: cache must stay at size 1 (not grow to 3!)
        openPrs = [{ ...openPrs[0], updated_at: '2026-08-12T12:00:00Z' }];
        await getRepoPullRequests('org/repo', 'test-token', true);

        assert.strictEqual(getGitHubCacheStats().prDetailsSize, 1);
        assert.strictEqual(getCachedPullRequest('org/repo', 10)?.updated_at, '2026-08-12T12:00:00Z');
        assert.strictEqual(getCachedPullRequest('org/repo', 11), undefined);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
