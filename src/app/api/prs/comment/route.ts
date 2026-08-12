import { NextResponse } from 'next/server';
import { postPRComment } from '@/lib/github';
import { loadConfig } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoFullName, prNumber, commentBody } = body;

    if (!repoFullName || !prNumber || !commentBody) {
      return NextResponse.json(
        { error: 'repoFullName, prNumber, and commentBody are required' },
        { status: 400 }
      );
    }

    const config = loadConfig();
    const token = config.githubToken || process.env.GITHUB_TOKEN;

    const result = await postPRComment(repoFullName, prNumber, commentBody, token);

    return NextResponse.json({
      success: true,
      message: `Comment posted successfully on PR #${prNumber}`,
      commentUrl: result.commentUrl,
    });
  } catch (error: any) {
    console.error('API /api/prs/comment Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post comment to PR' },
      { status: 500 }
    );
  }
}
