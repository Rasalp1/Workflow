import { NextResponse } from 'next/server';
import { AgentType } from '@/types';
import {
  buildAgentCardId,
  clearActiveAgent,
  clearAllActiveAgents,
  loadActiveAgents,
  setActiveAgent,
} from '@/lib/activeAgents';
import { validateOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Shared active-agent session state. Both the dashboard and the macOS menu bar
 * app read and write this so an agent launched from either surface shows up in
 * the other one.
 */
export async function GET() {
  try {
    const activeAgents = await loadActiveAgents();
    return NextResponse.json(
      { success: true, activeAgents },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error: unknown) {
    console.error('API /api/agents/active GET Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to read active agent sessions';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { action, cardId, repoFullName, prNumber, agent, branch, source } = body ?? {};

    if (action === 'clearAll') {
      const activeAgents = await clearAllActiveAgents();
      return NextResponse.json({ success: true, activeAgents });
    }

    const resolvedCardId: string | undefined =
      cardId ||
      (repoFullName && (prNumber ?? prNumber === 0)
        ? buildAgentCardId(repoFullName, prNumber)
        : undefined);

    if (!resolvedCardId) {
      return NextResponse.json(
        { error: 'cardId (or repoFullName + prNumber) is required' },
        { status: 400 }
      );
    }

    if (action === 'clear') {
      const activeAgents = await clearActiveAgent(resolvedCardId);
      return NextResponse.json({ success: true, activeAgents });
    }

    if (action === 'start') {
      const activeAgents = await setActiveAgent(resolvedCardId, {
        agent: (agent || 'codex') as AgentType,
        branch,
        source: source === 'menubar' ? 'menubar' : 'web',
      });
      return NextResponse.json({ success: true, activeAgents });
    }

    return NextResponse.json(
      { error: `Unknown action "${action}". Expected "start", "clear" or "clearAll".` },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('API /api/agents/active POST Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update active agent sessions';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
