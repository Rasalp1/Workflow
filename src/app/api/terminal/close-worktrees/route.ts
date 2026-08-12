import { NextResponse } from 'next/server';
import { closeAllWorktreesInTerminal } from '@/lib/terminalLauncher';
import { loadConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';
import { existsSync } from 'fs';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const config = await loadConfig();

    // Collect all local repo paths
    const repoPathsMap = config.repoPaths || {};
    const pathSet = new Set<string>();

    Object.values(repoPathsMap).forEach((p) => {
      if (p && typeof p === 'string' && existsSync(p)) {
        pathSet.add(p);
      }
    });

    // Check env vars as fallback
    ['REPO_PATH_PROJECT_APP', 'REPO_PATH_PROJECT_PRODUCTION'].forEach((envKey) => {
      const p = process.env[envKey];
      if (p && existsSync(p)) {
        pathSet.add(p);
      }
    });

    const allRepoPaths = Array.from(pathSet);

    if (allRepoPaths.length === 0) {
      return NextResponse.json(
        { error: 'No local repository paths configured or found on disk.' },
        { status: 400 }
      );
    }

    // Prefer ProjectApp root directory for opening the terminal window
    const exampleprojectKey =
      Object.keys(repoPathsMap).find((k) => k.toLowerCase().includes('projectapp')) ||
      'example-org/project-app';

    let targetPath = repoPathsMap[exampleprojectKey] || process.env.REPO_PATH_PROJECT_APP;

    if (!targetPath || !existsSync(targetPath)) {
      targetPath =
        allRepoPaths.find((p) => p.toLowerCase().includes('projectapp')) || allRepoPaths[0];
    }

    const result = await closeAllWorktreesInTerminal({
      targetRepoPath: targetPath,
      repoPaths: allRepoPaths,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    console.error('API /api/terminal/close-worktrees Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to close worktrees in terminal';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
