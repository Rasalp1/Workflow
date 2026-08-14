import type { PRComment, PRCommit } from '../types/index.ts';

/**
 * Checks if a comment body contains requests for a rebase (case-insensitive).
 */
export function asksForRebase(body: string): boolean {
  if (!body) return false;
  // Matches "rebase", "rebased", "rebasing", "re-base", "re-based", "rebases", etc.
  return /\bre-?bas(e|ing|ed|es)?\b/i.test(body);
}

export interface RebaseStatusResult {
  asksForRebase: boolean;
  hasCommitsSince: boolean;
  commitsSinceCount: number;
  latestCommitDate: string | null;
}

/**
 * Determines whether any commits were made/pushed to the branch since the comment was created.
 */
export function checkRebaseStatus(
  comment: PRComment,
  commits: PRCommit[] = []
): RebaseStatusResult {
  const isRebaseRequest = asksForRebase(comment.body);
  if (!isRebaseRequest) {
    return {
      asksForRebase: false,
      hasCommitsSince: false,
      commitsSinceCount: 0,
      latestCommitDate: null,
    };
  }

  const commentTime = new Date(comment.created_at).getTime();
  if (isNaN(commentTime)) {
    return {
      asksForRebase: true,
      hasCommitsSince: false,
      commitsSinceCount: 0,
      latestCommitDate: null,
    };
  }

  // Filter commits whose committer date or author date is strictly after commentTime (+ 2s tolerance for API timing skew)
  const commitsAfter = commits.filter((c) => {
    const committerTime = c.committer_date ? new Date(c.committer_date).getTime() : 0;
    const authorTime = c.author_date ? new Date(c.author_date).getTime() : 0;
    const commitTime = Math.max(committerTime, authorTime);
    return commitTime > commentTime + 2000;
  });

  if (commitsAfter.length === 0) {
    return {
      asksForRebase: true,
      hasCommitsSince: false,
      commitsSinceCount: 0,
      latestCommitDate: null,
    };
  }

  let latestTime = 0;
  let latestDateStr: string | null = null;
  for (const c of commitsAfter) {
    const committerTime = c.committer_date ? new Date(c.committer_date).getTime() : 0;
    const authorTime = c.author_date ? new Date(c.author_date).getTime() : 0;
    const maxT = Math.max(committerTime, authorTime);
    if (maxT > latestTime) {
      latestTime = maxT;
      latestDateStr = c.committer_date || c.author_date;
    }
  }

  return {
    asksForRebase: true,
    hasCommitsSince: true,
    commitsSinceCount: commitsAfter.length,
    latestCommitDate: latestDateStr,
  };
}
