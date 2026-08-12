import { NextResponse } from 'next/server';
import { postPRComment } from '@/lib/github';
import { loadConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, prNumber, commentBody } = body;

    if (!repoFullName || !prNumber || !commentBody) {
      return NextResponse.json(
        { error: 'repoFullName, prNumber, and commentBody are required' },
        { status: 400 }
      );
    }

    const config = await loadConfig();
    const token = config.githubToken || process.env.GITHUB_TOKEN;

    const result = await postPRComment(repoFullName, prNumber, commentBody, token);

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
