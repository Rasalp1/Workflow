import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_RULES, loadConfig, loadRules, saveConfig } from '../storage.ts';

describe('Rules and Storage Configuration', () => {
  it('DEFAULT_RULES includes standard code-review without agentOverride', () => {
    const codeReview = DEFAULT_RULES.find((r) => r.id === 'code-review');
    assert.ok(codeReview, 'code-review rule must exist in DEFAULT_RULES');
    assert.strictEqual(codeReview.buttonLabel, 'Code Review');
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

  it('loadRules returns both code-review and opencode-review', async () => {
    const rules = await loadRules();
    const codeReview = rules.find((r) => r.id === 'code-review');
    const ocrReview = rules.find((r) => r.id === 'opencode-review');

    assert.ok(codeReview, 'code-review must exist in loaded rules');
    assert.strictEqual(codeReview.agentOverride, undefined, 'code-review in loaded rules should not have agentOverride: ocr');
    assert.ok(codeReview.promptTemplate.includes('Perform extensive and deep code review'));

    assert.ok(ocrReview, 'opencode-review must exist in loaded rules');
    assert.strictEqual(ocrReview.agentOverride, 'ocr');
  });

  it('DEFAULT_RULES and loadRules have updated buttonLabel and promptTemplate for rebase-non-user-pr', async () => {
    const defaultRule = DEFAULT_RULES.find((r) => r.id === 'rebase-non-user-pr');
    assert.ok(defaultRule, 'rebase-non-user-pr rule must exist in DEFAULT_RULES');
    assert.strictEqual(
      defaultRule.buttonLabel,
      'Ask author to solve merge conflicts against target branch'
    );
    assert.strictEqual(
      defaultRule.promptTemplate,
      '@{author} Please solve merge conflicts against target branch.'
    );

    const rules = await loadRules();
    const loadedRule = rules.find((r) => r.id === 'rebase-non-user-pr');
    assert.ok(loadedRule, 'rebase-non-user-pr rule must exist in loaded rules');
    assert.strictEqual(
      loadedRule.buttonLabel,
      'Ask author to solve merge conflicts against target branch'
    );
    assert.strictEqual(
      loadedRule.promptTemplate,
      '@{author} Please solve merge conflicts against target branch.'
    );
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
    } finally {
      await saveConfig(original);
    }
  });
});
