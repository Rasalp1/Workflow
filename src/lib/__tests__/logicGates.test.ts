import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateGateRule, formatPromptTemplate, hasTwoConsecutiveCommentsByOthers, isPrAwaitingComment } from '../logicGates.ts';
import type { LogicalGateRule, PullRequest } from '../../types/index.ts';

describe('Logic Gates Evaluator', () => {
  const dummyPR: PullRequest = {
    id: 101,
    number: 42,
    title: 'Fix critical bug in authentication',
    body: 'Resolves issue with token refresh',
    state: 'open',
    is_draft: false,
    html_url: 'https://github.com/org/repo/pull/42',
    created_at: '2026-08-12T10:00:00Z',
    updated_at: '2026-08-12T11:00:00Z',
    head: { ref: 'fix-auth', sha: 'abc1234' },
    base: { ref: 'main' },
    user: { login: 'alice', avatar_url: '', html_url: '' },
    repo_owner: 'org',
    repo_name: 'repo',
    repo_full_name: 'org/repo',
    comments_count: 1,
    review_comments_count: 0,
    comments: [
      {
        id: 1,
        user: { login: 'bob', avatar_url: '', html_url: '' },
        body: 'Please add unit tests for this change',
        created_at: '2026-08-12T10:30:00Z',
        updated_at: '2026-08-12T10:30:00Z',
        html_url: '',
        is_review_comment: false,
      },
    ],
    last_comment: {
      id: 1,
      user: { login: 'bob', avatar_url: '', html_url: '' },
      body: 'Please add unit tests for this change',
      created_at: '2026-08-12T10:30:00Z',
      updated_at: '2026-08-12T10:30:00Z',
      html_url: '',
      is_review_comment: false,
    },
    checks_status: 'success',
    has_merge_conflicts: false,
  };

  const sampleRule: LogicalGateRule = {
    id: 'address-issues',
    name: 'Address Review Issues',
    description: 'PR owned by user with latest comment from someone else.',
    enabled: true,
    buttonLabel: 'Address Issues',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByCurrentUser: true,
      lastCommentNotCurrentUser: true,
    },
    promptTemplate: 'Fix PR #{pr_number} in {repo_name}',
  };

  it('should pass rule when PR author matches currentUser and last comment is from someone else', () => {
    const result = evaluateGateRule(sampleRule, dummyPR, 'alice', 'codex');
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.generatedPrompt, 'Fix PR #42 in org/repo');
  });

  it('should fail rule when PR author does not match currentUser', () => {
    const result = evaluateGateRule(sampleRule, dummyPR, 'charlie', 'codex');
    assert.strictEqual(result.passed, false);
  });

  it('should fail rule when currentUser is null', () => {
    const result = evaluateGateRule(sampleRule, dummyPR, null, 'codex');
    assert.strictEqual(result.passed, false);
  });

  it('should correctly replace prompt placeholders', () => {
    const template = 'PR #{pr_number} by @{author} on branch {branch} in {repo_name}';
    const formatted = formatPromptTemplate(template, dummyPR);
    assert.strictEqual(formatted, 'PR #42 by @alice on branch fix-auth in org/repo');
  });

  it('should pass review-with-context rule when PR owned by non-user and last comment is by non-user even without prior user comments', () => {
    const reviewRule: LogicalGateRule = {
      id: 'review-with-context',
      name: 'Review With Context',
      description: 'PR owned by someone else with new comments.',
      enabled: true,
      buttonLabel: 'Review with context',
      actionType: 'spawn_agent',
      conditions: {
        prOwnedByNonCurrentUser: true,
        lastCommentNotCurrentUser: true,
      },
      promptTemplate: 'Review PR #{pr_number}',
    };

    // dummyPR author is 'alice', last commenter is 'bob', currentUser is 'charlie'
    const result = evaluateGateRule(reviewRule, dummyPR, 'charlie', 'codex');
    assert.strictEqual(result.passed, true);
  });

  it('should pass draft rule and suppress non-draft rules when PR is draft', () => {
    const draftPR: PullRequest = {
      ...dummyPR,
      is_draft: true,
    };

    const draftRule: LogicalGateRule = {
      id: 'convert-draft-to-ready',
      name: 'Mark Ready for Review',
      description: 'Converts draft to open PR.',
      enabled: true,
      buttonLabel: 'Ready for Review',
      actionType: 'undraft_pr',
      conditions: {
        isDraft: true,
      },
      promptTemplate: 'Convert PR #{pr_number} from draft to open PR.',
    };

    // Draft rule on draft PR -> should pass
    const draftResult = evaluateGateRule(draftRule, draftPR, 'alice', 'codex');
    assert.strictEqual(draftResult.passed, true);

    // Non-draft rule on draft PR -> should be suppressed (passed = false)
    const normalResult = evaluateGateRule(sampleRule, draftPR, 'alice', 'codex');
    assert.strictEqual(normalResult.passed, false);
  });

  it('should fail draft rule when PR is not draft', () => {
    const draftRule: LogicalGateRule = {
      id: 'convert-draft-to-ready',
      name: 'Mark Ready for Review',
      description: 'Converts draft to open PR.',
      enabled: true,
      buttonLabel: 'Ready for Review',
      actionType: 'undraft_pr',
      conditions: {
        isDraft: true,
      },
      promptTemplate: 'Convert PR #{pr_number} from draft to open PR.',
    };

    // Draft rule on non-draft PR -> should fail
    const result = evaluateGateRule(draftRule, dummyPR, 'alice', 'codex');
    assert.strictEqual(result.passed, false);
  });

  describe('isPrAwaitingComment', () => {
    it('returns true when last comment is by someone else', () => {
      // dummyPR author is alice, last comment is by bob
      assert.strictEqual(isPrAwaitingComment(dummyPR, 'alice'), true);
    });

    it('returns false when user owned PR has no conflicts and user is last commenter', () => {
      const userLastPR: PullRequest = {
        ...dummyPR,
        last_comment: {
          id: 2,
          user: { login: 'alice', avatar_url: '', html_url: '' },
          body: 'Done fixing!',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
        has_merge_conflicts: false,
      };
      assert.strictEqual(isPrAwaitingComment(userLastPR, 'alice'), false);
    });

    it('returns true when user owned PR has merge conflicts regardless of last commenter', () => {
      const userLastConflictPR: PullRequest = {
        ...dummyPR,
        last_comment: {
          id: 2,
          user: { login: 'alice', avatar_url: '', html_url: '' },
          body: 'Done fixing!',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
        has_merge_conflicts: true,
      };
      // Even though alice is the last commenter, because she owns it and it has conflicts, it requires attention!
      assert.strictEqual(isPrAwaitingComment(userLastConflictPR, 'alice'), true);
    });

    it('returns false when non-user PR has two consecutive comments by two other distinct users', () => {
      const nonUserPRWithTwoOtherComments: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' }, // owned by bob
        comments: [
          {
            id: 1,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'Can you refactor this method?',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'bob', avatar_url: '', html_url: '' },
            body: 'Refactored in latest commit!',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Refactored in latest commit!',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      // Current user is alice. The PR is owned by bob, and has 2 comments by charlie and bob (2 other users).
      // It has been reviewed by someone else, so it should NOT be marked as awaiting alice's comment.
      assert.strictEqual(isPrAwaitingComment(nonUserPRWithTwoOtherComments, 'alice'), false);
      assert.strictEqual(hasTwoConsecutiveCommentsByOthers(nonUserPRWithTwoOtherComments, 'alice'), true);
    });

    it('returns true when non-user PR has two consecutive comments by the SAME other user', () => {
      const nonUserPRSameUserComments: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' }, // owned by bob
        comments: [
          {
            id: 1,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'First thought',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: false,
          },
          {
            id: 2,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'Second thought',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'charlie', avatar_url: '', html_url: '' },
          body: 'Second thought',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      // Not 2 distinct other users, only 1 user (charlie) commented twice
      assert.strictEqual(isPrAwaitingComment(nonUserPRSameUserComments, 'alice'), true);
      assert.strictEqual(hasTwoConsecutiveCommentsByOthers(nonUserPRSameUserComments, 'alice'), false);
    });

    it('returns true when non-user PR has comments involving the current user', () => {
      const nonUserPRWithUserComment: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' }, // owned by bob
        comments: [
          {
            id: 1,
            user: { login: 'alice', avatar_url: '', html_url: '' }, // alice reviewed
            body: 'Please fix X',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'bob', avatar_url: '', html_url: '' }, // bob answered
            body: 'Fixed X',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Fixed X',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      // Because alice was the reviewer, bob's reply means this IS awaiting alice's review/comment
      assert.strictEqual(isPrAwaitingComment(nonUserPRWithUserComment, 'alice'), true);
      assert.strictEqual(hasTwoConsecutiveCommentsByOthers(nonUserPRWithUserComment, 'alice'), false);
    });

    it('returns false when 2 distinct other users commented in a row since our user last commented, even if not the final 2 comments', () => {
      const prWithExchangeSinceUser: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' }, // owned by bob
        comments: [
          {
            id: 1,
            user: { login: 'alice', avatar_url: '', html_url: '' }, // our user commented initially
            body: 'Initial note',
            created_at: '2026-08-12T09:00:00Z',
            updated_at: '2026-08-12T09:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
          {
            id: 2,
            user: { login: 'charlie', avatar_url: '', html_url: '' }, // charlie reviewed
            body: 'I will take over review, change Z',
            created_at: '2026-08-12T10:00:00Z',
            updated_at: '2026-08-12T10:00:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 3,
            user: { login: 'bob', avatar_url: '', html_url: '' }, // bob answered charlie
            body: 'Changed Z!',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
          {
            id: 4,
            user: { login: 'bob', avatar_url: '', html_url: '' }, // bob added another note
            body: 'Also re-ran tests and they pass',
            created_at: '2026-08-12T11:05:00Z',
            updated_at: '2026-08-12T11:05:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 4,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Also re-ran tests and they pass',
          created_at: '2026-08-12T11:05:00Z',
          updated_at: '2026-08-12T11:05:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      // Since Alice's last comment at id: 1, comments are [charlie, bob, bob].
      // Pair (charlie, bob) represents 2 comments in a row by 2 other users since Alice's last comment.
      // So this PR was reviewed by charlie and is not awaiting alice's comment.
      assert.strictEqual(isPrAwaitingComment(prWithExchangeSinceUser, 'alice'), false);
      assert.strictEqual(hasTwoConsecutiveCommentsByOthers(prWithExchangeSinceUser, 'alice'), true);
    });

    it('returns true when an exchange between others happened before our user last commented, but only 1 response since our user comment', () => {
      const prUserCommentedAfterOldExchange: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' }, // owned by bob
        comments: [
          {
            id: 1,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'Old review',
            created_at: '2026-08-12T09:00:00Z',
            updated_at: '2026-08-12T09:00:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'bob', avatar_url: '', html_url: '' },
            body: 'Old reply',
            created_at: '2026-08-12T09:30:00Z',
            updated_at: '2026-08-12T09:30:00Z',
            html_url: '',
            is_review_comment: false,
          },
          {
            id: 3,
            user: { login: 'alice', avatar_url: '', html_url: '' }, // alice reviewed more recently
            body: 'Alice asks for security fix',
            created_at: '2026-08-12T10:00:00Z',
            updated_at: '2026-08-12T10:00:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 4,
            user: { login: 'bob', avatar_url: '', html_url: '' }, // bob answered alice
            body: 'Security fix is pushed!',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 4,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Security fix is pushed!',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      // Since Alice's last comment at id: 3, comments are only [bob].
      // There are NO 2 comments in a row by 2 other users SINCE alice's last comment.
      // So this PR IS awaiting alice's follow-up review!
      assert.strictEqual(isPrAwaitingComment(prUserCommentedAfterOldExchange, 'alice'), true);
      assert.strictEqual(hasTwoConsecutiveCommentsByOthers(prUserCommentedAfterOldExchange, 'alice'), false);
    });

    it('returns true when user owns the PR even if two other people commented', () => {
      const userOwnedPRWithTwoReviewers: PullRequest = {
        ...dummyPR,
        user: { login: 'alice', avatar_url: '', html_url: '' }, // owned by alice
        comments: [
          {
            id: 1,
            user: { login: 'bob', avatar_url: '', html_url: '' },
            body: 'Review 1',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'Review 2',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: true,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'charlie', avatar_url: '', html_url: '' },
          body: 'Review 2',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: true,
        },
      };

      // User owns the PR, so reviewer comments mean the user must act on it
      assert.strictEqual(isPrAwaitingComment(userOwnedPRWithTwoReviewers, 'alice'), true);
    });
  });

  describe('notReviewedByOthers condition in evaluateGateRule', () => {
    const reviewWithContextRule: LogicalGateRule = {
      id: 'review-with-context',
      name: 'Review With Context',
      description: 'PR owned by someone else with new comments.',
      enabled: true,
      buttonLabel: 'Review with context',
      actionType: 'spawn_agent',
      conditions: {
        prOwnedByNonCurrentUser: true,
        lastCommentNotCurrentUser: true,
        notReviewedByOthers: true,
      },
      promptTemplate: 'Review PR #{pr_number}',
    };

    it('fails rule when PR is reviewed by two other distinct users', () => {
      const prReviewedByOthers: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' },
        comments: [
          {
            id: 1,
            user: { login: 'charlie', avatar_url: '', html_url: '' },
            body: 'Review',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'bob', avatar_url: '', html_url: '' },
            body: 'Reply',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Reply',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      const result = evaluateGateRule(reviewWithContextRule, prReviewedByOthers, 'alice', 'codex');
      assert.strictEqual(result.passed, false);
    });

    it('passes rule when PR is replied to after current user reviewed', () => {
      const prRepliedToUser: PullRequest = {
        ...dummyPR,
        user: { login: 'bob', avatar_url: '', html_url: '' },
        comments: [
          {
            id: 1,
            user: { login: 'alice', avatar_url: '', html_url: '' },
            body: 'Review by alice',
            created_at: '2026-08-12T10:30:00Z',
            updated_at: '2026-08-12T10:30:00Z',
            html_url: '',
            is_review_comment: true,
          },
          {
            id: 2,
            user: { login: 'bob', avatar_url: '', html_url: '' },
            body: 'Reply by bob',
            created_at: '2026-08-12T11:00:00Z',
            updated_at: '2026-08-12T11:00:00Z',
            html_url: '',
            is_review_comment: false,
          },
        ],
        last_comment: {
          id: 2,
          user: { login: 'bob', avatar_url: '', html_url: '' },
          body: 'Reply by bob',
          created_at: '2026-08-12T11:00:00Z',
          updated_at: '2026-08-12T11:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      };

      const result = evaluateGateRule(reviewWithContextRule, prRepliedToUser, 'alice', 'codex');
      assert.strictEqual(result.passed, true);
    });
  });
});

