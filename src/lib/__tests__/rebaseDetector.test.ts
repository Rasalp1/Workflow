import { describe, it } from 'node:test';
import assert from 'node:assert';
import { asksForRebase, checkRebaseStatus } from '../rebaseDetector.ts';
import type { PRComment, PRCommit } from '../../types/index.ts';

describe('Rebase Detector', () => {
  describe('asksForRebase', () => {
    it('should return true for comments asking for a rebase', () => {
      assert.strictEqual(asksForRebase('Please rebase on main'), true);
      assert.strictEqual(asksForRebase('Needs re-base before merge'), true);
      assert.strictEqual(asksForRebase('Can you rebased this branch?'), true);
      assert.strictEqual(asksForRebase('Rebase required'), true);
      assert.strictEqual(asksForRebase('REBASE'), true);
    });

    it('should return false for comments not mentioning rebase', () => {
      assert.strictEqual(asksForRebase('Looks good to me!'), false);
      assert.strictEqual(asksForRebase('Updated the database schema'), false);
      assert.strictEqual(asksForRebase('Fix bug in codebase'), false);
      assert.strictEqual(asksForRebase(''), false);
    });
  });

  describe('checkRebaseStatus', () => {
    const mockComment: PRComment = {
      id: 1,
      user: { login: 'reviewer', avatar_url: '', html_url: '' },
      body: 'Please rebase this PR on main.',
      created_at: '2026-08-13T10:00:00Z',
      updated_at: '2026-08-13T10:00:00Z',
      html_url: '',
      is_review_comment: false,
    };

    it('should return hasCommitsSince = false when no commits were made after comment', () => {
      const mockCommits: PRCommit[] = [
        {
          sha: 'abc1234',
          author_date: '2026-08-13T09:00:00Z',
          committer_date: '2026-08-13T09:00:00Z',
          message: 'Initial commit',
        },
      ];

      const status = checkRebaseStatus(mockComment, mockCommits);
      assert.strictEqual(status.asksForRebase, true);
      assert.strictEqual(status.hasCommitsSince, false);
      assert.strictEqual(status.commitsSinceCount, 0);
      assert.strictEqual(status.latestCommitDate, null);
    });

    it('should return hasCommitsSince = true when commits exist after comment date', () => {
      const mockCommits: PRCommit[] = [
        {
          sha: 'abc1234',
          author_date: '2026-08-13T09:00:00Z',
          committer_date: '2026-08-13T09:00:00Z',
          message: 'Initial commit',
        },
        {
          sha: 'def5678',
          author_date: '2026-08-13T10:30:00Z',
          committer_date: '2026-08-13T10:30:00Z',
          message: 'Rebase onto main',
        },
      ];

      const status = checkRebaseStatus(mockComment, mockCommits);
      assert.strictEqual(status.asksForRebase, true);
      assert.strictEqual(status.hasCommitsSince, true);
      assert.strictEqual(status.commitsSinceCount, 1);
      assert.strictEqual(status.latestCommitDate, '2026-08-13T10:30:00Z');
    });

    it('should handle rebased commits where committer date is newer than author date', () => {
      const mockCommits: PRCommit[] = [
        {
          sha: 'abc1234',
          author_date: '2026-08-12T12:00:00Z', // Old author date
          committer_date: '2026-08-13T11:00:00Z', // Rebased committer date (after comment)
          message: 'Feature commit',
        },
      ];

      const status = checkRebaseStatus(mockComment, mockCommits);
      assert.strictEqual(status.asksForRebase, true);
      assert.strictEqual(status.hasCommitsSince, true);
      assert.strictEqual(status.commitsSinceCount, 1);
    });
  });
});
