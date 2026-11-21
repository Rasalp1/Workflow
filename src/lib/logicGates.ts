import type { AgentType, EvaluatedGateResult, LogicalGateRule, PRComment, PullRequest } from '../types/index.ts';
import { filterNonBotComments, getEffectiveLastComment } from './botDetection.ts';

export interface GateEvaluationOptions {
  includePrompt?: boolean;
  prefilteredComments?: PRComment[];
  prefilteredLastComment?: PRComment;
  hasTwoConsecutiveOthers?: boolean;
}

export function evaluateGateRule(
  rule: LogicalGateRule,
  pr: PullRequest,
  currentUserLogin: string | null,
  defaultAgent: AgentType,
  options: GateEvaluationOptions = {}
): EvaluatedGateResult {
  if (!rule.enabled) {
    return {
      rule,
      passed: false,
      generatedPrompt: '',
      targetAgent: rule.agentOverride || defaultAgent,
    };
  }

  let passed = true;

  const effectiveUser = currentUserLogin ? currentUserLogin.toLowerCase() : null;
  const effectiveComments = options.prefilteredComments ?? filterNonBotComments(pr.comments || []);
  const effectiveLastComment =
    'prefilteredLastComment' in options
      ? options.prefilteredLastComment
      : getEffectiveLastComment(effectiveComments, pr.last_comment);

  // Condition: prOwnedByCurrentUser (PR owned by user)
  if (rule.conditions.prOwnedByCurrentUser) {
    if (!effectiveUser || pr.user.login.toLowerCase() !== effectiveUser) {
      passed = false;
    }
  }

  // Condition: prOwnedByNonCurrentUser (PR owned by someone else)
  if (rule.conditions.prOwnedByNonCurrentUser) {
    if (effectiveUser && pr.user.login.toLowerCase() === effectiveUser) {
      passed = false;
    }
  }

  // Condition: hasNoComments (PR has zero non-bot comments)
  if (rule.conditions.hasNoComments) {
    if (effectiveComments.length > 0) {
      passed = false;
    }
  }

  // Condition: hasCommentsByCurrentUser (PR has at least one comment by current user)
  if (rule.conditions.hasCommentsByCurrentUser) {
    if (!effectiveUser) {
      passed = false;
    } else {
      const hasUserComment = effectiveComments.some(
        (c) => c.user.login.toLowerCase() === effectiveUser
      );
      if (!hasUserComment) {
        passed = false;
      }
    }
  }

  // Condition 1: lastCommentNotCurrentUser
  // Treat the PR description (PR author) as the last activity when there are no non-bot comments.
  if (rule.conditions.lastCommentNotCurrentUser) {
    if (!effectiveUser) {
      passed = false;
    } else {
      const lastActivityUser = (effectiveLastComment?.user.login ?? pr.user.login).toLowerCase();
      if (lastActivityUser === effectiveUser) {
        passed = false;
      }
    }
  }

  // Condition: hasMergeConflicts
  if (rule.conditions.hasMergeConflicts) {
    if (!pr.has_merge_conflicts && pr.mergeable_state !== 'dirty') {
      passed = false;
    }
  }

  // Condition 2: lastCommentAuthorLogin
  if (rule.conditions.lastCommentAuthorLogin) {
    if (
      !effectiveLastComment ||
      effectiveLastComment.user.login.toLowerCase() !== rule.conditions.lastCommentAuthorLogin.toLowerCase()
    ) {
      passed = false;
    }
  }

  // Condition 3: hasUnresolvedComments
  if (rule.conditions.hasUnresolvedComments) {
    if (effectiveComments.length === 0) {
      passed = false;
    }
  }

  // Condition 4: checksFailing
  if (rule.conditions.checksFailing) {
    if (pr.checks_status !== 'failure') {
      passed = false;
    }
  }

  // Condition: titleOrBodyKeyword
  if (rule.conditions.titleOrBodyKeyword) {
    const keyword = rule.conditions.titleOrBodyKeyword.toLowerCase();
    const matchesTitle = pr.title.toLowerCase().includes(keyword);
    const matchesBody = pr.body.toLowerCase().includes(keyword);
    if (!matchesTitle && !matchesBody) {
      passed = false;
    }
  }

  // Condition: isDraft (Draft PR rule)
  // If PR is a draft, only rules designed for draft PRs apply.
  // If PR is not a draft, draft-specific rules do not apply.
  if (pr.is_draft) {
    if (!rule.conditions.isDraft) {
      passed = false;
    }
  } else {
    if (rule.conditions.isDraft) {
      passed = false;
    }
  }

  // Condition: notReviewedByOthers (Exclude PRs where 2 other distinct users commented in a row)
  if (rule.conditions.notReviewedByOthers) {
    const reviewedByOthers =
      options.hasTwoConsecutiveOthers ??
      hasTwoConsecutiveCommentsByOthers(pr, currentUserLogin, effectiveComments, effectiveLastComment);
    if (reviewedByOthers) {
      passed = false;
    }
  }

  const includePrompt = options.includePrompt ?? true;
  const generatedPrompt = includePrompt
    ? formatPromptTemplate(rule.promptTemplate, pr, {
        prefilteredComments: effectiveComments,
        prefilteredLastComment: effectiveLastComment,
      })
    : '';

  return {
    rule,
    passed,
    generatedPrompt,
    targetAgent: rule.agentOverride || defaultAgent,
  };
}

/**
 * Evaluates all gate rules for a PR while filtering bot comments and computing
 * multi-reviewer heuristics at most once per PR instead of once per rule.
 */
export function evaluateGatesForPR(
  rules: LogicalGateRule[],
  pr: PullRequest,
  currentUserLogin: string | null,
  defaultAgent: AgentType,
  options: { includePrompt?: boolean } = {}
): {
  evaluatedGates: EvaluatedGateResult[];
  needsAttention: boolean;
} {
  const effectiveComments = filterNonBotComments(pr.comments || []);
  const effectiveLastComment = getEffectiveLastComment(effectiveComments, pr.last_comment);
  const hasTwoOthers = hasTwoConsecutiveCommentsByOthers(
    pr,
    currentUserLogin,
    effectiveComments,
    effectiveLastComment
  );

  const evalOptions: GateEvaluationOptions = {
    includePrompt: options.includePrompt ?? true,
    prefilteredComments: effectiveComments,
    prefilteredLastComment: effectiveLastComment,
    hasTwoConsecutiveOthers: hasTwoOthers,
  };

  const evaluatedGates = rules.map((rule) =>
    evaluateGateRule(rule, pr, currentUserLogin, defaultAgent, evalOptions)
  );

  const needsAttention = isPrAwaitingComment(
    pr,
    currentUserLogin,
    effectiveComments,
    effectiveLastComment,
    hasTwoOthers
  );

  return { evaluatedGates, needsAttention };
}

export function formatPromptTemplate(
  template: string,
  pr: PullRequest,
  options: {
    prefilteredComments?: PRComment[];
    prefilteredLastComment?: PRComment;
  } = {}
): string {
  const needsCommentsSummary = template.includes('{comments_summary}');
  const needsLastComment =
    template.includes('{last_comment_author}') || template.includes('{last_comment_body}');

  let effectiveComments: PRComment[] | undefined = options.prefilteredComments;
  let effectiveLastComment: PRComment | undefined = options.prefilteredLastComment;

  if ((needsCommentsSummary || needsLastComment) && !effectiveComments) {
    effectiveComments = filterNonBotComments(pr.comments || []);
  }
  if (needsLastComment && !('prefilteredLastComment' in options)) {
    effectiveLastComment = getEffectiveLastComment(effectiveComments || [], pr.last_comment);
  }

  const authorLogin = pr.user?.login || 'unknown';
  const authorMention = `@${authorLogin}`;

  let result = template
    .replace(/{pr_number}/g, String(pr.number))
    .replace(/{pr_title}/g, pr.title)
    .replace(/{pr_body}/g, pr.body || '')
    .replace(/{repo_name}/g, pr.repo_full_name)
    .replace(/{branch}/g, pr.head.ref)
    .replace(/{base_branch}/g, pr.base.ref)
    .replace(/{base branch}/g, pr.base.ref)
    .replace(/{target_branch}/g, pr.base.ref)
    .replace(/{target branch}/g, pr.base.ref)
    .replace(/@\s*{pr_author}/g, authorMention)
    .replace(/{pr_author}/g, authorMention)
    .replace(/@\s*pr_author\b/g, authorMention)
    .replace(/@\s*{author}/g, authorMention)
    .replace(/@\s*author\b/g, authorMention)
    .replace(/{author}/g, authorLogin);

  if (needsLastComment) {
    const lastCommentAuthor = effectiveLastComment?.user.login || 'Unknown';
    const lastCommentBody = effectiveLastComment?.body || 'No recent comment';
    result = result
      .replace(/{last_comment_author}/g, lastCommentAuthor)
      .replace(/{last_comment_body}/g, lastCommentBody);
  }

  if (needsCommentsSummary) {
    const commentsSummary = (effectiveComments || [])
      .map((c) => `- @${c.user.login} (${c.is_review_comment ? 'Code Review' : 'Comment'}): ${c.body}`)
      .join('\n');
    result = result.replace(/{comments_summary}/g, commentsSummary || 'No comments');
  }

  return result;
}

/**
 * Checks if there are 2 comments in a row by 2 distinct users (neither of which is the current user)
 * since the last comment made by the current user (or across all comments if the current user never commented).
 * This indicates that the PR is actively being reviewed or discussed by other individuals.
 * Bot messages/comments are ignored.
 *
 * NOTE: If the current user previously participated/commented on this PR and the latest comment
 * is from the PR author, it indicates that the author has addressed the review feedback
 * (including any intervening reviews by others), so the PR is once again awaiting the current user's review.
 */
export function hasTwoConsecutiveCommentsByOthers(
  pr: PullRequest,
  currentUserLogin: string | null,
  prefilteredComments?: PRComment[],
  prefilteredLastComment?: PRComment
): boolean {
  if (!currentUserLogin) return false;
  const effectiveUser = currentUserLogin.toLowerCase();
  const comments = prefilteredComments ?? filterNonBotComments(pr.comments || []);
  if (comments.length < 2) return false;

  // Find the index of the last comment made by the current user
  let lastUserCommentIndex = -1;
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i]?.user?.login?.toLowerCase() === effectiveUser) {
      lastUserCommentIndex = i;
      break;
    }
  }

  // If the current user previously participated on this PR, and the latest comment
  // is from the PR author, the author has addressed feedback.
  // The PR is therefore relevant again for the current user's follow-up review.
  const prAuthor = pr.user.login.toLowerCase();
  const effectiveLast =
    prefilteredLastComment !== undefined
      ? prefilteredLastComment
      : getEffectiveLastComment(comments, pr.last_comment);
  const lastCommentUser = (effectiveLast?.user?.login ?? comments[comments.length - 1]?.user?.login)?.toLowerCase();
  if (lastUserCommentIndex >= 0 && lastCommentUser === prAuthor) {
    return false;
  }

  // Only examine comments posted after our user's latest comment (or all comments if user never commented)
  const commentsSinceUser = lastUserCommentIndex >= 0
    ? comments.slice(lastUserCommentIndex + 1)
    : comments;

  if (commentsSinceUser.length < 2) return false;

  // Check for any 2 adjacent comments made by 2 different users (neither being currentUser)
  for (let i = 0; i < commentsSinceUser.length - 1; i++) {
    const userA = commentsSinceUser[i]?.user?.login?.toLowerCase();
    const userB = commentsSinceUser[i + 1]?.user?.login?.toLowerCase();

    if (userA && userB && userA !== effectiveUser && userB !== effectiveUser && userA !== userB) {
      return true;
    }
  }

  return false;
}

export function isPrAwaitingComment(
  pr: PullRequest,
  currentUserLogin: string | null,
  prefilteredComments?: PRComment[],
  prefilteredLastComment?: PRComment,
  prefilteredHasTwoOthers?: boolean
): boolean {
  if (!currentUserLogin) return true;

  const effectiveUser = currentUserLogin.toLowerCase();
  const isOwner = pr.user.login.toLowerCase() === effectiveUser;
  const effectiveLastComment =
    prefilteredLastComment !== undefined
      ? prefilteredLastComment
      : getEffectiveLastComment(prefilteredComments ?? pr.comments, pr.last_comment);
  const lastUser = (effectiveLastComment?.user.login ?? pr.user.login).toLowerCase();
  const notOurLatestComment = lastUser !== effectiveUser;
  const userOwnedWithConflict = isOwner && (Boolean(pr.has_merge_conflicts) || pr.mergeable_state === 'dirty');

  if (userOwnedWithConflict) return true;
  if (!notOurLatestComment) return false;

  // On PRs not owned by the current user: if there have been two comments in a row
  // by 2 other individual users that are NOT the current user, it has probably
  // been reviewed by someone else, so it is not awaiting our comment.
  const twoOthers =
    prefilteredHasTwoOthers ??
    hasTwoConsecutiveCommentsByOthers(pr, currentUserLogin, prefilteredComments, effectiveLastComment);
  if (!isOwner && twoOthers) {
    return false;
  }

  return true;
}

