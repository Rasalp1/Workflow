import type { ActiveAgentInfo, PRWithGates } from '../types/index.ts';

/**
 * Finds locally tracked agent sessions that are no longer actionable for the
 * current user after a fresh PR fetch.
 */
export function getActiveAgentCardIdsToClear(
  activeAgentPRs: Record<string, ActiveAgentInfo>,
  prsWithGates: PRWithGates[],
  currentUserLogin: string | null,
): string[] {
  if (!currentUserLogin) return [];

  const effectiveUser = currentUserLogin.toLowerCase();
  const fetchedPRsByCardId = new Map<string, PRWithGates>(
    prsWithGates.map((prWithGates) => {
      const { pr } = prWithGates;
      return [`pr-card-${pr.repo_full_name}-${pr.number}`, prWithGates] as const;
    })
  );

  return Object.keys(activeAgentPRs).filter((cardId) => {
    const prWithGates = fetchedPRsByCardId.get(cardId);
    if (!prWithGates) return false;

    const { pr, evaluatedGates } = prWithGates;
    const latestActivityUser = (pr.last_comment?.user.login ?? pr.user.login).toLowerCase();
    const userHasLatestActivity = latestActivityUser === effectiveUser;
    const hasActionableGate = evaluatedGates.some((gate) => gate.passed);

    return userHasLatestActivity && !hasActionableGate;
  });
}
