export type AgentType = 'codex' | 'claude';

export interface ActiveAgentInfo {
  agent: AgentType;
  timestamp: number;
}

export interface PRUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface PRComment {
  id: number;
  user: PRUser;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  path?: string; // Present on review comments
  position?: number;
  line?: number;
  is_review_comment: boolean;
  review_state?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  is_draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  user: PRUser;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
  comments_count: number;
  review_comments_count: number;
  comments: PRComment[];
  last_comment?: PRComment;
  checks_status?: 'success' | 'failure' | 'pending' | 'unknown';
  has_merge_conflicts?: boolean;
  mergeable_state?: string;
  local_path?: string;
}

export interface LogicalGateRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  buttonLabel: string;
  buttonIcon?: string;
  buttonColor?: 'blue' | 'purple' | 'amber' | 'emerald' | 'rose' | 'indigo';
  agentOverride?: AgentType;
  actionType?: 'spawn_agent' | 'post_comment'; // Default is spawn_agent
  conditions: {
    prOwnedByCurrentUser?: boolean;
    prOwnedByNonCurrentUser?: boolean;
    hasNoComments?: boolean;
    hasCommentsByCurrentUser?: boolean;
    lastCommentNotCurrentUser?: boolean;
    hasMergeConflicts?: boolean;
    lastCommentAuthorLogin?: string; // Specific user login if set
    hasUnresolvedComments?: boolean;
    checksFailing?: boolean;
    titleOrBodyKeyword?: string;
  };
  promptTemplate: string; // Dynamic template string or comment text
}

export interface AppConfig {
  githubToken: string;
  defaultAgent: AgentType;
  monitoredRepos: string[]; // e.g. ["owner/repo1", "owner/repo2"]
  repoPaths: Record<string, string>; // "owner/repo" -> "/Users/..."
  directAgentSpawn?: boolean; // If true, bypass prompt modal and spawn immediately
  maskedToken?: string;
  hasToken?: boolean;
}

export interface EvaluatedGateResult {
  rule: LogicalGateRule;
  passed: boolean;
  generatedPrompt: string;
  targetAgent: AgentType;
}

export interface PRWithGates {
  pr: PullRequest;
  evaluatedGates: EvaluatedGateResult[];
}
