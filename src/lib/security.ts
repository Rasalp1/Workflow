import { existsSync, statSync } from 'fs';
import path from 'path';
import type { AgentType } from '../types/index.ts';

const VALID_AGENT_TYPES: readonly AgentType[] = ['codex', 'claude'];

/**
 * Validates that a value is a known agent type before it can reach a shell command.
 * Rejects anything outside the fixed allowlist to prevent command injection via the
 * `agent` field, which is otherwise interpolated unquoted into a terminal command.
 */
export function validateAgentType(agent: unknown): AgentType {
  if (typeof agent === 'string' && (VALID_AGENT_TYPES as readonly string[]).includes(agent)) {
    return agent as AgentType;
  }
  throw new Error(`Invalid agent type "${String(agent)}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}.`);
}

/**
 * Validates and sanitizes a git branch name to prevent shell command injection.
 * Branch names can typically contain alphanumerics, slashes, dashes, dots, underscores.
 * Any character outside this strict set will throw an Error.
 */
export function sanitizeBranchName(branchName: string): string {
  if (!branchName || typeof branchName !== 'string') {
    throw new Error('Branch name must be a non-empty string.');
  }

  const trimmed = branchName.trim();
  // Regex allows letters, digits, dots, hyphens, underscores, forward slashes
  const safeRegex = /^[a-zA-Z0-9._/-]+$/;

  if (!safeRegex.test(trimmed)) {
    throw new Error(`Invalid branch name "${branchName}". Contains unsafe shell characters.`);
  }

  // Prevent directory traversal or flag options (e.g. starting with -)
  if (trimmed.startsWith('-') || trimmed.includes('..')) {
    throw new Error(`Unsafe branch name "${branchName}". Cannot start with "-" or contain "..".`);
  }

  return trimmed;
}

/**
 * Validates a local filesystem directory path.
 */
export function validateLocalPath(localPath: string): void {
  if (!localPath || typeof localPath !== 'string') {
    throw new Error('Local directory path is required.');
  }

  const trimmed = localPath.trim();
  if (trimmed.includes('\0') || trimmed.includes('..')) {
    throw new Error(`Invalid local directory path "${localPath}". Traversal or null bytes detected.`);
  }

  if (!path.isAbsolute(trimmed)) {
    throw new Error(`Invalid local directory path "${localPath}". An absolute path is required.`);
  }

  if (!existsSync(trimmed)) {
    throw new Error(`Local directory "${localPath}" does not exist on disk.`);
  }

  if (!statSync(trimmed).isDirectory()) {
    throw new Error(`Local path "${localPath}" is not a directory.`);
  }
}

/**
 * Verifies request headers to ensure local origin and mitigate CSRF attacks on local API routes.
 */
export function validateOrigin(request: Request): void {
  const origin = request.headers.get('origin');

  if (!origin) {
    throw new Error('Missing Origin header on state-changing request.');
  }

  try {
    const originUrl = new URL(origin);
    const allowedHosts = ['localhost', '127.0.0.1', '[::1]'];

    if (!allowedHosts.includes(originUrl.hostname)) {
      throw new Error(`Forbidden cross-origin request from "${origin}"`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid origin header: ${msg}`);
  }
}

/** Restricts GitHub mutations to repositories explicitly configured by the user. */
export function validateConfiguredRepo(repoFullName: unknown, monitoredRepos: readonly string[]): string {
  if (typeof repoFullName !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
    throw new Error('Repository must use the "owner/repo" format.');
  }
  if (!monitoredRepos.includes(repoFullName)) {
    throw new Error(`Repository "${repoFullName}" is not configured for this dashboard.`);
  }
  return repoFullName;
}

/** Accepts only a concrete, positive GitHub pull-request number. */
export function validatePullRequestNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('Pull request number must be a positive integer.');
  }
  return number;
}

/**
 * Strips non-BMP characters (such as emojis or characters above U+FFFF)
 * which cannot be handled by AppleScript System Events keystrokes without terminal/process corruption.
 */
export function stripNonBmpChars(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^\u0000-\uFFFF]/gu, '');
}

/** Escapes untrusted values before embedding them in an AppleScript string literal. */
export function escapeAppleScriptString(input: string): string {
  return stripNonBmpChars(input)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}
