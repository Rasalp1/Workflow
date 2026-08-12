import { existsSync } from 'fs';

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

  if (localPath.includes('\0') || localPath.includes('..')) {
    throw new Error(`Invalid local directory path "${localPath}". Traversal or null bytes detected.`);
  }

  if (!existsSync(localPath)) {
    throw new Error(`Local directory "${localPath}" does not exist on disk.`);
  }
}

/**
 * Verifies request headers to ensure local origin and mitigate CSRF attacks on local API routes.
 */
export function validateOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const allowedHosts = ['localhost', '127.0.0.1', '[::1]'];
      if (host) {
        allowedHosts.push(host.split(':')[0]);
      }

      if (!allowedHosts.includes(originUrl.hostname)) {
        throw new Error(`Forbidden cross-origin request from "${origin}"`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Invalid origin header: ${msg}`);
    }
  }
}
