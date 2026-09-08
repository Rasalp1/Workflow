import { NextResponse } from 'next/server';
import { spawnWorktreeInAntigravity } from '@/lib/terminalLauncher';
import { loadConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';
import { buildAgentCardId, setActiveAgent } from '@/lib/activeAgents';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, localPath, branchName, agent, cardId, prNumber } = body;

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

    const targetAgent = (agent || config.defaultAgent || 'codex') as import('@/types').AgentType;

    const result = await spawnWorktreeInAntigravity({
      repoPath: targetPath,
      branchName,
      agent: targetAgent,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    const sessionCardId =
      cardId ||
      (repoFullName && (prNumber ?? prNumber === 0) ? buildAgentCardId(repoFullName, prNumber) : undefined);

    let activeAgents;
    if (sessionCardId) {
      activeAgents = await setActiveAgent(sessionCardId, {
        agent: targetAgent,
        branch: branchName,
        source: body.source === 'menubar' ? 'menubar' : 'web',
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      worktreePath: result.worktreePath,
      agent: targetAgent,
      cardId: sessionCardId,
      activeAgents,
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
