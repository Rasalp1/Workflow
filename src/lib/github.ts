import { PRComment, PRCommit, PullRequest } from '@/types';

async function fetchGitHubAPI(endpoint: string, token?: string, noCache = true) {
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

  const res = await fetch(`https://api.github.com${endpoint}`, fetchOptions);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API HTTP ${res.status} for ${endpoint}: ${errorText}`);
  }

  return res.json();
}

async function fetchAllGitHubPages(endpoint: string, token?: string): Promise<Record<string, unknown>[]> {
  const allData: Record<string, unknown>[] = [];
  let page = 1;
  const maxPages = 5; // Cap at 500 entries per type

  while (page <= maxPages) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const pageEndpoint = `${endpoint}${separator}per_page=100&page=${page}`;
    const data = await fetchGitHubAPI(pageEndpoint, token, true).catch(() => []);
    if (!Array.isArray(data) || data.length === 0) break;
    allData.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return allData;
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

  const pullRequests: PullRequest[] = await Promise.all(
    validPrsData.map(async (rawPr: Record<string, unknown>) => {
      const prNumber = rawPr.number as number;
      const head = rawPr.head as { ref: string; sha: string };
      const base = rawPr.base as { ref: string };
      const user = rawPr.user as { login: string; avatar_url: string; html_url: string };

      // Fetch single PR details, issue comments, inline review comments, PR reviews & PR commits in parallel
      const [singlePrDetails, issueComments, reviewComments, prReviews, combinedStatus, prCommits] = await Promise.all([
        fetchGitHubAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`, token, true).catch(() => null),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token).catch(() => []),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, token).catch(() => []),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token).catch(() => []),
        fetchGitHubAPI(`/repos/${owner}/${repo}/commits/${head.sha}/status`, token, true).catch(() => null),
        fetchAllGitHubPages(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`, token).catch(() => []),
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
        },
        body: (c.body as string) || '',
        created_at: (c.created_at as string) || new Date().toISOString(),
        updated_at: (c.updated_at as string) || new Date().toISOString(),
        html_url: (c.html_url as string) || '',
        is_review_comment: false,
      }));

      const formattedReviewComments: PRComment[] = (reviewComments || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        user: {
          login: (c.user as { login: string })?.login || 'unknown',
          avatar_url: (c.user as { avatar_url: string })?.avatar_url || '',
          html_url: (c.user as { html_url: string })?.html_url || '',
        },
        body: (c.body as string) || '',
        created_at: (c.created_at as string) || new Date().toISOString(),
        updated_at: (c.updated_at as string) || new Date().toISOString(),
        html_url: (c.html_url as string) || '',
        path: c.path as string | undefined,
        position: c.position as number | undefined,
        line: c.line as number | undefined,
        is_review_comment: true,
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
          },
          body: rawBody.trim().length > 0 ? rawBody : fallbackBody,
          created_at: ((r.submitted_at || r.created_at) as string) || new Date().toISOString(),
          updated_at: ((r.submitted_at || r.created_at) as string) || new Date().toISOString(),
          html_url: (r.html_url as string) || '',
          is_review_comment: true,
          review_state: state,
        };
      });

      const allComments = [...formattedIssueComments, ...formattedReviewComments, ...formattedReviews].sort(
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
        review_comments_count: formattedReviewComments.length + formattedReviews.length,
        comments: allComments,
        commits: formattedCommits,
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

export async function mergePullRequest(
  repoFullName: string,
  prNumber: number,
  commitTitle?: string,
  token?: string
): Promise<{ success: boolean; message: string; sha?: string }> {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo format "${repoFullName}". Expected "owner/repo"`);
  }
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to merge pull requests.');
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
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

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData.message || res.statusText;
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
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo format "${repoFullName}". Expected "owner/repo"`);
  }
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required to update pull request draft status.');
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

  const gqlQueryRes = await fetch('https://api.github.com/graphql', {
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

  const gqlMutRes = await fetch('https://api.github.com/graphql', {
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


