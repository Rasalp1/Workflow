import { NextResponse } from 'next/server';
import { getCachedPullRequest, getRepoPullRequests, postPRComment } from '@/lib/github';
import { loadConfig, loadRules } from '@/lib/storage';
import { validateConfiguredRepo, validateOrigin, validatePullRequestNumber } from '@/lib/security';
import { formatPromptTemplate } from '@/lib/logicGates';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, prNumber, commentBody, ruleId } = body;

    if (!repoFullName || !prNumber) {
      return NextResponse.json(
        { error: 'repoFullName, prNumber, and commentBody are required' },
        { status: 400 }
      );
    }

    const config = await loadConfig();
    let configuredRepo: string;
    let number: number;
    try {
      configuredRepo = validateConfiguredRepo(repoFullName, config.monitoredRepos);
      number = validatePullRequestNumber(prNumber);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 });
    }
    const token = config.githubToken || process.env.GITHUB_TOKEN;

    let resolvedBody: string = typeof commentBody === 'string' ? commentBody : '';
    if (!resolvedBody.trim() && typeof ruleId === 'string' && ruleId.trim()) {
      const rules = await loadRules();
      const matchedRule = rules.find((r) => r.id === ruleId);
      if (matchedRule) {
        let pr = getCachedPullRequest(configuredRepo, number);
        if (!pr && token) {
          const prs = await getRepoPullRequests(configuredRepo, token, false).catch(() => []);
          pr = prs.find((item) => item.number === number);
        }
        if (pr) {
          resolvedBody = formatPromptTemplate(matchedRule.promptTemplate, pr);
        }
      }
    }

    if (!resolvedBody.trim() || resolvedBody.length > 20_000) {
      return NextResponse.json(
        { error: 'repoFullName, prNumber, and commentBody are required' },
        { status: 400 }
      );
    }

    const result = await postPRComment(configuredRepo, number, resolvedBody, token);

    return NextResponse.json({
      success: true,
      message: `Comment posted successfully on PR #${prNumber}`,
      commentUrl: result.commentUrl,
    });
  } catch (error: unknown) {
    console.error('API /api/prs/comment Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to post comment to PR';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
