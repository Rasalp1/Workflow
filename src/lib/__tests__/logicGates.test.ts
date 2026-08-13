import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateGateRule, formatPromptTemplate, isPrAwaitingComment } from '../logicGates.ts';
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
  });
});

