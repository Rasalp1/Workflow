import { NextResponse } from 'next/server';
import { spawnAgentInTerminal } from '@/lib/terminalLauncher';
import { loadConfig } from '@/lib/storage';
import { AgentType } from '@/types';
import { validateOrigin } from '@/lib/security';
import { buildAgentCardId, setActiveAgent } from '@/lib/activeAgents';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, localPath, branchName, agent, prompt, cardId, prNumber } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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

    const targetAgent: AgentType = agent || config.defaultAgent || 'codex';

    const result = await spawnAgentInTerminal({
      repoPath: targetPath,
      branchName,
      agent: targetAgent,
      prompt,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Record the session server-side so the dashboard and the menu bar app both
    // show the "agent working" badge, regardless of which one launched it.
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
      targetPath,
      agent: targetAgent,
      cardId: sessionCardId,
      activeAgents,
    });
  } catch (error: unknown) {
    console.error('API /api/agent/spawn Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to spawn agent';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
