import { NextResponse } from 'next/server';
import { postPRComment } from '@/lib/github';
import { loadConfig } from '@/lib/storage';
import { validateConfiguredRepo, validateOrigin, validatePullRequestNumber } from '@/lib/security';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, prNumber, commentBody } = body;

    if (!repoFullName || !prNumber || typeof commentBody !== 'string' || !commentBody.trim() || commentBody.length > 20_000) {
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

    const result = await postPRComment(configuredRepo, number, commentBody, token);

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
