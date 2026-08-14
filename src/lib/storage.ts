import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { AgentType, AppConfig, LogicalGateRule } from '@/types';

const DATA_DIR = path.join(process.cwd(), '.workflow-data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

export const DEFAULT_RULES: LogicalGateRule[] = [
  {
    id: 'convert-draft-to-ready',
    name: 'Convert Draft to Open PR',
    description: 'Converts a draft PR into a real open PR ready for review.',
    enabled: true,
    buttonLabel: 'Convert PR',
    buttonIcon: 'GitPullRequest',
    buttonColor: 'blue',
    actionType: 'undraft_pr',
    conditions: {
      isDraft: true,
    },
    promptTemplate: 'Convert PR #{pr_number} ({pr_title}) from draft to open ready-for-review PR.',
  },
  {
    id: 'address-issues',
    name: 'Address Review Issues',
    description: 'PR owned by user with latest comment from someone else.',
    enabled: true,
    buttonLabel: 'Address Issues',
    buttonIcon: 'Wrench',
    buttonColor: 'purple',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByCurrentUser: true,
      lastCommentNotCurrentUser: true,
    },
    promptTemplate: `Address review issues for PR #{pr_number} \n\nLook at the complete comment history on the pr that exists on this branch. Read it all, and then adress the reviewers recentmost feedback with the whole context of the PR in mind. Check the issues the reviewer has raised against the code. Fix the issues if they're real- but don’t trust the reviewer  blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to adress the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a very detailed comment to the pr explaining what you did and why. `,
  },
  {
    id: 'code-review',
    name: 'Perform Code Review',
    description: 'PR owned by someone else with no comments yet.',
    enabled: true,
    buttonLabel: 'Code Review',
    buttonIcon: 'Eye',
    buttonColor: 'emerald',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByNonCurrentUser: true,
      hasNoComments: true,
    },
    promptTemplate: `Perform extensive and deep code review on this branch against branch {base_branch}. Consider all aspects. 
 ## Role

You're a senior software engineer conducting a thorough code review. Provide constructive, actionable feedback.

## Review Areas

Analyze the selected code for:

1. **Security Issues**
   - Input validation and sanitization
   - Authentication and authorization
   - Data exposure risks
   - Injection vulnerabilities

2. **Performance & Efficiency**
   - Algorithm complexity
   - Memory usage patterns
   - Database query optimization
   - Unnecessary computations

3. **Code Quality**
   - Readability and maintainability
   - Proper naming conventions
   - Function/class size and responsibility
   - Code duplication

4. **Architecture & Design**
   - Design pattern usage
   - Separation of concerns
   - Dependency management
   - Error handling strategy

5. **Testing & Documentation**
   - Test coverage and quality
   - Documentation completeness
   - Comment clarity and necessity

## Output Format

Provide feedback as:

**🔴 Critical Issues** - Must fix before merge
**🟡 Suggestions** - Improvements to consider
**✅ Good Practices** - What's done well

For each issue:
- Specific line references
- Clear explanation of the problem
- Suggested solution with code example
- Rationale for the change`,
  },
  {
    id: 'review-with-context',
    name: 'Review With Context',
    description: 'PR owned by someone else with new comments.',
    enabled: true,
    buttonLabel: 'Review with context',
    buttonIcon: 'Eye',
    buttonColor: 'emerald',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByNonCurrentUser: true,
      lastCommentNotCurrentUser: true,
      notReviewedByOthers: true,
    },
    promptTemplate: `Look at the complete comment history on the pr that exists on this branch, PR #{pr_number}. We’re the reviewer. Has the author adressed all the issues we identified? Are there any new issues that have been created? Is the author pushing back on anything we’ve said in a previous review? Why? Do they do so rightfully, or are they just disobedient? Do a complete code review of this PR. Think long and hard to verify that the claimed fixes are in place, and try to find any new issues that have arisen, and try to find unrelated issues on this PR that were missed before! When you’ve completed your code review, publish a "changes requested" comment type on the PR with your detailed feedback.`,
  },
  {
    id: 'rebase-user-pr',
    name: 'Rebase User PR Branch',
    description: 'PR owned by user that has merge conflicts.',
    enabled: true,
    buttonLabel: 'Rebase',
    buttonIcon: 'GitBranch',
    buttonColor: 'amber',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByCurrentUser: true,
      hasMergeConflicts: true,
    },
    promptTemplate: `Rebase branch '{branch}' for PR #{pr_number} ({pr_title}) in repository {repo_name} onto main. \n\nFetch origin, run git rebase origin/{base_branch}, resolve any merge conflicts, and verify clean test execution. Don't look at only git-identified conflicts, but also at structural intention. Take a step back and assess the codebase as a whole. Does anything break with the merge? Are any intentions, from either side, lost?\n\nOnce you’re done, force push the changes to the branch and post a simple comment with just "Rebased".`,
  },
  {
    id: 'rebase-non-user-pr',
    name: 'Request Author Rebase Comment',
    description: 'PR owned by non-user that has merge conflicts.',
    enabled: true,
    buttonLabel: 'Rebase',
    buttonIcon: 'GitBranch',
    buttonColor: 'amber',
    actionType: 'post_comment',
    conditions: {
      prOwnedByNonCurrentUser: true,
      hasMergeConflicts: true,
    },
    promptTemplate: `@pr_author Please rebase this pull request onto main to resolve merge conflicts.`,
  },
];

async function ensureDataDirExists() {
  if (!existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await ensureDataDirExists();
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function loadConfig(): Promise<AppConfig> {
  await ensureDataDirExists();

  const envRepos = (process.env.MONITORED_REPOS || '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const envPaths: Record<string, string> = {};
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('REPO_PATH_')) {
      envPaths[key] = process.env[key] || '';
    }
  });

  const defaultConfig: AppConfig = {
    githubToken: process.env.GITHUB_TOKEN || '',
    defaultAgent: (process.env.DEFAULT_AGENT as AgentType) || 'codex',
    monitoredRepos: envRepos,
    repoPaths: envPaths,
    directAgentSpawn: false,
  };

  if (existsSync(CONFIG_FILE)) {
    try {
      const fileContent = await fs.readFile(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(fileContent);
      return {
        ...defaultConfig,
        ...data,
        repoPaths: { ...defaultConfig.repoPaths, ...(data.repoPaths || {}) },
      };
    } catch (e) {
      console.error('Failed to parse config file:', e);
    }
  }

  return defaultConfig;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await atomicWriteJson(CONFIG_FILE, config);
}

export async function loadRules(): Promise<LogicalGateRule[]> {
  await ensureDataDirExists();
  if (existsSync(RULES_FILE)) {
    try {
      const fileContent = await fs.readFile(RULES_FILE, 'utf-8');
      const rules = JSON.parse(fileContent);
      if (Array.isArray(rules) && rules.length > 0) {
        // Migration: ensure all DEFAULT_RULES exist in rules
        const existingIds = new Set(rules.map((r: LogicalGateRule) => r.id));
        const missingDefaultRules = DEFAULT_RULES.filter((dr) => !existingIds.has(dr.id));
        const mergedRules = [...missingDefaultRules, ...rules];

        // Migration: ensure review-with-context has notReviewedByOthers and remove legacy conditions
        const cleanedRules = mergedRules.map((r: LogicalGateRule) => {
          if (r.id === 'review-with-context' && r.conditions) {
            const { hasCommentsByCurrentUser, ...restConditions } = r.conditions;
            return { ...r, conditions: { notReviewedByOthers: true, ...restConditions } };
          }
          return r;
        });

        if (missingDefaultRules.length > 0) {
          await saveRules(cleanedRules);
        }

        return cleanedRules;
      }
    } catch (e) {
      console.error('Failed to parse rules file:', e);
    }
  }
  return DEFAULT_RULES;
}

export async function saveRules(rules: LogicalGateRule[]): Promise<void> {
  await atomicWriteJson(RULES_FILE, rules);
}

