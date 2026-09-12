export type AgentType = 'codex' | 'claude';

export interface ActiveAgentInfo {
  agent: AgentType;
  timestamp: number;
  /** Branch the agent session was launched against, when known. */
  branch?: string;
  /** Which surface launched the session. */
  source?: 'web' | 'menubar';
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

export interface PRCommit {
  sha: string;
  author_date: string;
  committer_date: string;
  message: string;
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
  commits?: PRCommit[];
  last_comment?: PRComment;
  checks_status?: 'success' | 'failure' | 'pending' | 'unknown';
  has_merge_conflicts?: boolean;
  mergeable_state?: string;
  local_path?: string;
  needs_attention?: boolean;
}

export type HistoryBranch = 'main' | 'staging';
export type HistoryColumn = 'merged' | 'closed' | 'split';

export interface MergeHistoryEntry {
  id: number | string;
  number: number;
  title: string;
  user?: PRUser;
  merged_by?: PRUser | null;
  closed_by?: PRUser | null;
  repo_full_name: string;
  html_url: string;
  base_branch: string;
  merged_at?: string | null;
  closed_at?: string;
  state?: 'merged' | 'closed';
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
  actionType?: 'spawn_agent' | 'post_comment' | 'undraft_pr'; // Default is spawn_agent
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
    isDraft?: boolean;
    notReviewedByOthers?: boolean;
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
  needsAttention?: boolean;
}
