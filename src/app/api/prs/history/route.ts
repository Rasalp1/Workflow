import { NextResponse } from 'next/server';
import { getRateLimitStatus, getRepoPRHistory, GitHubRateLimitError } from '@/lib/github';
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
        closedHistory: [],
      });
    }

    const rateStatus = getRateLimitStatus();
    if (rateStatus.isRateLimited && rateStatus.resetAt) {
      return NextResponse.json({
        error: `GitHub API rate limit exceeded. Resets at ${rateStatus.resetAt.toLocaleTimeString()} (in ~${rateStatus.resetMinutes} min).`,
        mergeHistory: [],
        closedHistory: [],
        rateLimited: true,
      });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const mergeHistory: MergeHistoryEntry[] = [];
    const closedHistory: MergeHistoryEntry[] = [];
    const errors: string[] = [];

    for (const repoFullName of config.monitoredRepos) {
      try {
        const { merged, closed } = await getRepoPRHistory(repoFullName, config.githubToken, force);
        mergeHistory.push(...merged);
        closedHistory.push(...closed);
      } catch (error: unknown) {
        if (error instanceof GitHubRateLimitError) {
          return NextResponse.json({
            error: error.message,
            mergeHistory,
            closedHistory,
            rateLimited: true,
          });
        }
        errors.push(`${repoFullName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    mergeHistory.sort((a, b) => new Date(b.merged_at || 0).getTime() - new Date(a.merged_at || 0).getTime());
    closedHistory.sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime());

    return NextResponse.json(
      {
        mergeHistory,
        closedHistory,
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
