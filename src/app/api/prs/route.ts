import { NextResponse } from 'next/server';
import { fetchAuthenticatedUser, getRepoPullRequests, getRateLimitStatus, GitHubRateLimitError } from '@/lib/github';
import { evaluateGateRule, isPrAwaitingComment } from '@/lib/logicGates';
import { loadConfig, loadRules } from '@/lib/storage';
import { loadActiveAgents, reconcileActiveAgents } from '@/lib/activeAgents';
import { PRWithGates } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const config = await loadConfig();
    const rules = await loadRules();

    if (!config.githubToken) {
      return NextResponse.json(
        {
          error: 'GitHub Token is missing. Please set GITHUB_TOKEN in settings or .env.local',
          prs: [],
          prsWithGates: [],
          monitoredRepos: config.monitoredRepos || [],
        },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Check rate limit upfront
    const rateStatus = getRateLimitStatus();
    if (rateStatus.isRateLimited && rateStatus.resetAt) {
      return NextResponse.json(
        {
          success: false,
          error: `GitHub API rate limit exceeded. Resets at ${rateStatus.resetAt.toLocaleTimeString()} (in ~${rateStatus.resetMinutes} min).`,
          rateLimited: true,
          resetAt: rateStatus.resetAt.toISOString(),
          prs: [],
          prsWithGates: [],
          monitoredRepos: config.monitoredRepos || [],
        },
        { status: 200 }
      );
    }

    let currentUser: string | null = null;
    try {
      currentUser = await fetchAuthenticatedUser(config.githubToken);
    } catch (err: unknown) {
      if (err instanceof GitHubRateLimitError) {
        return NextResponse.json(
          {
            success: false,
            error: err.message,
            rateLimited: true,
            resetAt: err.resetAt.toISOString(),
            prs: [],
            prsWithGates: [],
            monitoredRepos: config.monitoredRepos || [],
          },
          { status: 200 }
        );
      }
      console.warn('Could not determine authenticated user:', err);
    }

    const allPRsWithGates: PRWithGates[] = [];
    const errors: string[] = [];

    for (const repoFullName of config.monitoredRepos) {
      try {
        const prs = await getRepoPullRequests(repoFullName, config.githubToken, force);

        const mappedPath = config.repoPaths[repoFullName] || process.env[`REPO_PATH_${repoFullName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

        for (const pr of prs) {
          if (mappedPath) {
            pr.local_path = mappedPath;
          }

          const evaluatedGates = rules.map((rule) =>
            evaluateGateRule(rule, pr, currentUser, config.defaultAgent)
          );

          const needsAttention = isPrAwaitingComment(pr, currentUser);
          pr.needs_attention = needsAttention;

          allPRsWithGates.push({
            pr,
            evaluatedGates,
            needsAttention,
          });
        }
      } catch (err: unknown) {
        console.error(`Error fetching PRs for ${repoFullName}:`, err);
        if (err instanceof GitHubRateLimitError) {
          return NextResponse.json(
            {
              success: false,
              error: err.message,
              rateLimited: true,
              resetAt: err.resetAt.toISOString(),
              prs: [],
              prsWithGates: [],
              monitoredRepos: config.monitoredRepos || [],
            },
            { status: 200 }
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${repoFullName}: ${msg}`);
      }
    }

    // If there were repos configured and ALL failed, return error to alert the user
    if (config.monitoredRepos.length > 0 && errors.length === config.monitoredRepos.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch PRs from GitHub: ${errors.join('; ')}`,
          prs: [],
          prsWithGates: [],
          monitoredRepos: config.monitoredRepos,
        },
        { status: 200 }
      );
    }

    const awaitingCommentCount = allPRsWithGates.filter((item) => item.needsAttention).length;
    const theirsToHandleCount = allPRsWithGates.length - awaitingCommentCount;

    // Retire agent sessions whose work has landed, then hand the shared state to
    // every client in the same payload the menu bar app already polls.
    let activeAgents: Awaited<ReturnType<typeof loadActiveAgents>> = {};
    try {
      activeAgents = await reconcileActiveAgents(allPRsWithGates, currentUser);
    } catch (agentErr) {
      console.error('Failed to reconcile active agent sessions:', agentErr);
    }

    return NextResponse.json(
      {
        success: true,
        currentUser,
        prsWithGates: allPRsWithGates,
        activeAgents,
        monitoredRepos: config.monitoredRepos,
        awaitingCommentCount,
        theirsToHandleCount,
        warning: errors.length > 0 ? errors.join('; ') : undefined,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    console.error('API /api/prs Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch PRs';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
