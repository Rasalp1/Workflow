import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isBotUser,
  isBotComment,
  filterNonBotComments,
  getEffectiveLastComment,
} from '../botDetection.ts';
import type { PRComment } from '../../types/index.ts';

describe('Bot Detection', () => {
  describe('isBotUser', () => {
    it('identifies GitHub App bot accounts ending with [bot]', () => {
      assert.strictEqual(isBotUser({ login: 'github-actions[bot]' }), true);
      assert.strictEqual(isBotUser({ login: 'release-please[bot]' }), true);
      assert.strictEqual(isBotUser({ login: 'netlify[bot]' }), true);
      assert.strictEqual(isBotUser({ login: 'dependabot[bot]' }), true);
      assert.strictEqual(isBotUser({ login: 'codecov[bot]' }), true);
      assert.strictEqual(isBotUser({ login: 'vercel[bot]' }), true);
    });

    it('identifies users with type === "Bot"', () => {
      assert.strictEqual(isBotUser({ login: 'custom-app', type: 'Bot' }), true);
      assert.strictEqual(isBotUser({ login: 'some-tool', type: 'bot' }), true);
    });

    it('identifies known bot logins regardless of [bot] suffix', () => {
      assert.strictEqual(isBotUser({ login: 'github-actions' }), true);
      assert.strictEqual(isBotUser({ login: 'release-please' }), true);
      assert.strictEqual(isBotUser({ login: 'netlify' }), true);
      assert.strictEqual(isBotUser({ login: 'dependabot' }), true);
    });

    it('identifies usernames with bot suffixes and prefixes', () => {
      assert.strictEqual(isBotUser({ login: 'snyk-bot' }), true);
      assert.strictEqual(isBotUser({ login: 'ci_bot' }), true);
      assert.strictEqual(isBotUser({ login: 'bot-runner' }), true);
      assert.strictEqual(isBotUser({ login: 'bot' }), true);
    });

    it('does not flag normal human users', () => {
      assert.strictEqual(isBotUser({ login: 'rasmusalpsten' }), false);
      assert.strictEqual(isBotUser({ login: 'alice', type: 'User' }), false);
      assert.strictEqual(isBotUser({ login: 'bob' }), false);
      assert.strictEqual(isBotUser(null), false);
      assert.strictEqual(isBotUser(undefined), false);
    });
  });

  describe('isBotComment', () => {
    it('flags comments from bot users', () => {
      const comment: PRComment = {
        id: 1,
        user: { login: 'netlify[bot]', avatar_url: '', html_url: '' },
        body: 'Deploy preview ready!',
        created_at: '2026-09-28T10:00:00Z',
        updated_at: '2026-09-28T10:00:00Z',
        html_url: '',
        is_review_comment: false,
      };
      assert.strictEqual(isBotComment(comment), true);
    });

    it('flags comments performed via github app', () => {
      const comment: PRComment = {
        id: 2,
        user: { login: 'netlify-service', avatar_url: '', html_url: '' },
        body: 'Build finished',
        created_at: '2026-09-28T10:00:00Z',
        updated_at: '2026-09-28T10:00:00Z',
        html_url: '',
        is_review_comment: false,
        performed_via_github_app: { slug: 'netlify' },
      };
      assert.strictEqual(isBotComment(comment), true);
    });

    it('flags comments with Netlify deploy preview signatures', () => {
      const comment: PRComment = {
        id: 3,
        user: { login: 'app-service', avatar_url: '', html_url: '' },
        body: '### Deploy Preview for *my-site* ready!\n\nBuilt with commit 1234. Powered by Netlify',
        created_at: '2026-09-28T10:00:00Z',
        updated_at: '2026-09-28T10:00:00Z',
        html_url: '',
        is_review_comment: false,
      };
      assert.strictEqual(isBotComment(comment), true);
    });

    it('flags comments with release-please metadata markers', () => {
      const comment: PRComment = {
        id: 4,
        user: { login: 'automation', avatar_url: '', html_url: '' },
        body: '<!-- release-please-start -->Pending release notes<!-- release-please-end -->',
        created_at: '2026-09-28T10:00:00Z',
        updated_at: '2026-09-28T10:00:00Z',
        html_url: '',
        is_review_comment: false,
      };
      assert.strictEqual(isBotComment(comment), true);
    });

    it('does not flag human comments that casually mention netlify or deploy', () => {
      const comment: PRComment = {
        id: 5,
        user: { login: 'alice', avatar_url: '', html_url: '', type: 'User' },
        body: 'Hey, I checked the netlify preview and everything looks great!',
        created_at: '2026-09-28T10:00:00Z',
        updated_at: '2026-09-28T10:00:00Z',
        html_url: '',
        is_review_comment: false,
      };
      assert.strictEqual(isBotComment(comment), false);
    });
  });

  describe('filterNonBotComments and getEffectiveLastComment', () => {
    const humanComment1: PRComment = {
      id: 10,
      user: { login: 'alice', avatar_url: '', html_url: '' },
      body: 'Can you fix the type error?',
      created_at: '2026-09-28T09:00:00Z',
      updated_at: '2026-09-28T09:00:00Z',
      html_url: '',
      is_review_comment: false,
    };
    const botComment1: PRComment = {
      id: 11,
      user: { login: 'netlify[bot]', avatar_url: '', html_url: '' },
      body: 'Deploy preview ready!',
      created_at: '2026-09-28T09:05:00Z',
      updated_at: '2026-09-28T09:05:00Z',
      html_url: '',
      is_review_comment: false,
    };
    const humanComment2: PRComment = {
      id: 12,
      user: { login: 'bob', avatar_url: '', html_url: '' },
      body: 'Fixed in latest push',
      created_at: '2026-09-28T09:10:00Z',
      updated_at: '2026-09-28T09:10:00Z',
      html_url: '',
      is_review_comment: false,
    };
    const botComment2: PRComment = {
      id: 13,
      user: { login: 'github-actions[bot]', avatar_url: '', html_url: '' },
      body: 'All checks passed',
      created_at: '2026-09-28T09:15:00Z',
      updated_at: '2026-09-28T09:15:00Z',
      html_url: '',
      is_review_comment: false,
    };

    it('filterNonBotComments removes all bot comments', () => {
      const filtered = filterNonBotComments([humanComment1, botComment1, humanComment2, botComment2]);
      assert.strictEqual(filtered.length, 2);
      assert.strictEqual(filtered[0]?.id, 10);
      assert.strictEqual(filtered[1]?.id, 12);
    });

    it('getEffectiveLastComment finds the last human comment when last comment was from a bot', () => {
      const comments = [humanComment1, botComment1, humanComment2, botComment2];
      const effective = getEffectiveLastComment(comments, botComment2);
      assert.strictEqual(effective?.id, humanComment2.id);
      assert.strictEqual(effective?.user.login, 'bob');
    });

    it('getEffectiveLastComment returns undefined if only bot comments exist', () => {
      const comments = [botComment1, botComment2];
      const effective = getEffectiveLastComment(comments, botComment2);
      assert.strictEqual(effective, undefined);
    });

    it('getEffectiveLastComment returns the explicit last comment if it is human', () => {
      const comments = [humanComment1, botComment1, humanComment2];
      const effective = getEffectiveLastComment(comments, humanComment2);
      assert.strictEqual(effective?.id, humanComment2.id);
      assert.strictEqual(effective?.user.login, 'bob');
    });
  });
});
