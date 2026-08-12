import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { AgentType, AppConfig, LogicalGateRule } from '@/types';

const DATA_DIR = path.join(process.cwd(), '.workflow-data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

export const DEFAULT_RULES: LogicalGateRule[] = [
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
    promptTemplate: `Address review issues and requested changes for PR #{pr_number} ({pr_title}).
Repository: {repo_name}
Target Branch: {branch}

Recent discussion and review feedback:
{comments_summary}

Task:
1. Inspect the codebase for the files referenced in the comments.
2. Make the required edits and code adjustments on disk to address all reviewer feedback.
3. Test your changes locally to ensure clean execution.`,
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
    promptTemplate: `Perform a thorough code review for PR #{pr_number} ({pr_title}) in repository {repo_name}.
Review the latest changes on branch '{branch}' compared to base '{base_branch}'.

Instructions:
1. Examine git status, modified files, and diffs on branch {branch}.
2. Check for logic issues, edge cases, performance, or styling defects.
3. Fix any identified bugs or address review comments directly on disk.`,
  },
  {
    id: 'review-with-context',
    name: 'Review With Context',
    description: 'PR owned by someone else with prior context from us and new comments.',
    enabled: true,
    buttonLabel: 'Review with context',
    buttonIcon: 'Eye',
    buttonColor: 'emerald',
    actionType: 'spawn_agent',
    conditions: {
      prOwnedByNonCurrentUser: true,
      hasCommentsByCurrentUser: true,
      lastCommentNotCurrentUser: true,
    },
    promptTemplate: `Perform a code review for PR #{pr_number} ({pr_title}) in repository {repo_name} taking into account our prior context and discussion.
Review the latest changes on branch '{branch}' compared to base '{base_branch}'.

Discussion summary and prior context:
{comments_summary}

Latest comment from @{last_comment_author}:
"{last_comment_body}"

Instructions:
1. Review the new comments and changes in context of our previous feedback.
2. Inspect the codebase for changes on branch {branch}.
3. Address open questions or fix identified issues directly on disk.`,
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
    promptTemplate: `Rebase branch '{branch}' for PR #{pr_number} ({pr_title}) in repository {repo_name} onto base branch '{base_branch}'.
Fetch origin, run git rebase origin/{base_branch}, resolve any merge conflicts, and verify clean test execution.`,
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
    promptTemplate: `@pr_author Please rebase this pull request onto current base branch ({base_branch}) to resolve merge conflicts.`,
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

  if (process.env.REPO_PATH_OSRA_1_MEDSAM_PRODUCTION) {
    envPaths['OSRA-1/MEDSAM-production'] = process.env.REPO_PATH_OSRA_1_MEDSAM_PRODUCTION;
  }
  if (process.env.REPO_PATH_RASALP1_MEDSAMAPP) {
    envPaths['Rasalp1/MedSAMapp'] = process.env.REPO_PATH_RASALP1_MEDSAMAPP;
  }

  const defaultConfig: AppConfig = {
    githubToken: process.env.GITHUB_TOKEN || '',
    defaultAgent: (process.env.DEFAULT_AGENT as AgentType) || 'codex',
    monitoredRepos: envRepos.length > 0 ? envRepos : ['OSRA-1/MEDSAM-production', 'Rasalp1/MedSAMapp'],
    repoPaths: envPaths,
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
        return rules;
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

