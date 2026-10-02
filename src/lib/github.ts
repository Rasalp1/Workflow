import type { MergeHistoryEntry, PRComment, PRCommit, PullRequest } from '../types/index.ts';
import { isBotComment } from './botDetection.ts';

export class GitHubRateLimitError extends Error {
  public resetAt: Date;
  public resetSeconds: number;
  public resetMinutes: number;
  public isSecondary: boolean;

  constructor(message: string, resetAt: Date, isSecondary = false) {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.resetAt = resetAt;
    this.isSecondary = isSecondary;
    this.resetSeconds = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
    this.resetMinutes = Math.max(1, Math.ceil(this.resetSeconds / 60));
  }
}

let rateLimitResetTimestamp: number | null = null;

export function getRateLimitStatus(): { isRateLimited: boolean; resetAt: Date | null; resetMinutes: number } {
  if (rateLimitResetTimestamp && Date.now() < rateLimitResetTimestamp) {
    const resetAt = new Date(rateLimitResetTimestamp);
    const resetMinutes = Math.max(1, Math.ceil((rateLimitResetTimestamp - Date.now()) / 60000));
    return { isRateLimited: true, resetAt, resetMinutes };
  }
  rateLimitResetTimestamp = null;
  return { isRateLimited: false, resetAt: null, resetMinutes: 0 };
}

export function setRateLimitResetTimestamp(timestamp: number | null): void {
  rateLimitResetTimestamp = timestamp;
}

export function getRateLimitResetTimestamp(): number | null {
  return rateLimitResetTimestamp;
}

// Global concurrency limiter for all outgoing GitHub requests (REST & GraphQL)
// GitHub recommends <= 10 concurrent requests; we cap at 6 to remain comfortably below limits
const MAX_CONCURRENT_GITHUB_REQUESTS = 6;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

export async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_GITHUB_REQUESTS) {
    activeRequests++;
    return;
  }
  await new Promise<void>((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

export function releaseSlot(): void {
  activeRequests--;
  if (requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (next) next();
  }
}

// In-memory short TTL cache for full repo PR responses to coalesce rapid/concurrent polls
const repoPrsCache = new Map<string, { prs: PullRequest[]; timestamp: number }>();
const REPO_CACHE_TTL_MS = 25000; // 25 seconds

// In-memory cache for detailed PR objects keyed by `${repoFullName}#${prNumber}@${updated_at}`
const prDetailsCache = new Map<string, PullRequest>();

// Merge history is loaded on demand by the right-hand drawer and has its own
const mergeHistoryCache = new Map<string, { merged: MergeHistoryEntry[]; closed: MergeHistoryEntry[]; timestamp: number }>();
const MERGE_HISTORY_CACHE_TTL_MS = 30000;

// Deduplication maps to merge concurrent in-flight requests for the same repository
const inFlightRepoFetches = new Map<string, Promise<PullRequest[]>>();
const inFlightHistoryFetches = new Map<string, Promise<{ merged: MergeHistoryEntry[]; closed: MergeHistoryEntry[] }>>();

export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseRepoFullName(repoFullName: string): [string, string] {
  if (typeof repoFullName !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
    throw new Error(`Invalid repo format "${repoFullName}". Expected "owner/repo"`);
  }
  return repoFullName.split('/') as [string, string];
}

function validatePRNumber(prNumber: number): number {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('Pull request number must be a positive integer.');
  }
  return prNumber;
}

export function clearGitHubCache() {
  repoPrsCache.clear();
  prDetailsCache.clear();
  mergeHistoryCache.clear();
  inFlightRepoFetches.clear();
  inFlightHistoryFetches.clear();
  rateLimitResetTimestamp = null;
}

export function handleRateLimitHeaders(
  res: { status: number; headers: Headers },
  errorText: string
): { isRateLimit: boolean; resetAt: Date; isSecondary: boolean } | null {
  const remaining = res.headers.get('x-ratelimit-remaining');
  const resetHeader = res.headers.get('x-ratelimit-reset');
  const retryAfterHeader = res.headers.get('retry-after');

  const isRateLimit =
    res.status === 429 ||
    remaining === '0' ||
    errorText.toLowerCase().includes('rate limit') ||
    errorText.toLowerCase().includes('secondary rate limit') ||
    errorText.toLowerCase().includes('abuse detection') ||
    errorText.toLowerCase().includes('please wait');

  if (!isRateLimit) return null;

  const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
  let resetAt: Date;
  let isSecondary = false;

  if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
    // Explicit Retry-After header takes precedence (standard for 429 and secondary limits)
    resetAt = new Date(Date.now() + retryAfterSec * 1000);
    isSecondary = true;
  } else if (remaining === '0' && resetHeader) {
    // Primary hourly quota exhausted
    const resetSec = parseInt(resetHeader, 10);
    resetAt = !isNaN(resetSec) ? new Date(resetSec * 1000) : new Date(Date.now() + 3600000);
  } else {
    // Secondary / burst rate limit without Retry-After: cool down for 60 seconds, NOT 1 hour!
    resetAt = new Date(Date.now() + 60000);
    isSecondary = true;
  }

  return { isRateLimit: true, resetAt, isSecondary };
}

async function fetchGitHubAPI(endpoint: string, token?: string, noCache = true, retryCount = 0): Promise<any> {
  const rateLimit = getRateLimitStatus();
  if (rateLimit.isRateLimited && rateLimit.resetAt) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
      rateLimit.resetAt
    );
  }

  const authToken = token || process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Workflow-Dashboard-App',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const fetchOptions: RequestInit = {
    headers,
    ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 30 } }),
  };

  await acquireSlot();
  let res: Response;
  try {
    res = await fetch(`https://api.github.com${endpoint}`, fetchOptions);
  } finally {
    releaseSlot();
  }

  const remaining = res.headers.get('x-ratelimit-remaining');
  const resetHeader = res.headers.get('x-ratelimit-reset');

  if (res.ok) {
    if (remaining === '0' && resetHeader) {
      const resetSec = parseInt(resetHeader, 10);
      if (!isNaN(resetSec)) {
        rateLimitResetTimestamp = resetSec * 1000;
      }
    }
    return res.json();
  }

  const errorText = await res.text();

  if (res.status === 403 || res.status === 429) {
    const rateLimitInfo = handleRateLimitHeaders(res, errorText);
    if (rateLimitInfo) {
      // If it's a transient burst and retry-after <= 2s (or unspecified), retry once after a short pause
      const retryAfterSec = res.headers.get('retry-after')
        ? parseInt(res.headers.get('retry-after')!, 10)
        : NaN;
      if (retryCount === 0 && (isNaN(retryAfterSec) || retryAfterSec <= 2)) {
        const backoffMs = !isNaN(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 1500;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return fetchGitHubAPI(endpoint, token, noCache, retryCount + 1);
      }

      rateLimitResetTimestamp = rateLimitInfo.resetAt.getTime();
      const mins = Math.max(1, Math.ceil((rateLimitResetTimestamp - Date.now()) / 60000));
      const desc = rateLimitInfo.isSecondary ? 'secondary/burst rate limit' : 'hourly quota';
      throw new GitHubRateLimitError(
        `GitHub API ${desc} exceeded. Resets at ${rateLimitInfo.resetAt.toLocaleTimeString()} (in ~${mins} min${mins === 1 ? '' : 's'}).`,
        rateLimitInfo.resetAt,
        rateLimitInfo.isSecondary
      );
    }
  }

  if (res.status === 401) {
    throw new Error(`GitHub authentication failed (HTTP 401): Token is invalid or expired.`);
  }

  throw new Error(`GitHub API HTTP ${res.status} for ${endpoint}: ${errorText}`);
}

async function fetchAllGitHubPages(endpoint: string, token?: string): Promise<Record<string, unknown>[]> {
  const allData: Record<string, unknown>[] = [];
  let page = 1;
  const maxPages = 5; // Cap at 500 entries per type

  while (page <= maxPages) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const pageEndpoint = `${endpoint}${separator}per_page=100&page=${page}`;
    const data = await fetchGitHubAPI(pageEndpoint, token, true).catch((err) => {
      if (err instanceof GitHubRateLimitError) throw err;
      return [];
    });
    if (!Array.isArray(data) || data.length === 0) break;
    allData.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return allData;
}

export async function getRepoPullRequests(
  repoFullName: string,
  token?: string,
  forceRefresh = false
): Promise<PullRequest[]> {
  const [owner, repo] = parseRepoFullName(repoFullName);

  // Check short TTL cache for this repo unless explicitly forced
  const cachedRepo = repoPrsCache.get(repoFullName);
  const now = Date.now();
  if (!forceRefresh && cachedRepo && now - cachedRepo.timestamp < REPO_CACHE_TTL_MS) {
    return cachedRepo.prs;
  }

  // Deduplicate in-flight fetches for the same repo
  if (!forceRefresh && inFlightRepoFetches.has(repoFullName)) {
    return inFlightRepoFetches.get(repoFullName)!;
  }

  const fetchPromise = (async () => {
    // Fetch open pull requests (1 single call)
    const prsData = await fetchGitHubAPI(`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc`, token, true);

    // Filter out PRs created by github-actions[bot]
    const validPrsData = (prsData || []).filter(
      (rawPr: Record<string, unknown>) => {
        const user = rawPr.user as { login?: string } | undefined;
        return (
          user?.login !== 'github-actions[bot]' &&
          !user?.login?.toLowerCase().includes('github-actions')
        );
      }
    );

    // Process PRs concurrently with a pool of 3 PRs at a time to prevent burst/secondary rate limits
    const pullRequests: PullRequest[] = await mapConcurrent(
      validPrsData,
      3,
      async (rawPr: Record<string, unknown>) => {
      const prNumber = rawPr.number as number;
      const updatedAt = (rawPr.updated_at as string) || '';
      const cacheKey = `${repoFullName}#${prNumber}@${updatedAt}`;

      // If PR sub-resources are already cached for this exact updatedAt, reuse them!
      if (!forceRefresh && prDetailsCache.has(cacheKey)) {
        return prDetailsCache.get(cacheKey)!;
      }

      const head = rawPr.head as { ref: string; sha: string };
      const base = rawPr.base as { ref: string };
      const user = rawPr.user as { login: string; avatar_url: string; html_url: string };

      // Fetch single PR details, issue comments, inline review comments, PR reviews & PR commits in parallel
      const [singlePrDetails, issueComments, reviewComments, prReviews, combinedStatus, prCommits] = await Promise.all([
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`, token, true).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return null;
        }),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return [];
        }),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, token).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return [];
        }),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return [];
        }),
        fetchGitHubAPI(`/repos/${owner}/${repo}/commits/${head.sha}/status`, token, true).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return null;
        }),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`, token).catch((err) => {
          if (err instanceof GitHubRateLimitError) throw err;
          return [];
        }),
      ]);

      const formattedCommits: PRCommit[] = (prCommits || []).map((c: Record<string, unknown>) => {
        const commitObj = (c.commit as Record<string, unknown>) || {};
        const authorObj = (commitObj.author as Record<string, string>) || {};
        const committerObj = (commitObj.committer as Record<string, string>) || {};
        return {
          sha: (c.sha as string) || '',
          author_date: authorObj.date || '',
          committer_date: committerObj.date || authorObj.date || '',
          message: (commitObj.message as string) || '',
        };
      });

      const formattedIssueComments: PRComment[] = (issueComments || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        user: {
          login: (c.user as { login: string })?.login || 'unknown',
          avatar_url: (c.user as { avatar_url: string })?.avatar_url || '',
          html_url: (c.user as { html_url: string })?.html_url || '',
          type: (c.user as { type?: string })?.type,
        },
        body: (c.body as string) || '',
        created_at: (c.created_at as string) || new Date().toISOString(),
        updated_at: (c.updated_at as string) || new Date().toISOString(),
        html_url: (c.html_url as string) || '',
        is_review_comment: false,
        performed_via_github_app: (c.performed_via_github_app as Record<string, unknown>) || null,
      }));

      const formattedReviewComments: PRComment[] = (reviewComments || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        user: {
          login: (c.user as { login: string })?.login || 'unknown',
          avatar_url: (c.user as { avatar_url: string })?.avatar_url || '',
          html_url: (c.user as { html_url: string })?.html_url || '',
          type: (c.user as { type?: string })?.type,
        },
        body: (c.body as string) || '',
        created_at: (c.created_at as string) || new Date().toISOString(),
        updated_at: (c.updated_at as string) || new Date().toISOString(),
        html_url: (c.html_url as string) || '',
        path: c.path as string | undefined,
        position: c.position as number | undefined,
        line: c.line as number | undefined,
        is_review_comment: true,
        performed_via_github_app: (c.performed_via_github_app as Record<string, unknown>) || null,
      }));

      // Convert ALL PR review submissions (Approved, Changes Requested, Commented, etc.) into comments
      const formattedReviews: PRComment[] = (prReviews || []).map((r: Record<string, unknown>) => {
        const rawBody = (r.body as string) || '';
        const state = (r.state as string) || 'REVIEW';
        const formattedState = state.replace(/_/g, ' ');
        const fallbackBody = `*Submitted PR review: ${formattedState}*`;

        return {
          id: r.id as number,
          user: {
            login: (r.user as { login: string })?.login || 'unknown',
            avatar_url: (r.user as { avatar_url: string })?.avatar_url || '',
            html_url: (r.user as { html_url: string })?.html_url || '',
            type: (r.user as { type?: string })?.type,
          },
          body: rawBody.trim().length > 0 ? rawBody : fallbackBody,
          created_at: ((r.submitted_at || r.created_at) as string) || new Date().toISOString(),
          updated_at: ((r.submitted_at || r.created_at) as string) || new Date().toISOString(),
          html_url: (r.html_url as string) || '',
          is_review_comment: true,
          review_state: state,
        };
      });

      // Ignore messages/comments from bots (e.g. GitHub actions, release-please, Netlify bot)
      const nonBotIssueComments = formattedIssueComments.filter((c) => !isBotComment(c));
      const nonBotReviewComments = formattedReviewComments.filter((c) => !isBotComment(c));
      const nonBotReviews = formattedReviews.filter((r) => !isBotComment(r));

      const allComments = [...nonBotIssueComments, ...nonBotReviewComments, ...nonBotReviews].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const lastComment = allComments.length > 0 ? allComments[allComments.length - 1] : undefined;

      let checksStatus: 'success' | 'failure' | 'pending' | 'unknown' = 'unknown';
      if (combinedStatus && combinedStatus.state) {
        if (combinedStatus.state === 'success') checksStatus = 'success';
        else if (combinedStatus.state === 'failure' || combinedStatus.state === 'error') checksStatus = 'failure';
        else if (combinedStatus.state === 'pending') checksStatus = 'pending';
      }

      const hasMergeConflicts =
        singlePrDetails?.mergeable === false ||
        singlePrDetails?.mergeable_state === 'dirty';

      const prObj: PullRequest = {
        id: rawPr.id as number,
        number: rawPr.number as number,
        title: rawPr.title as string,
        body: (rawPr.body as string) || '',
        state: rawPr.state as 'open' | 'closed' | 'merged',
        is_draft: !!rawPr.draft,
        html_url: rawPr.html_url as string,
        created_at: rawPr.created_at as string,
        updated_at: rawPr.updated_at as string,
        head: {
          ref: head.ref,
          sha: head.sha,
        },
        base: {
          ref: base.ref,
        },
        user: {
          login: user.login,
          avatar_url: user.avatar_url,
          html_url: user.html_url,
        },
        repo_owner: owner,
        repo_name: repo,
        repo_full_name: repoFullName,
        comments_count: allComments.length,
        review_comments_count: nonBotReviewComments.length + nonBotReviews.length,
        comments: allComments,
        commits: formattedCommits,
        last_comment: lastComment,
        checks_status: checksStatus,
        has_merge_conflicts: hasMergeConflicts,
        mergeable_state: singlePrDetails?.mergeable_state,
      };

      prDetailsCache.set(cacheKey, prObj);
      return prObj;
    });

    repoPrsCache.set(repoFullName, { prs: pullRequests, timestamp: Date.now() });
    return pullRequests;
  })();

  inFlightRepoFetches.set(repoFullName, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRepoFetches.delete(repoFullName);
  }
}

export async function getRepoPRHistory(
  repoFullName: string,
  token?: string,
  forceRefresh = false
): Promise<{ merged: MergeHistoryEntry[]; closed: MergeHistoryEntry[] }> {
  const [owner, repo] = parseRepoFullName(repoFullName);

  const cached = mergeHistoryCache.get(repoFullName);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < MERGE_HISTORY_CACHE_TTL_MS) {
    return { merged: cached.merged, closed: cached.closed };
  }

  // Deduplicate in-flight history fetches
  if (!forceRefresh && inFlightHistoryFetches.has(repoFullName)) {
    return inFlightHistoryFetches.get(repoFullName)!;
  }

  const fetchPromise = (async () => {
    // Try GraphQL first to retrieve both author (creator) and mergedBy in a single request.
    const merged: MergeHistoryEntry[] = [];
    const closed: MergeHistoryEntry[] = [];
    let usedGraphQL = false;

    if (token) {
      try {
        const rateLimit = getRateLimitStatus();
        if (rateLimit.isRateLimited && rateLimit.resetAt) {
          throw new GitHubRateLimitError(
            `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
            rateLimit.resetAt
          );
        }

        const query = `
          query GetPRHistory($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              pullRequests(states: [CLOSED, MERGED], first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
                nodes {
                  id
                  number
                  title
                  url
                  mergedAt
                  closedAt
                  baseRefName
                  author {
                    login
                    avatarUrl
                    url
                  }
                  mergedBy {
                    login
                    avatarUrl
                    url
                  }
                  timelineItems(last: 1, itemTypes: [CLOSED_EVENT]) {
                    nodes {
                      ... on ClosedEvent {
                        actor {
                          login
                          avatarUrl
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        await acquireSlot();
        let res: Response;
        try {
          res = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Workflow-App',
            },
            body: JSON.stringify({ query, variables: { owner, name: repo } }),
          });
        } finally {
          releaseSlot();
        }

        if (!res.ok) {
          const errorText = await res.text();
          if (res.status === 403 || res.status === 429) {
            const rateInfo = handleRateLimitHeaders(res, errorText);
            if (rateInfo) {
              rateLimitResetTimestamp = rateInfo.resetAt.getTime();
              const mins = Math.max(1, Math.ceil((rateLimitResetTimestamp - Date.now()) / 60000));
              const desc = rateInfo.isSecondary ? 'secondary/burst rate limit' : 'hourly quota';
              throw new GitHubRateLimitError(
                `GitHub API ${desc} exceeded. Resets at ${rateInfo.resetAt.toLocaleTimeString()} (in ~${mins} min${mins === 1 ? '' : 's'}).`,
                rateInfo.resetAt,
                rateInfo.isSecondary
              );
            }
          }
        } else {
          const json = await res.json();
          if (json.errors && json.errors.length > 0) {
            const rateError = json.errors.find((e: { type?: string }) => e.type === 'RATE_LIMITED');
            if (rateError) {
              const resetAt = new Date(Date.now() + 60000);
              rateLimitResetTimestamp = resetAt.getTime();
              throw new GitHubRateLimitError(
                `GitHub API secondary rate limit exceeded. Resets at ${resetAt.toLocaleTimeString()} (in ~1 min).`,
                resetAt,
                true
              );
            }
          }

          const nodes = json.data?.repository?.pullRequests?.nodes;
          if (Array.isArray(nodes)) {
            for (const node of nodes) {
              const isMerged = typeof node.mergedAt === 'string' && node.mergedAt.length > 0;
              const closedByActor = !isMerged
                ? (node.timelineItems?.nodes?.[0]?.actor ?? null)
                : null;
              const item: MergeHistoryEntry = {
                id: node.id || node.number,
                number: node.number,
                title: node.title || 'Untitled pull request',
                user: {
                  login: node.author?.login || 'unknown',
                  avatar_url: node.author?.avatarUrl || '',
                  html_url: node.author?.url || (node.author?.login ? `https://github.com/${node.author.login}` : ''),
                },
                merged_by: node.mergedBy
                  ? {
                      login: node.mergedBy.login || 'unknown',
                      avatar_url: node.mergedBy.avatarUrl || '',
                      html_url: node.mergedBy.url || `https://github.com/${node.mergedBy.login}`,
                    }
                  : null,
                closed_by: closedByActor
                  ? {
                      login: closedByActor.login || 'unknown',
                      avatar_url: closedByActor.avatarUrl || '',
                      html_url: closedByActor.url || `https://github.com/${closedByActor.login}`,
                    }
                  : null,
                repo_full_name: repoFullName,
                html_url: node.url || `https://github.com/${repoFullName}/pull/${node.number}`,
                base_branch: node.baseRefName || 'main',
                merged_at: isMerged ? node.mergedAt : null,
                closed_at: node.closedAt || node.mergedAt || '',
                state: isMerged ? 'merged' : 'closed',
              };
              if (isMerged) {
                merged.push(item);
              } else {
                closed.push(item);
              }
            }
            usedGraphQL = true;
          }
        }
      } catch (err) {
        if (err instanceof GitHubRateLimitError) throw err;
        // Fallback to REST below
      }
    }

    if (!usedGraphQL) {
      const closedPRs = await fetchGitHubAPI(
        `/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
        token,
        true
      );

      const rawList = Array.isArray(closedPRs) ? closedPRs : [];
      for (const rawPr of rawList) {
        const base = rawPr.base as { ref?: string } | undefined;
        const user = rawPr.user as { login?: string; avatar_url?: string; html_url?: string } | undefined;
        const mergedBy = rawPr.merged_by as { login?: string; avatar_url?: string; html_url?: string } | undefined;
        const isMerged = typeof rawPr.merged_at === 'string' && rawPr.merged_at.length > 0;
        const baseBranch = base?.ref || 'main';

        const item: MergeHistoryEntry = {
          id: rawPr.id as number,
          number: rawPr.number as number,
          title: (rawPr.title as string) || 'Untitled pull request',
          user: {
            login: user?.login || 'unknown',
            avatar_url: user?.avatar_url || '',
            html_url: user?.html_url || '',
          },
          merged_by: mergedBy
            ? {
                login: mergedBy.login || 'unknown',
                avatar_url: mergedBy.avatar_url || '',
                html_url: mergedBy.html_url || '',
              }
            : null,
          repo_full_name: repoFullName,
          html_url: (rawPr.html_url as string) || `https://github.com/${repoFullName}/pull/${rawPr.number}`,
          base_branch: baseBranch,
          merged_at: isMerged ? (rawPr.merged_at as string) : null,
          closed_at: (rawPr.closed_at as string) || (rawPr.merged_at as string) || '',
          state: isMerged ? 'merged' : 'closed',
        };

        if (isMerged) {
          merged.push(item);
        } else {
          closed.push(item);
        }
      }
    }

    merged.sort((a, b) => new Date(b.merged_at || 0).getTime() - new Date(a.merged_at || 0).getTime());
    closed.sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime());

    mergeHistoryCache.set(repoFullName, { merged, closed, timestamp: Date.now() });
    return { merged, closed };
  })();

  inFlightHistoryFetches.set(repoFullName, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightHistoryFetches.delete(repoFullName);
  }
}

export async function getRepoMergeHistory(
  repoFullName: string,
  token?: string,
  forceRefresh = false
): Promise<MergeHistoryEntry[]> {
  const { merged } = await getRepoPRHistory(repoFullName, token, forceRefresh);
  return merged;
}

export async function fetchAuthenticatedUser(token?: string): Promise<string | null> {
  const rateLimit = getRateLimitStatus();
  if (rateLimit.isRateLimited && rateLimit.resetAt) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
      rateLimit.resetAt
    );
  }
  try {
    const user = await fetchGitHubAPI('/user', token);
    return user.login || null;
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      throw err;
    }
    return null;
  }
}

export async function postPRComment(
  repoFullName: string,
  prNumber: number,
  commentBody: string,
  token?: string
): Promise<{ success: boolean; commentUrl?: string }> {
  const [owner, repo] = parseRepoFullName(repoFullName);
  validatePRNumber(prNumber);
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to post comments.');
  }

  const rateLimit = getRateLimitStatus();
  if (rateLimit.isRateLimited && rateLimit.resetAt) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
      rateLimit.resetAt
    );
  }

  await acquireSlot();
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: commentBody }),
    });
  } finally {
    releaseSlot();
  }

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 403 || res.status === 429) {
      const rateInfo = handleRateLimitHeaders(res, errorText);
      if (rateInfo) {
        rateLimitResetTimestamp = rateInfo.resetAt.getTime();
        const mins = Math.max(1, Math.ceil((rateLimitResetTimestamp - Date.now()) / 60000));
        throw new GitHubRateLimitError(
          `GitHub API rate limit exceeded. Resets at ${rateInfo.resetAt.toLocaleTimeString()} (in ~${mins} min).`,
          rateInfo.resetAt,
          rateInfo.isSecondary
        );
      }
    }
    throw new Error(`Failed to post comment (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return { success: true, commentUrl: data.html_url };
}

export async function mergePullRequest(
  repoFullName: string,
  prNumber: number,
  commitTitle?: string,
  token?: string
): Promise<{ success: boolean; message: string; sha?: string }> {
  const [owner, repo] = parseRepoFullName(repoFullName);
  validatePRNumber(prNumber);
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to merge pull requests.');
  }

  const rateLimit = getRateLimitStatus();
  if (rateLimit.isRateLimited && rateLimit.resetAt) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
      rateLimit.resetAt
    );
  }

  await acquireSlot();
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commit_title: commitTitle || `Merge pull request #${prNumber} from ${repoFullName}`,
      }),
    });
  } finally {
    releaseSlot();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData.message || res.statusText;
    if (res.status === 403 || res.status === 429) {
      const rateInfo = handleRateLimitHeaders(res, errorMsg);
      if (rateInfo) {
        rateLimitResetTimestamp = rateInfo.resetAt.getTime();
        const mins = Math.max(1, Math.ceil((rateLimitResetTimestamp - Date.now()) / 60000));
        throw new GitHubRateLimitError(
          `GitHub API rate limit exceeded. Resets at ${rateInfo.resetAt.toLocaleTimeString()} (in ~${mins} min).`,
          rateInfo.resetAt,
          rateInfo.isSecondary
        );
      }
    }
    throw new Error(`Failed to merge PR #${prNumber}: ${errorMsg}`);
  }

  const data = await res.json();
  return {
    success: true,
    message: data.message || `PR #${prNumber} successfully merged`,
    sha: data.sha,
  };
}

export async function undraftPullRequest(
  repoFullName: string,
  prNumber: number,
  token?: string
): Promise<{ success: boolean; message: string }> {
  const [owner, repo] = parseRepoFullName(repoFullName);
  validatePRNumber(prNumber);
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to update pull request draft status.');
  }

  const rateLimit = getRateLimitStatus();
  if (rateLimit.isRateLimited && rateLimit.resetAt) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit exceeded. Resets at ${rateLimit.resetAt.toLocaleTimeString()} (in ~${rateLimit.resetMinutes} min).`,
      rateLimit.resetAt
    );
  }

  // Primary Method: GitHub GraphQL API markPullRequestReadyForReview mutation
  const queryPrNode = `
    query GetPrNodeId($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          id
          isDraft
        }
      }
    }
  `;

  await acquireSlot();
  let gqlQueryRes: Response;
  try {
    gqlQueryRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Workflow-Dashboard-App',
      },
      body: JSON.stringify({
        query: queryPrNode,
        variables: { owner, repo, number: prNumber },
      }),
    });
  } finally {
    releaseSlot();
  }

  if (!gqlQueryRes.ok) {
    const errorText = await gqlQueryRes.text();
    throw new Error(`GitHub GraphQL API error (${gqlQueryRes.status}): ${errorText}`);
  }

  const gqlData = await gqlQueryRes.json();
  if (gqlData.errors && gqlData.errors.length > 0) {
    throw new Error(`GraphQL query error: ${gqlData.errors[0].message}`);
  }

  const prNode = gqlData?.data?.repository?.pullRequest;
  if (!prNode || !prNode.id) {
    throw new Error(`Pull Request #${prNumber} not found in repository ${repoFullName}`);
  }

  const mutation = `
    mutation MarkPRReady($prNodeId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $prNodeId }) {
        pullRequest {
          id
          isDraft
        }
      }
    }
  `;

  await acquireSlot();
  let gqlMutRes: Response;
  try {
    gqlMutRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Workflow-Dashboard-App',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { prNodeId: prNode.id },
      }),
    });
  } finally {
    releaseSlot();
  }

  if (!gqlMutRes.ok) {
    const errorText = await gqlMutRes.text();
    throw new Error(`GitHub GraphQL mutation HTTP error (${gqlMutRes.status}): ${errorText}`);
  }

  const mutData = await gqlMutRes.json();
  if (mutData.errors && mutData.errors.length > 0) {
    throw new Error(`Failed to convert draft PR #${prNumber}: ${mutData.errors[0].message}`);
  }

  const updatedIsDraft = mutData?.data?.markPullRequestReadyForReview?.pullRequest?.isDraft;
  if (updatedIsDraft === true) {
    throw new Error(`GitHub reported PR #${prNumber} is still in draft state after mutation.`);
  }

  return {
    success: true,
    message: `PR #${prNumber} successfully converted to open ready-for-review PR`,
  };
}
