import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getActiveAgentCardIdsToClear } from '../activeAgentState.ts';
import type { ActiveAgentInfo, PRWithGates, PullRequest } from '../../types/index.ts';

const activeAgent: ActiveAgentInfo = {
  agent: 'codex',
  timestamp: 1,
};

const basePR: PullRequest = {
  id: 1,
  number: 42,
  title: 'Improve the workflow',
  body: '',
  state: 'open',
  is_draft: false,
  html_url: 'https://github.com/org/repo/pull/42',
  created_at: '2026-08-17T08:00:00Z',
  updated_at: '2026-08-17T09:00:00Z',
  head: { ref: 'feature', sha: 'abc123' },
  base: { ref: 'main' },
  user: { login: 'reviewer', avatar_url: '', html_url: '' },
  repo_owner: 'org',
  repo_name: 'repo',
  repo_full_name: 'org/repo',
  comments_count: 1,
  review_comments_count: 0,
  comments: [],
};

function prWithGates(overrides: Partial<PullRequest> = {}, passedGate = false): PRWithGates {
  return {
    pr: {
      ...basePR,
      ...overrides,
    },
    evaluatedGates: [
      {
        rule: {
          id: 'address-issues',
          name: 'Address Issues',
          description: '',
          enabled: true,
          buttonLabel: 'Address Issues',
          conditions: {},
          promptTemplate: '',
        },
        passed: passedGate,
        generatedPrompt: '',
        targetAgent: 'codex',
      },
    ],
  };
}

describe('active agent state reconciliation', () => {
  it('clears an active agent when the current user is latest and no gate passes', () => {
    const item = prWithGates({
      last_comment: {
        id: 2,
        user: { login: 'Alice', avatar_url: '', html_url: '' },
        body: 'Addressed the review feedback',
        created_at: '2026-08-17T09:00:00Z',
        updated_at: '2026-08-17T09:00:00Z',
        html_url: '',
        is_review_comment: false,
      },
    });

    assert.deepStrictEqual(
      getActiveAgentCardIdsToClear({ 'pr-card-org/repo-42': activeAgent }, [item], 'alice'),
      ['pr-card-org/repo-42']
    );
  });

  it('keeps the active agent when a gate still passes', () => {
    const item = prWithGates(
      {
        last_comment: {
          id: 2,
          user: { login: 'alice', avatar_url: '', html_url: '' },
          body: 'Addressed the review feedback',
          created_at: '2026-08-17T09:00:00Z',
          updated_at: '2026-08-17T09:00:00Z',
          html_url: '',
          is_review_comment: false,
        },
      },
      true
    );

    assert.deepStrictEqual(
      getActiveAgentCardIdsToClear({ 'pr-card-org/repo-42': activeAgent }, [item], 'alice'),
      []
    );
  });

  it('keeps the active agent when someone else is latest', () => {
    const item = prWithGates({
      last_comment: {
        id: 2,
        user: { login: 'reviewer', avatar_url: '', html_url: '' },
        body: 'Please address this',
        created_at: '2026-08-17T09:00:00Z',
        updated_at: '2026-08-17T09:00:00Z',
        html_url: '',
        is_review_comment: true,
      },
    });

    assert.deepStrictEqual(
      getActiveAgentCardIdsToClear({ 'pr-card-org/repo-42': activeAgent }, [item], 'alice'),
      []
    );
  });

  it('does not reconcile while the current user is unknown', () => {
    const item = prWithGates({ user: { login: 'alice', avatar_url: '', html_url: '' } });

    assert.deepStrictEqual(
      getActiveAgentCardIdsToClear({ 'pr-card-org/repo-42': activeAgent }, [item], null),
      []
    );
  });
});
