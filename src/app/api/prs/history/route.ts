import { NextResponse } from 'next/server';
import { getRateLimitStatus, getRepoMergeHistory, GitHubRateLimitError } from '@/lib/github';
import { loadConfig } from '@/lib/storage';
import { MergeHistoryEntry } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const config = await loadConfig();

    if (!config.githubToken) {
      return NextResponse.json({
        error: 'GitHub Token is missing. Please set GITHUB_TOKEN in settings or .env.local',
        mergeHistory: [],
      });
    }

    const rateStatus = getRateLimitStatus();
    if (rateStatus.isRateLimited && rateStatus.resetAt) {
      return NextResponse.json({
        error: `GitHub API rate limit exceeded. Resets at ${rateStatus.resetAt.toLocaleTimeString()} (in ~${rateStatus.resetMinutes} min).`,
        mergeHistory: [],
        rateLimited: true,
      });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const mergeHistory: MergeHistoryEntry[] = [];
    const errors: string[] = [];

    for (const repoFullName of config.monitoredRepos) {
      try {
        mergeHistory.push(...await getRepoMergeHistory(repoFullName, config.githubToken, force));
      } catch (error: unknown) {
        if (error instanceof GitHubRateLimitError) {
          return NextResponse.json({
            error: error.message,
            mergeHistory,
            rateLimited: true,
          });
        }
        errors.push(`${repoFullName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    mergeHistory.sort((a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime());

    return NextResponse.json(
      {
        mergeHistory,
        warning: errors.length > 0 ? errors.join('; ') : undefined,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error: unknown) {
    console.error('API /api/prs/history Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch merge history', mergeHistory: [] },
      { status: 500 }
    );
  }
}
