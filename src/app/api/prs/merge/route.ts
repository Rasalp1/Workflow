import { NextResponse } from 'next/server';
import { mergePullRequest } from '@/lib/github';
import { loadConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, prNumber, commitTitle } = body;

    if (!repoFullName || !prNumber) {
      return NextResponse.json(
        { error: 'repoFullName and prNumber are required' },
        { status: 400 }
      );
    }

    const config = await loadConfig();
    const token = config.githubToken || process.env.GITHUB_TOKEN;

    const result = await mergePullRequest(repoFullName, Number(prNumber), commitTitle, token);

    return NextResponse.json({
      success: true,
      message: result.message,
      sha: result.sha,
    });
  } catch (error: unknown) {
    console.error('API /api/prs/merge Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to merge PR';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
