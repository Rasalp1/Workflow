import { NextResponse } from 'next/server';
import { spawnAgentInTerminal } from '@/lib/terminalLauncher';
import { loadConfig } from '@/lib/storage';
import { AgentType } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoFullName, localPath, agent, prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const config = loadConfig();
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
      agent: targetAgent,
      prompt,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      targetPath,
      agent: targetAgent,
    });
  } catch (error: any) {
    console.error('API /api/agent/spawn Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to spawn agent' }, { status: 500 });
  }
}
