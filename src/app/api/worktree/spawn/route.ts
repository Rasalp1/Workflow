import { NextResponse } from 'next/server';
import { spawnWorktreeInAntigravity } from '@/lib/terminalLauncher';
import { loadConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, localPath, branchName } = body;

    if (!branchName) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
    }

    const config = await loadConfig();
    const targetPath =
      localPath ||
      config.repoPaths[repoFullName] ||
      process.env[`REPO_PATH_${(repoFullName || '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

    if (!targetPath) {
      return NextResponse.json(
        {
          error: `No local directory mapped for repo "${repoFullName}". Please configure local directory path in settings.`,
        },
        { status: 400 }
      );
    }

    const result = await spawnWorktreeInAntigravity({
      repoPath: targetPath,
      branchName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      worktreePath: result.worktreePath,
    });
  } catch (error: unknown) {
    console.error('API /api/worktree/spawn Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to spawn git worktree';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
