import { NextResponse } from 'next/server';
import { undraftPullRequest } from '@/lib/github';
import { loadConfig } from '@/lib/storage';
import { validateConfiguredRepo, validateOrigin, validatePullRequestNumber } from '@/lib/security';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, prNumber } = body;

    if (!repoFullName || !prNumber) {
      return NextResponse.json(
        { error: 'repoFullName and prNumber are required' },
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

    const result = await undraftPullRequest(configuredRepo, number, token);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    console.error('API /api/prs/undraft Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to mark PR as ready for review';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
