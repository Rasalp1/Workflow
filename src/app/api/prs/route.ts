import { NextResponse } from 'next/server';
import { fetchAuthenticatedUser, getRepoPullRequests } from '@/lib/github';
import { evaluateGateRule } from '@/lib/logicGates';
import { loadConfig, loadRules } from '@/lib/storage';
import { PRWithGates } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const config = await loadConfig();
    const rules = await loadRules();

    if (!config.githubToken) {
      return NextResponse.json(
        {
          error: 'GitHub Token is missing. Please set GITHUB_TOKEN in settings or .env.local',
          prs: [],
        },
        { status: 200 }
      );
    }

    const currentUser = await fetchAuthenticatedUser(config.githubToken);

    const allPRsWithGates: PRWithGates[] = [];

    for (const repoFullName of config.monitoredRepos) {
      try {
        const prs = await getRepoPullRequests(repoFullName, config.githubToken);

        const mappedPath = config.repoPaths[repoFullName] || process.env[`REPO_PATH_${repoFullName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

        for (const pr of prs) {
          if (mappedPath) {
            pr.local_path = mappedPath;
          }

          const evaluatedGates = rules.map((rule) =>
            evaluateGateRule(rule, pr, currentUser, config.defaultAgent)
          );

          allPRsWithGates.push({
            pr,
            evaluatedGates,
          });
        }
      } catch (err: unknown) {
        console.error(`Error fetching PRs for ${repoFullName}:`, err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        currentUser,
        prsWithGates: allPRsWithGates,
        monitoredRepos: config.monitoredRepos,
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
