import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_RULES, loadConfig, loadRules, saveConfig, saveRules } from '../storage.ts';

describe('Rules and Storage Configuration', () => {
  it('DEFAULT_RULES includes standard code-review without agentOverride', () => {
    const codeReview = DEFAULT_RULES.find((r) => r.id === 'code-review');
    assert.ok(codeReview, 'code-review rule must exist in DEFAULT_RULES');
    assert.strictEqual(codeReview.buttonLabel, 'Review');
    assert.strictEqual(codeReview.buttonColor, 'emerald');
    assert.strictEqual(codeReview.agentOverride, undefined, 'code-review should not override agent so Codex/Claude are used');
    assert.ok(
      codeReview.promptTemplate.includes("Perform extensive and deep code review on this branch against branch {base_branch}"),
      'code-review should retain the senior engineer review template'
    );
    assert.ok(
      codeReview.promptTemplate.includes("## Review Areas"),
      'code-review should include Review Areas'
    );
    assert.ok(
      codeReview.promptTemplate.includes("1. **Security Issues**"),
      'code-review should include Security Issues section'
    );
  });

  it('DEFAULT_RULES includes opencode-review as a separate feature rule', () => {
    const ocrReview = DEFAULT_RULES.find((r) => r.id === 'opencode-review');
    assert.ok(ocrReview, 'opencode-review rule must exist in DEFAULT_RULES');
    assert.strictEqual(ocrReview.buttonLabel, 'OpenCode Review');
    assert.strictEqual(ocrReview.agentOverride, 'ocr');
    assert.strictEqual(ocrReview.buttonColor, 'indigo');
    assert.ok(
      ocrReview.promptTemplate.includes("PR #{pr_number}: {pr_title}"),
      'opencode-review should have its dedicated prompt template'
    );
    assert.ok(
      ocrReview.promptTemplate.includes("Review code changes against base branch '{base_branch}'"),
      'opencode-review template should mention base branch'
    );
  });

  it('DEFAULT_RULES includes Review Light (review-light) rule for critical merge blockers and requirements check', () => {
    const reviewLight = DEFAULT_RULES.find((r) => r.id === 'review-light');
    assert.ok(reviewLight, 'review-light rule must exist in DEFAULT_RULES');
    assert.strictEqual(reviewLight.name, 'Review Light');
    assert.strictEqual(reviewLight.buttonLabel, 'Review Light');
    assert.strictEqual(reviewLight.buttonColor, 'emerald');
    assert.strictEqual(reviewLight.actionType, 'spawn_agent');
    assert.strictEqual(reviewLight.agentOverride, undefined, 'review-light should not override agent so Codex/Claude are spawned');
    assert.strictEqual(reviewLight.conditions.prOwnedByNonCurrentUser, true);
    assert.strictEqual(reviewLight.conditions.notReviewedByOthers, true);
    assert.ok(
      reviewLight.promptTemplate.includes('lightweight code review'),
      'review-light prompt should mention lightweight code review'
    );
    assert.strictEqual(
      reviewLight.promptTemplate.includes('("Review Light")'),
      false,
      'review-light prompt should not contain ("Review Light")'
    );
    assert.strictEqual(
      reviewLight.promptTemplate.includes('PR Description & Requirements'),
      false,
      'review-light prompt should not contain PR Description & Requirements section'
    );
    assert.strictEqual(
      reviewLight.promptTemplate.includes('{pr_body}'),
      false,
      'review-light prompt should not contain {pr_body}'
    );
    assert.ok(
      reviewLight.promptTemplate.includes('Critical Merge Blockers') &&
      reviewLight.promptTemplate.includes('critical merge blockers'),
      'review-light prompt should focus on critical merge blockers'
    );
    assert.ok(
      reviewLight.promptTemplate.includes('requirements') &&
      reviewLight.promptTemplate.includes('addressed by the author'),
      'review-light prompt should verify requirements addressed by the author'
    );
    assert.ok(
      reviewLight.promptTemplate.includes('Recommend approval') ||
      reviewLight.promptTemplate.includes('recommend an approval') ||
      reviewLight.promptTemplate.includes('APPROVE'),
      'review-light prompt should recommend approval when no blockers exist and requirements are addressed'
    );
  });

  it('loadRules returns code-review, opencode-review, and review-light', async () => {
    const rules = await loadRules();
    const codeReview = rules.find((r) => r.id === 'code-review');
    const ocrReview = rules.find((r) => r.id === 'opencode-review');
    const reviewLight = rules.find((r) => r.id === 'review-light');
    const reviewWithContext = rules.find((r) => r.id === 'review-with-context');
    const reviewLatest = rules.find((r) => r.id === 'review-latest-comment');

    assert.ok(codeReview, 'code-review must exist in loaded rules');
    assert.strictEqual(codeReview.agentOverride, undefined, 'code-review in loaded rules should not have agentOverride: ocr');
    assert.ok(codeReview.promptTemplate.includes('Perform extensive and deep code review'));

    assert.ok(ocrReview, 'opencode-review must exist in loaded rules');
    assert.strictEqual(ocrReview.agentOverride, 'ocr');

    assert.ok(reviewLight, 'review-light must exist in loaded rules');
    assert.strictEqual(reviewLight.agentOverride, undefined, 'review-light in loaded rules should use default agent (codex/claude)');
    assert.strictEqual(reviewLight.buttonLabel, 'Review Light');
    assert.ok(reviewLight.promptTemplate.includes('critical merge blockers'));
    assert.ok(reviewLight.promptTemplate.includes('addressed by the author'));

    assert.ok(reviewWithContext, 'review-with-context must exist in loaded rules');
    assert.ok(reviewWithContext.promptTemplate.includes('is their pushback not justified?'));
    assert.ok(reviewWithContext.promptTemplate.includes("publish a \"changes requested\" comment type on the PR with your detailed feedback if you do find changes. Otherwise, published an approved review explaining why it's approved."));

    assert.ok(reviewLatest, 'review-latest-comment must exist in loaded rules');
    assert.ok(reviewLatest.promptTemplate.includes('Instead of re-evaluating the full PR comment history'));
  });

  it('DEFAULT_RULES and loadRules have updated buttonLabel and promptTemplate for rebase-non-user-pr', async () => {
    const defaultRule = DEFAULT_RULES.find((r) => r.id === 'rebase-non-user-pr');
    assert.ok(defaultRule, 'rebase-non-user-pr rule must exist in DEFAULT_RULES');
    assert.strictEqual(
      defaultRule.buttonLabel,
      'Author: Solve conflicts'
    );
    assert.strictEqual(
      defaultRule.promptTemplate,
      '@{author} Please solve merge conflicts against target branch.'
    );

    const defaultUserConflictRule = DEFAULT_RULES.find((r) => r.id === 'rebase-user-pr');
    assert.ok(defaultUserConflictRule, 'rebase-user-pr rule must exist in DEFAULT_RULES');
    assert.strictEqual(defaultUserConflictRule.name, 'Solve Conflicts');
    assert.strictEqual(defaultUserConflictRule.buttonLabel, 'Solve conflicts');
    assert.strictEqual(defaultUserConflictRule.conditions.prOwnedByCurrentUser, undefined);
    assert.strictEqual(defaultUserConflictRule.conditions.hasMergeConflicts, true);

    const rules = await loadRules();
    const loadedRule = rules.find((r) => r.id === 'rebase-non-user-pr');
    assert.ok(loadedRule, 'rebase-non-user-pr rule must exist in loaded rules');
    assert.strictEqual(
      loadedRule.buttonLabel,
      'Author: Solve conflicts'
    );
    assert.strictEqual(
      loadedRule.promptTemplate,
      '@{author} Please solve merge conflicts against target branch.'
    );

    const loadedUserConflictRule = rules.find((r) => r.id === 'rebase-user-pr');
    assert.ok(loadedUserConflictRule, 'rebase-user-pr rule must exist in loaded rules');
    assert.strictEqual(loadedUserConflictRule.name, 'Solve Conflicts');
    assert.strictEqual(loadedUserConflictRule.buttonLabel, 'Solve conflicts');
    assert.strictEqual(loadedUserConflictRule.conditions.prOwnedByCurrentUser, undefined);
    assert.strictEqual(loadedUserConflictRule.conditions.hasMergeConflicts, true);
  });

  it('loadRules migrates legacy "Perform Code Review" name and "Code Review" buttonLabel to "Review"', async () => {
    const originalRules = await loadRules();
    try {
      const modified = originalRules.map((r) => {
        if (r.id === 'code-review') {
          return { ...r, name: 'Perform Code Review', buttonLabel: 'Code Review', promptTemplate: 'Perform extensive and deep code review on this branch against branch {base_branch}.' };
        }
        if (r.id === 'rebase-user-pr') {
          return { ...r, name: 'Solve Conflicts Against Main', buttonLabel: 'Solve conflicts against main', conditions: { prOwnedByCurrentUser: true, hasMergeConflicts: true } };
        }
        if (r.id === 'rebase-non-user-pr') {
          return { ...r, buttonLabel: 'Ask author to solve merge conflicts against target branch' };
        }
        return r;
      });
      await saveRules(modified);

      const reloaded = await loadRules();
      const codeReview = reloaded.find((r) => r.id === 'code-review');
      assert.ok(codeReview);
      assert.strictEqual(codeReview.name, 'Review');
      assert.strictEqual(codeReview.buttonLabel, 'Review');
      assert.ok(codeReview.promptTemplate.includes('Publish Review Comment'));
      assert.ok(codeReview.promptTemplate.includes('Request changes if'));
      assert.ok(codeReview.promptTemplate.includes('Approve otherwise'));

      const userConflict = reloaded.find((r) => r.id === 'rebase-user-pr');
      assert.ok(userConflict);
      assert.strictEqual(userConflict.name, 'Solve Conflicts');
      assert.strictEqual(userConflict.buttonLabel, 'Solve conflicts');
      assert.strictEqual(userConflict.conditions.prOwnedByCurrentUser, undefined);

      const nonUserConflict = reloaded.find((r) => r.id === 'rebase-non-user-pr');
      assert.ok(nonUserConflict);
      assert.strictEqual(nonUserConflict.buttonLabel, 'Author: Solve conflicts');
    } finally {
      await saveRules(originalRules);
    }
  });

  it('loadConfig cleans legacy REPO_PATH_ keys and maps environment variables to repo names', async () => {
    const config = await loadConfig();
    assert.ok(config, 'Config must load');
    for (const key of Object.keys(config.repoPaths)) {
      assert.ok(
        !key.startsWith('REPO_PATH_'),
        `repoPaths key "${key}" must not start with REPO_PATH_`
      );
      assert.match(
        key,
        /^[\w.-]+\/[\w.-]+$/,
        `repoPaths key "${key}" must be an owner/repo format`
      );
    }
  });

  it('saveConfig preserves defaultAgent and cleans invalid repository keys from repoPaths', async () => {
    const original = await loadConfig();
    try {
      await saveConfig({
        ...original,
        defaultAgent: 'claude',
        repoPaths: {
          ...original.repoPaths,
          'REPO_PATH_DIRTY_KEY': '/some/dirty/path',
        },
      });

      const updated = await loadConfig();
      assert.strictEqual(updated.defaultAgent, 'claude');
      assert.strictEqual(updated.repoPaths['REPO_PATH_DIRTY_KEY'], undefined);

      await saveConfig({
        ...original,
        defaultAgent: 'agy',
      });
      const agyUpdated = await loadConfig();
      assert.strictEqual(agyUpdated.defaultAgent, 'agy');
    } finally {
      await saveConfig(original);
    }
  });

  it('loadConfig combines environment and stored monitored repos so all can coexist', async () => {
    const originalEnv = process.env.MONITORED_REPOS;
    const original = await loadConfig();
    try {
      process.env.MONITORED_REPOS = 'owner/website-repo,owner/shared-repo';
      await saveConfig({
        ...original,
        monitoredRepos: ['owner/android-repo', 'owner/shared-repo'],
      });

      const updated = await loadConfig();
      assert.ok(updated.monitoredRepos.includes('owner/android-repo'));
      assert.ok(updated.monitoredRepos.includes('owner/website-repo'));
      assert.ok(updated.monitoredRepos.includes('owner/shared-repo'));
      // Check deduplication
      const sharedCount = updated.monitoredRepos.filter((r) => r === 'owner/shared-repo').length;
      assert.strictEqual(sharedCount, 1);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MONITORED_REPOS = originalEnv;
      } else {
        delete process.env.MONITORED_REPOS;
      }
      await saveConfig(original);
    }
  });
});
