import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ActiveAgentInfo, AgentType, PRWithGates } from '@/types';
import { getActiveAgentCardIdsToClear } from '@/lib/activeAgentState';

const DATA_DIR = path.join(process.cwd(), '.workflow-data');
const ACTIVE_AGENTS_FILE = path.join(DATA_DIR, 'active-agents.json');

/** Sessions older than this are considered abandoned and pruned on read. */
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * A just-launched agent has not had time to push anything yet, so the PR still
 * looks "already handled" to the reconciler. Hold new sessions for this long so
 * the badge does not disappear seconds after the agent starts.
 */
const RECONCILE_GRACE_MS = 5 * 60 * 1000;

export type ActiveAgentMap = Record<string, ActiveAgentInfo>;

/**
 * Serializes all mutations so concurrent writers (browser + menu bar app both
 * call these routes) can never interleave a read-modify-write cycle.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => {});
  return next;
}

/** Canonical card identifier shared by the dashboard, the API and the menu bar app. */
export function buildAgentCardId(repoFullName: string, prNumber: number | string): string {
  return `pr-card-${repoFullName}-${prNumber}`;
}

/** Strips the column prefixes the dashboard adds to its rendered card ids. */
export function normalizeAgentCardId(cardId: string): string {
  return cardId.replace(/^(col1-|col2-)/, '');
}

function isFreshSession(info: ActiveAgentInfo | undefined): info is ActiveAgentInfo {
  if (!info || typeof info.timestamp !== 'number') return false;
  return Date.now() - info.timestamp < SESSION_MAX_AGE_MS;
}

function prune(map: ActiveAgentMap): ActiveAgentMap {
  return Object.fromEntries(Object.entries(map).filter(([, info]) => isFreshSession(info)));
}

async function ensureDataDirExists(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await ensureDataDirExists();
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function readRawFromDisk(): Promise<ActiveAgentMap> {
  if (!existsSync(ACTIVE_AGENTS_FILE)) return {};
  try {
    const raw = await fs.readFile(ACTIVE_AGENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ActiveAgentMap;
  } catch (error) {
    console.error('Failed to parse active agents file:', error);
    return {};
  }
}

async function readFromDisk(): Promise<ActiveAgentMap> {
  return prune(await readRawFromDisk());
}

export async function loadActiveAgents(): Promise<ActiveAgentMap> {
  return enqueue(readFromDisk);
}

export async function setActiveAgent(
  cardId: string,
  info: { agent: AgentType; branch?: string; source?: ActiveAgentInfo['source'] }
): Promise<ActiveAgentMap> {
  const key = normalizeAgentCardId(cardId);
  return enqueue(async () => {
    const current = await readFromDisk();
    const updated: ActiveAgentMap = {
      ...current,
      [key]: {
        agent: info.agent,
        timestamp: Date.now(),
        ...(info.branch ? { branch: info.branch } : {}),
        ...(info.source ? { source: info.source } : {}),
      },
    };
    await atomicWriteJson(ACTIVE_AGENTS_FILE, updated);
    return updated;
  });
}

export async function clearActiveAgent(cardId: string): Promise<ActiveAgentMap> {
  const key = normalizeAgentCardId(cardId);
  return enqueue(async () => {
    const current = await readFromDisk();
    if (!(key in current)) return current;
    const updated = { ...current };
    delete updated[key];
    await atomicWriteJson(ACTIVE_AGENTS_FILE, updated);
    return updated;
  });
}

export async function clearAllActiveAgents(): Promise<ActiveAgentMap> {
  return enqueue(async () => {
    await atomicWriteJson(ACTIVE_AGENTS_FILE, {});
    return {};
  });
}

/**
 * Drops sessions whose PR no longer needs the user (the agent pushed its work and
 * the user now holds the latest activity with no actionable gate left), plus any
 * session that aged out. Runs on every PR fetch so both clients agree on state.
 */
export async function reconcileActiveAgents(
  prsWithGates: PRWithGates[],
  currentUserLogin: string | null
): Promise<ActiveAgentMap> {
  return enqueue(async () => {
    const beforePrune = await readRawFromDisk();
    const current = prune(beforePrune);
    const agedOut = Object.keys(beforePrune).length !== Object.keys(current).length;

    const settled = Object.fromEntries(
      Object.entries(current).filter(([, info]) => Date.now() - info.timestamp >= RECONCILE_GRACE_MS)
    );
    const staleCardIds = getActiveAgentCardIdsToClear(settled, prsWithGates, currentUserLogin);

    if (staleCardIds.length === 0 && !agedOut) return current;

    const updated = { ...current };
    staleCardIds.forEach((cardId) => delete updated[cardId]);
    await atomicWriteJson(ACTIVE_AGENTS_FILE, updated);
    return updated;
  });
}
