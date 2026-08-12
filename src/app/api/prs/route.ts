import { NextResponse } from 'next/server';
import { fetchAuthenticatedUser, getRepoPullRequests } from '@/lib/github';
import { evaluateGateRule } from '@/lib/logicGates';
import { loadConfig, loadRules } from '@/lib/storage';
import { PRWithGates } from '@/types';

export async function GET() {
  try {
    const config = loadConfig();
    const rules = loadRules();

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

        const mappedPath = config.repoPaths[repoFullName] || process.env[`REPO_PATH_${repoFullName.replace(/[^a-zA-Z0-0]/g, '_').toUpperCase()}`];

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
      } catch (err: any) {
        console.error(`Error fetching PRs for ${repoFullName}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      currentUser,
      prsWithGates: allPRsWithGates,
      monitoredRepos: config.monitoredRepos,
    });
  } catch (error: any) {
    console.error('API /api/prs Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch PRs' },
      { status: 500 }
    );
  }
}
