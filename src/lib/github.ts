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
    (rawPr: any) =>
      rawPr.user?.login !== 'github-actions[bot]' &&
      !rawPr.user?.login?.toLowerCase().includes('github-actions')
  );

  const pullRequests: PullRequest[] = await Promise.all(
    validPrsData.map(async (rawPr: any) => {
      const prNumber = rawPr.number;

      // Fetch single PR details, issue comments & review comments in parallel (up to 100 per page)
      const [singlePrDetails, issueComments, reviewComments, combinedStatus] = await Promise.all([
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`, token).catch(() => null),
        fetchGitHubAPI(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`, token).catch(() => []),
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`, token).catch(() => []),
        fetchGitHubAPI(`/repos/${owner}/${repo}/commits/${rawPr.head.sha}/status`, token).catch(() => null),
      ]);

      const formattedIssueComments: PRComment[] = (issueComments || []).map((c: any) => ({
        id: c.id,
        user: {
          login: c.user.login,
          avatar_url: c.user.avatar_url,
          html_url: c.user.html_url,
        },
        body: c.body || '',
        created_at: c.created_at,
        updated_at: c.updated_at,
        html_url: c.html_url,
        is_review_comment: false,
      }));

      const formattedReviewComments: PRComment[] = (reviewComments || []).map((c: any) => ({
        id: c.id,
        user: {
          login: c.user.login,
          avatar_url: c.user.avatar_url,
          html_url: c.user.html_url,
        },
        body: c.body || '',
        created_at: c.created_at,
        updated_at: c.updated_at,
        html_url: c.html_url,
        path: c.path,
        position: c.position,
        line: c.line,
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
        id: rawPr.id,
        number: rawPr.number,
        title: rawPr.title,
        body: rawPr.body || '',
        state: rawPr.state,
        is_draft: !!rawPr.draft,
        html_url: rawPr.html_url,
        created_at: rawPr.created_at,
        updated_at: rawPr.updated_at,
        head: {
          ref: rawPr.head.ref,
          sha: rawPr.head.sha,
        },
        base: {
          ref: rawPr.base.ref,
        },
        user: {
          login: rawPr.user.login,
          avatar_url: rawPr.user.avatar_url,
          html_url: rawPr.user.html_url,
        },
        repo_owner: owner,
        repo_name: repo,
        repo_full_name: repoFullName,
        comments_count: rawPr.comments + rawPr.review_comments,
        review_comments_count: rawPr.review_comments,
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
  } catch (e) {
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
