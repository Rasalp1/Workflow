import { NextResponse } from 'next/server';
import { spawnAgentInTerminal } from '@/lib/terminalLauncher';
import { loadConfig, loadRules } from '@/lib/storage';
import { validateConfiguredRepo, validateOrigin, validateAgentType } from '@/lib/security';
import { buildAgentCardId, setActiveAgent } from '@/lib/activeAgents';
import { getCachedPullRequest, getRepoPullRequests } from '@/lib/github';
import { formatPromptTemplate } from '@/lib/logicGates';

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const body = await request.json();
    const { repoFullName, branchName, baseBranch, agent, prompt, ruleId, cardId, prNumber } = body;

    const config = await loadConfig();
    let configuredRepo: string;
    try {
      configuredRepo = validateConfiguredRepo(repoFullName, config.monitoredRepos);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid repository.' }, { status: 400 });
    }

    let resolvedPrompt: string = typeof prompt === 'string' ? prompt : '';
    if (!resolvedPrompt.trim() && typeof ruleId === 'string' && ruleId.trim() && Number.isInteger(Number(prNumber))) {
      const rules = await loadRules();
      const matchedRule = rules.find((r) => r.id === ruleId);
      if (matchedRule) {
        const numericPr = Number(prNumber);
        let pr = getCachedPullRequest(configuredRepo, numericPr);
        if (!pr && config.githubToken) {
          const prs = await getRepoPullRequests(configuredRepo, config.githubToken, false).catch(() => []);
          pr = prs.find((item) => item.number === numericPr);
        }
        if (pr) {
          resolvedPrompt = formatPromptTemplate(matchedRule.promptTemplate, pr);
        }
      }
    }

    if (!resolvedPrompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    const targetPath =
      config.repoPaths[configuredRepo] ||
      process.env[`REPO_PATH_${configuredRepo.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

    if (!targetPath) {
      return NextResponse.json(
        {
          error: `No local directory mapped for repo "${repoFullName}". Please configure local directory path in settings.`,
        },
        { status: 400 }
      );
    }

    const targetAgent = validateAgentType(agent || config.defaultAgent || 'codex');

    const result = await spawnAgentInTerminal({
      repoPath: targetPath,
      branchName,
      baseBranch,
      agent: targetAgent,
      prompt: resolvedPrompt,
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
