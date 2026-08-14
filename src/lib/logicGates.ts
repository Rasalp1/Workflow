import type { AgentType, EvaluatedGateResult, LogicalGateRule, PullRequest } from '../types/index.ts';

export function evaluateGateRule(
  rule: LogicalGateRule,
  pr: PullRequest,
  currentUserLogin: string | null,
  defaultAgent: AgentType
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

  // Condition: hasNoComments (PR has zero comments)
  if (rule.conditions.hasNoComments) {
    if ((pr.comments || []).length > 0) {
      passed = false;
    }
  }

  // Condition: hasCommentsByCurrentUser (PR has at least one comment by current user)
  if (rule.conditions.hasCommentsByCurrentUser) {
    if (!effectiveUser) {
      passed = false;
    } else {
      const hasUserComment = (pr.comments || []).some(
        (c) => c.user.login.toLowerCase() === effectiveUser
      );
      if (!hasUserComment) {
        passed = false;
      }
    }
  }

  // Condition 1: lastCommentNotCurrentUser
  // Treat the PR description (PR author) as the last activity when there are no comments.
  if (rule.conditions.lastCommentNotCurrentUser) {
    if (!effectiveUser) {
      passed = false;
    } else {
      const lastActivityUser = (pr.last_comment?.user.login ?? pr.user.login).toLowerCase();
      if (lastActivityUser === effectiveUser) {
        passed = false;
      }
    }
  }

  // Condition: hasMergeConflicts
  if (rule.conditions.hasMergeConflicts) {
    if (!pr.has_merge_conflicts) {
      passed = false;
    }
  }

  // Condition 2: lastCommentAuthorLogin
  if (rule.conditions.lastCommentAuthorLogin) {
    if (
      !pr.last_comment ||
      pr.last_comment.user.login.toLowerCase() !== rule.conditions.lastCommentAuthorLogin.toLowerCase()
    ) {
      passed = false;
    }
  }

  // Condition 3: hasUnresolvedComments
  if (rule.conditions.hasUnresolvedComments) {
    if (pr.comments.length === 0) {
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
    if (hasTwoConsecutiveCommentsByOthers(pr, currentUserLogin)) {
      passed = false;
    }
  }

  const generatedPrompt = formatPromptTemplate(rule.promptTemplate, pr);

  return {
    rule,
    passed,
    generatedPrompt,
    targetAgent: rule.agentOverride || defaultAgent,
  };
}

export function formatPromptTemplate(template: string, pr: PullRequest): string {
  const lastCommentAuthor = pr.last_comment?.user.login || 'Unknown';
  const lastCommentBody = pr.last_comment?.body || 'No recent comment';

  const commentsSummary = pr.comments
    .map((c) => `- @${c.user.login} (${c.is_review_comment ? 'Code Review' : 'Comment'}): ${c.body}`)
    .join('\n');

  return template
    .replace(/{pr_number}/g, String(pr.number))
    .replace(/{pr_title}/g, pr.title)
    .replace(/{repo_name}/g, pr.repo_full_name)
    .replace(/{branch}/g, pr.head.ref)
    .replace(/{base_branch}/g, pr.base.ref)
    .replace(/{base branch}/g, pr.base.ref)
    .replace(/{author}/g, pr.user.login)
    .replace(/{pr_author}/g, `@${pr.user.login}`)
    .replace(/{last_comment_author}/g, lastCommentAuthor)
    .replace(/{last_comment_body}/g, lastCommentBody)
    .replace(/{comments_summary}/g, commentsSummary || 'No comments');
}

/**
 * Checks if there are 2 comments in a row by 2 distinct users (neither of which is the current user)
 * since the last comment made by the current user (or across all comments if the current user never commented).
 * This indicates that the PR is actively being reviewed or discussed by other individuals.
 */
export function hasTwoConsecutiveCommentsByOthers(
  pr: PullRequest,
  currentUserLogin: string | null
): boolean {
  if (!currentUserLogin) return false;
  const effectiveUser = currentUserLogin.toLowerCase();
  const comments = pr.comments || [];
  if (comments.length < 2) return false;

  // Find the index of the last comment made by the current user
  let lastUserCommentIndex = -1;
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i]?.user?.login?.toLowerCase() === effectiveUser) {
      lastUserCommentIndex = i;
      break;
    }
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
  currentUserLogin: string | null
): boolean {
  if (!currentUserLogin) return true;

  const effectiveUser = currentUserLogin.toLowerCase();
  const isOwner = pr.user.login.toLowerCase() === effectiveUser;
  const lastUser = (pr.last_comment?.user.login ?? pr.user.login).toLowerCase();
  const notOurLatestComment = lastUser !== effectiveUser;
  const userOwnedWithConflict = isOwner && Boolean(pr.has_merge_conflicts);

  if (userOwnedWithConflict) return true;
  if (!notOurLatestComment) return false;

  // On PRs not owned by the current user: if there have been two comments in a row
  // by 2 other individual users that are NOT the current user, it has probably
  // been reviewed by someone else, so it is not awaiting our comment.
  if (!isOwner && hasTwoConsecutiveCommentsByOthers(pr, currentUserLogin)) {
    return false;
  }

  return true;
}

