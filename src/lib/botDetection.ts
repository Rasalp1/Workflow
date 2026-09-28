import type { PRComment, PRUser } from '../types/index.ts';

/**
 * Known bot username keywords or prefixes (case-insensitive).
 */
const KNOWN_BOT_LOGINS = [
  'github-actions',
  'release-please',
  'netlify',
  'dependabot',
  'codecov',
  'vercel',
  'renovate',
  'snyk',
  'sonarcloud',
  'greenkeeper',
  'linear',
  'sentry-io',
  'copilot',
  'gemini-code-assist',
];

/**
 * Checks if a user is an automated bot account.
 * Recognizes:
 * - GitHub App bot suffix '[bot]' (e.g. 'netlify[bot]', 'release-please[bot]', 'github-actions[bot]')
 * - user.type === 'Bot'
 * - Common bot username patterns (-bot, _bot, bot-, bot_)
 * - Known bot logins (github-actions, release-please, netlify, dependabot, etc.)
 */
export function isBotUser(user?: Partial<PRUser> | Record<string, unknown> | null): boolean {
  if (!user) return false;

  const type = typeof user.type === 'string' ? user.type.toLowerCase() : '';
  if (type === 'bot') return true;

  const login = typeof user.login === 'string' ? user.login.toLowerCase().trim() : '';
  if (!login) return false;

  if (login.includes('[bot]')) return true;
  if (login === 'bot' || login.endsWith('-bot') || login.endsWith('_bot') || login.startsWith('bot-') || login.startsWith('bot_')) {
    return true;
  }

  return KNOWN_BOT_LOGINS.some(
    (bot) => login === bot || login.startsWith(`${bot}-`) || login.endsWith(`-${bot}`)
  );
}

/**
 * Checks if a comment/message was posted by a bot.
 * Inspects:
 * - Author user type and login via isBotUser
 * - performed_via_github_app flag
 * - Known automated bot message body patterns (e.g. Netlify deploy preview, release-please markers)
 */
export function isBotComment(comment?: Partial<PRComment> | Record<string, unknown> | null): boolean {
  if (!comment) return false;

  const user = (comment as { user?: Partial<PRUser> }).user;
  if (isBotUser(user)) return true;

  const performedViaApp = (comment as Record<string, unknown>).performed_via_github_app;
  if (Boolean(performedViaApp)) return true;

  const body = typeof (comment as { body?: string }).body === 'string'
    ? (comment as { body?: string }).body!
    : '';

  if (body) {
    const lowerBody = body.toLowerCase();
    // Netlify deploy preview comment patterns
    if (lowerBody.includes('deploy preview') && lowerBody.includes('netlify')) return true;
    if (lowerBody.includes('powered by netlify')) return true;

    // Release please bot automated comment markers
    if (
      lowerBody.includes('<!-- release-please-') ||
      lowerBody.includes('<!-- autorelease-') ||
      lowerBody.includes('<!-- release-please:')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Filters out all bot comments and reviews from a list of comments.
 */
export function filterNonBotComments(comments: PRComment[] = []): PRComment[] {
  return comments.filter((c) => !isBotComment(c));
}

/**
 * Returns the latest non-bot comment from a PR's comments list or explicit last_comment.
 * If the explicit last_comment is a bot comment or undefined, it searches backwards through
 * the comments list for the most recent non-bot comment.
 */
export function getEffectiveLastComment(
  comments: PRComment[] = [],
  explicitLastComment?: PRComment
): PRComment | undefined {
  if (explicitLastComment && !isBotComment(explicitLastComment)) {
    return explicitLastComment;
  }

  const nonBotComments = filterNonBotComments(comments);
  return nonBotComments.length > 0 ? nonBotComments[nonBotComments.length - 1] : undefined;
}
