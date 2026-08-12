import { PRComment, PullRequest } from '@/types';

async function fetchGitHubAPI(endpoint: string, token?: string) {
  const authToken = token || process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Workflow-Dashboard-App',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers,
    next: { revalidate: 30 }, // 30s cache
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API HTTP ${res.status} for ${endpoint}: ${errorText}`);
  }

  return res.json();
}

export async function getRepoPullRequests(
  repoFullName: string,
  token?: string
): Promise<PullRequest[]> {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo format "${repoFullName}". Expected "owner/repo"`);
  }

  // Fetch open pull requests
  const prsData = await fetchGitHubAPI(`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc`, token);

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

  const pullRequests: PullRequest[] = await Promise.all(
    validPrsData.map(async (rawPr: Record<string, unknown>) => {
      const prNumber = rawPr.number as number;
      const head = rawPr.head as { ref: string; sha: string };
      const base = rawPr.base as { ref: string };
      const user = rawPr.user as { login: string; avatar_url: string; html_url: string };

      // Fetch single PR details, issue comments & review comments in parallel (up to 100 per page)
      const [singlePrDetails, issueComments, reviewComments, combinedStatus] = await Promise.all([
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`, token).catch(() => null),
        fetchGitHubAPI(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`, token).catch(() => []),
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`, token).catch(() => []),
        fetchGitHubAPI(`/repos/${owner}/${repo}/commits/${head.sha}/status`, token).catch(() => null),
      ]);

      const formattedIssueComments: PRComment[] = (issueComments || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        user: {
          login: (c.user as { login: string }).login,
          avatar_url: (c.user as { avatar_url: string }).avatar_url,
          html_url: (c.user as { html_url: string }).html_url,
        },
        body: (c.body as string) || '',
        created_at: c.created_at as string,
        updated_at: c.updated_at as string,
        html_url: c.html_url as string,
        is_review_comment: false,
      }));

      const formattedReviewComments: PRComment[] = (reviewComments || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        user: {
          login: (c.user as { login: string }).login,
          avatar_url: (c.user as { avatar_url: string }).avatar_url,
          html_url: (c.user as { html_url: string }).html_url,
        },
        body: (c.body as string) || '',
        created_at: c.created_at as string,
        updated_at: c.updated_at as string,
        html_url: c.html_url as string,
        path: c.path as string | undefined,
        position: c.position as number | undefined,
        line: c.line as number | undefined,
        is_review_comment: true,
      }));

      const allComments = [...formattedIssueComments, ...formattedReviewComments].sort(
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
        comments_count: (rawPr.comments as number) + (rawPr.review_comments as number),
        review_comments_count: rawPr.review_comments as number,
        comments: allComments,
        last_comment: lastComment,
        checks_status: checksStatus,
        has_merge_conflicts: hasMergeConflicts,
        mergeable_state: singlePrDetails?.mergeable_state,
      };

      return prObj;
    })
  );

  return pullRequests;
}

export async function fetchAuthenticatedUser(token?: string): Promise<string | null> {
  try {
    const user = await fetchGitHubAPI('/user', token);
    return user.login || null;
  } catch {
    return null;
  }
}

export async function postPRComment(
  repoFullName: string,
  prNumber: number,
  commentBody: string,
  token?: string
): Promise<{ success: boolean; commentUrl?: string }> {
  const [owner, repo] = repoFullName.split('/');
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to post comments.');
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: commentBody }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to post comment (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return { success: true, commentUrl: data.html_url };
}
