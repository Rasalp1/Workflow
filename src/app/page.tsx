'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ActiveAgentInfo, AgentType, AppConfig, EvaluatedGateResult, LogicalGateRule, PRWithGates } from '@/types';
import { isPrAwaitingComment } from '@/lib/logicGates';
import { Header } from '@/components/Header';
import { PRCard } from '@/components/PRCard';
import { PRSidebar } from '@/components/PRSidebar';
import { PromptModal } from '@/components/PromptModal';
import { RulesEditorModal } from '@/components/RulesEditorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { CloseWorktreesConfirmModal } from '@/components/CloseWorktreesConfirmModal';
import { GitPullRequest, RefreshCw, Key, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const [prsWithGates, setPrsWithGates] = useState<PRWithGates[]>([]);
  const [monitoredRepos, setMonitoredRepos] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active In-Process Agents State
  const [activeAgentPRs, setActiveAgentPRs] = useState<Record<string, ActiveAgentInfo>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('workflow_active_agent_prs');
      if (saved) {
        setActiveAgentPRs(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load active agent state from localStorage:', e);
    }
  }, []);

  // Dual Active Column PR States & Refs
  const [activeCol1PRId, setActiveCol1PRId] = useState<string | null>(null);
  const [activeCol2PRId, setActiveCol2PRId] = useState<string | null>(null);
  const col1ScrollRef = useRef<HTMLDivElement>(null);
  const col2ScrollRef = useRef<HTMLDivElement>(null);

  // Column Repositories State
  const [col1Repo, setCol1Repo] = useState<string>('');
  const [col2Repo, setCol2Repo] = useState<string>('');

  // Modals
  const [activeGateTrigger, setActiveGateTrigger] = useState<{
    prWithGates: PRWithGates;
    gateResult: EvaluatedGateResult;
  } | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCloseWorktreesModalOpen, setIsCloseWorktreesModalOpen] = useState(false);
  const [isClosingWorktrees, setIsClosingWorktrees] = useState(false);
  const [closeWorktreesError, setCloseWorktreesError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rules, setRules] = useState<LogicalGateRule[]>([]);

  const handleClearActiveAgent = (cardId: string) => {
    const cardKey = cardId.replace(/^(col1-|col2-)/, '');
    setActiveAgentPRs((prev) => {
      const updated = { ...prev };
      delete updated[cardKey];
      try {
        localStorage.setItem('workflow_active_agent_prs', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update localStorage:', e);
      }
      return updated;
    });
  };

  const handleStartActiveAgent = (cardId: string, agent: AgentType = 'codex') => {
    const cardKey = cardId.replace(/^(col1-|col2-)/, '');
    setActiveAgentPRs((prev) => {
      const updated = {
        ...prev,
        [cardKey]: {
          agent,
          timestamp: Date.now(),
        },
      };
      try {
        localStorage.setItem('workflow_active_agent_prs', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update localStorage:', e);
      }
      return updated;
    });
  };

  const handleClearAllActiveAgents = () => {
    setActiveAgentPRs({});
    try {
      localStorage.removeItem('workflow_active_agent_prs');
    } catch (e) {
      console.error('Failed to clear active agent sessions from localStorage:', e);
    }
  };

  // Fetch PRs and Gates
  const fetchPRs = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prs?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setPrsWithGates([]);
      } else {
        const fetchedPRs = data.prsWithGates || [];
        const repos = data.monitoredRepos || [];
        setPrsWithGates(fetchedPRs);
        setMonitoredRepos(repos);
        setCurrentUser(data.currentUser || null);

        // Auto-assign default repos to columns if not set and ensure distinct selection
        if (repos.length > 0) {
          const defaultCol1 = repos[0];
          const defaultCol2 = repos.length > 1 ? repos[1] : repos[0];
          setCol1Repo((prev) => (prev && repos.includes(prev) ? prev : defaultCol1));
          setCol2Repo((prev) => {
            const c1 = col1Repo || defaultCol1;
            if (prev && repos.includes(prev) && prev !== c1) return prev;
            return defaultCol2 !== c1 ? defaultCol2 : defaultCol1;
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load pull requests.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch App Config & Rules
  const fetchConfigAndRules = React.useCallback(async () => {
    try {
      const [configRes, rulesRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/rules'),
      ]);
      const configData = await configRes.json();
      const rulesData = await rulesRes.json();

      if (configData.config) {
        setConfig(configData.config);
      }
      if (rulesData.rules) {
        setRules(rulesData.rules);
      }
    } catch (err) {
      console.error('Failed to load config/rules:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await fetchConfigAndRules();
      if (isMounted) {
        await fetchPRs();
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchConfigAndRules, fetchPRs]);

  // Filtered PR list — excluding bot accounts & matching searchQuery
  const searchFilteredPRs = React.useMemo(() => {
    return prsWithGates.filter(({ pr }) => {
      const isBot =
        pr.user?.login === 'github-actions[bot]' ||
        pr.user?.login?.toLowerCase().includes('github-actions');
      if (isBot) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const titleMatches = pr.title.toLowerCase().includes(q);
      const numberMatches = `#${pr.number}`.includes(q) || pr.number.toString().includes(q);
      const authorMatches = pr.user?.login?.toLowerCase().includes(q);
      const branchMatches = pr.head?.ref?.toLowerCase().includes(q);
      const repoMatches = pr.repo_full_name?.toLowerCase().includes(q) || pr.repo_name?.toLowerCase().includes(q);

      return titleMatches || numberMatches || authorMatches || branchMatches || repoMatches;
    });
  }, [prsWithGates, searchQuery]);

  // Sort PRs:
  // 1. Top: PRs where current user does NOT have the latest comment/description
  // 2. Bottom: PRs where current user HAS the latest comment/description
  // 3. Secondary sort: PR number descending
  const sortedPRs = React.useMemo(() => {
    return [...searchFilteredPRs].sort((a, b) => {
      const targetUser = (currentUser || '').toLowerCase();
      if (!targetUser) return b.pr.number - a.pr.number;

      const aLastUser = (a.pr.last_comment?.user?.login || a.pr.user.login).toLowerCase();
      const bLastUser = (b.pr.last_comment?.user?.login || b.pr.user.login).toLowerCase();

      const aIsUserLast = aLastUser === targetUser;
      const bIsUserLast = bLastUser === targetUser;

      if (aIsUserLast !== bIsUserLast) {
        return aIsUserLast ? 1 : -1;
      }

      return b.pr.number - a.pr.number;
    });
  }, [searchFilteredPRs, currentUser]);

  // Filter PRs for Column 1 & Column 2
  const col1PRs = React.useMemo(() => {
    return sortedPRs.filter(
      ({ pr }) => pr.repo_full_name === col1Repo
    );
  }, [sortedPRs, col1Repo]);

  const col2PRs = React.useMemo(() => {
    return sortedPRs.filter(
      ({ pr }) => pr.repo_full_name === col2Repo
    );
  }, [sortedPRs, col2Repo]);

  // Compute effective active PR IDs for Column 1 & Column 2
  const effectiveActiveCol1PRId = React.useMemo(() => {
    if (col1PRs.length === 0) return null;
    const exists = col1PRs.some(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === activeCol1PRId
    );
    if (activeCol1PRId && exists) return activeCol1PRId;
    return `pr-card-${col1PRs[0].pr.repo_full_name}-${col1PRs[0].pr.number}`;
  }, [col1PRs, activeCol1PRId]);

  const effectiveActiveCol2PRId = React.useMemo(() => {
    if (col2PRs.length === 0) return null;
    const exists = col2PRs.some(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === activeCol2PRId
    );
    if (activeCol2PRId && exists) return activeCol2PRId;
    return `pr-card-${col2PRs[0].pr.repo_full_name}-${col2PRs[0].pr.number}`;
  }, [col2PRs, activeCol2PRId]);


  // IntersectionObserver to sync Column 1 active state on scroll
  useEffect(() => {
    const container = col1ScrollRef.current;
    if (!container || col1PRs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const prId = entry.target.getAttribute('data-pr-id');
            if (prId) setActiveCol1PRId(prId);
          }
        });
      },
      { root: container, threshold: 0.3 }
    );

    col1PRs.forEach(({ pr }) => {
      const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
      const el = document.getElementById(`col1-${cardId}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [col1PRs]);

  // IntersectionObserver to sync Column 2 active state on scroll
  useEffect(() => {
    const container = col2ScrollRef.current;
    if (!container || col2PRs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const prId = entry.target.getAttribute('data-pr-id');
            if (prId) setActiveCol2PRId(prId);
          }
        });
      },
      { root: container, threshold: 0.3 }
    );

    col2PRs.forEach(({ pr }) => {
      const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
      const el = document.getElementById(`col2-${cardId}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [col2PRs]);

  const handleSelectPR = (cardId: string, position: 'top' | 'bottom' = 'bottom') => {
    const foundPR = prsWithGates.find(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === cardId
    );
    if (!foundPR) return;

    const repoName = foundPR.pr.repo_full_name;
    const inCol1 = col1PRs.some(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === cardId
    );
    const inCol2 = col2PRs.some(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === cardId
    );

    if (inCol1) {
      setActiveCol1PRId(cardId);
    }
    if (inCol2) {
      setActiveCol2PRId(cardId);
    }

    if (!inCol1 && !inCol2) {
      setCol2Repo(repoName);
      if (col1Repo === repoName) {
        const alt = monitoredRepos.find((r) => r !== repoName) || monitoredRepos[0] || repoName;
        setCol1Repo(col2Repo && col2Repo !== repoName ? col2Repo : alt);
      }
      setActiveCol2PRId(cardId);
    }

    setTimeout(() => {
      const scrollTarget = (targetId: string) => {
        if (position === 'top') {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
          }
        } else {
          const actionBar = document.getElementById(`${targetId}-action-bar`);
          if (actionBar) {
            actionBar.scrollIntoView({ behavior: 'smooth', block: 'end' });
            return true;
          } else {
            const el = document.getElementById(targetId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'end' });
              return true;
            }
          }
        }
        return false;
      };

      if (inCol1) {
        scrollTarget(`col1-${cardId}`);
      }
      if (inCol2) {
        scrollTarget(`col2-${cardId}`);
      }
      if (!inCol1 && !inCol2) {
        if (!scrollTarget(`col2-${cardId}`)) {
          scrollTarget(`col1-${cardId}`);
        }
      }
    }, 100);
  };

  const handleCol1RepoChange = (newRepo: string) => {
    setCol1Repo(newRepo);
    if (newRepo === col2Repo) {
      const alt = monitoredRepos.find((r) => r !== newRepo) || monitoredRepos[0] || newRepo;
      setCol2Repo(col1Repo && col1Repo !== newRepo ? col1Repo : alt);
    }
  };

  const handleCol2RepoChange = (newRepo: string) => {
    setCol2Repo(newRepo);
    if (newRepo === col1Repo) {
      const alt = monitoredRepos.find((r) => r !== newRepo) || monitoredRepos[0] || newRepo;
      setCol1Repo(col2Repo && col2Repo !== newRepo ? col2Repo : alt);
    }
  };

  const handleSaveRules = async (updatedRules: LogicalGateRule[]) => {
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: updatedRules }),
    });
    setRules(updatedRules);
    fetchPRs();
  };

  const handleSaveConfig = async (updatedConfig: Partial<AppConfig>) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfig),
    });
    fetchConfigAndRules();
    fetchPRs();
  };

  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleConfirmSpawn = async (payload: {
    repoFullName: string;
    localPath: string;
    branchName?: string;
    agent: AgentType;
    prompt: string;
    cardId?: string;
  }) => {
    const res = await fetch('/api/agent/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to spawn agent in terminal');
    }

    let targetCardId = payload.cardId;
    if (!targetCardId && payload.repoFullName && payload.branchName) {
      const found = prsWithGates.find(
        (item) => item.pr.repo_full_name === payload.repoFullName && item.pr.head.ref === payload.branchName
      );
      if (found) {
        targetCardId = `pr-card-${found.pr.repo_full_name}-${found.pr.number}`;
      }
    }

    if (targetCardId) {
      const cardKey = targetCardId.replace(/^(col1-|col2-)/, '');
      setActiveAgentPRs((prev) => {
        const updated = {
          ...prev,
          [cardKey]: {
            agent: payload.agent,
            timestamp: Date.now(),
          },
        };
        try {
          localStorage.setItem('workflow_active_agent_prs', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }
  };

  const handleTriggerGate = async (prWithGates: PRWithGates, gateResult: EvaluatedGateResult) => {
    if (config?.directAgentSpawn) {
      if (gateResult.rule.actionType === 'undraft_pr') {
        try {
          setActionBanner({ type: 'info', message: `Marking PR #${prWithGates.pr.number} as ready for review...` });
          const res = await fetch('/api/prs/undraft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repoFullName: prWithGates.pr.repo_full_name,
              prNumber: prWithGates.pr.number,
            }),
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Failed to mark PR as ready for review');
          }
          setActionBanner({ type: 'success', message: `PR #${prWithGates.pr.number} marked as ready for review!` });
          fetchPRs();
          setTimeout(() => setActionBanner(null), 5000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Action failed';
          setActionBanner({ type: 'error', message: msg });
        }
      } else if (gateResult.rule.actionType === 'post_comment') {
        try {
          setActionBanner({ type: 'info', message: `Posting GitHub comment on PR #${prWithGates.pr.number}...` });
          const res = await fetch('/api/prs/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repoFullName: prWithGates.pr.repo_full_name,
              prNumber: prWithGates.pr.number,
              commentBody: gateResult.generatedPrompt,
            }),
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Failed to post comment');
          }
          setActionBanner({ type: 'success', message: `Comment posted on GitHub PR #${prWithGates.pr.number}!` });
          setTimeout(() => setActionBanner(null), 5000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Action failed';
          setActionBanner({ type: 'error', message: msg });
        }
      } else {
        try {
          setActionBanner({ type: 'info', message: `Launching ${gateResult.targetAgent} agent in Antigravity IDE...` });
          await handleConfirmSpawn({
            repoFullName: prWithGates.pr.repo_full_name,
            localPath: prWithGates.pr.local_path || '',
            branchName: prWithGates.pr.head.ref,
            agent: gateResult.targetAgent,
            prompt: gateResult.generatedPrompt,
            cardId: `pr-card-${prWithGates.pr.repo_full_name}-${prWithGates.pr.number}`,
          });
          setActionBanner({
            type: 'success',
            message: `Launched ${gateResult.targetAgent} agent in Antigravity IDE terminal for branch "${prWithGates.pr.head.ref}"!`,
          });
          setTimeout(() => setActionBanner(null), 6000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Action failed';
          setActionBanner({ type: 'error', message: msg });
        }
      }
    } else {
      setActiveGateTrigger({ prWithGates, gateResult });
    }
  };

  const handleMergePR = async (prWithGates: PRWithGates) => {
    try {
      setActionBanner({ type: 'info', message: `Merging PR #${prWithGates.pr.number} into ${prWithGates.pr.base.ref}...` });
      const res = await fetch('/api/prs/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: prWithGates.pr.repo_full_name,
          prNumber: prWithGates.pr.number,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to merge PR');
      }
      setActionBanner({
        type: 'success',
        message: `Successfully merged PR #${prWithGates.pr.number} into ${prWithGates.pr.base.ref}!`,
      });
      setTimeout(() => setActionBanner(null), 5000);
      fetchPRs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to merge PR';
      setActionBanner({ type: 'error', message: msg });
      throw err;
    }
  };

  const handleOpenWorktree = async (prWithGates: PRWithGates) => {
    try {
      setActionBanner({ type: 'info', message: `Opening Git worktree for branch "${prWithGates.pr.head.ref}" in Antigravity IDE...` });
      const res = await fetch('/api/worktree/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: prWithGates.pr.repo_full_name,
          localPath: prWithGates.pr.local_path || '',
          branchName: prWithGates.pr.head.ref,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to spawn worktree');
      }
      setActionBanner({ type: 'success', message: data.message || `Worktree opened for branch "${prWithGates.pr.head.ref}"!` });
      setTimeout(() => setActionBanner(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to spawn worktree';
      setActionBanner({ type: 'error', message: msg });
      throw err;
    }
  };

  const handleConfirmCloseAllWorktrees = async () => {
    setIsClosingWorktrees(true);
    setCloseWorktreesError(null);
    try {
      const res = await fetch('/api/terminal/close-worktrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to close worktrees');
      }
      setIsCloseWorktreesModalOpen(false);
      setActionBanner({
        type: 'success',
        message: 'Opened Antigravity IDE terminal and executed commands to close all worktrees!',
      });
      setTimeout(() => setActionBanner(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to close worktrees in terminal';
      setCloseWorktreesError(msg);
    } finally {
      setIsClosingWorktrees(false);
    }
  };

  // Count & List PRs awaiting our comment or action (including user-owned PRs with merge conflicts)
  const targetUser = currentUser || null;
  const prsAwaitingOurComment = searchFilteredPRs.filter(({ pr }) =>
    isPrAwaitingComment(pr, targetUser)
  );

  // Build awaiting-comment & theirs-to-handle items for Header popover
  const theirsToHandlePRs = searchFilteredPRs.filter(({ pr }) =>
    !isPrAwaitingComment(pr, targetUser)
  );

  const awaitingReposMap: Record<string, { number: number; title: string; branchName: string; cardId: string; hasMergeConflicts: boolean }[]> = {};
  prsAwaitingOurComment.forEach(({ pr }) => {
    const key = pr.repo_full_name;
    if (!awaitingReposMap[key]) awaitingReposMap[key] = [];
    awaitingReposMap[key].push({
      number: pr.number,
      title: pr.title,
      branchName: pr.head.ref,
      cardId: `pr-card-${pr.repo_full_name}-${pr.number}`,
      hasMergeConflicts: Boolean(pr.has_merge_conflicts),
    });
  });
  const awaitingCommentItems = Object.entries(awaitingReposMap).map(([repoName, prs]) => ({ repoName, prs }));

  const theirsReposMap: Record<string, { number: number; title: string; branchName: string; cardId: string; hasMergeConflicts: boolean }[]> = {};
  theirsToHandlePRs.forEach(({ pr }) => {
    const key = pr.repo_full_name;
    if (!theirsReposMap[key]) theirsReposMap[key] = [];
    theirsReposMap[key].push({
      number: pr.number,
      title: pr.title,
      branchName: pr.head.ref,
      cardId: `pr-card-${pr.repo_full_name}-${pr.number}`,
      hasMergeConflicts: Boolean(pr.has_merge_conflicts),
    });
  });
  const theirsToHandleItems = Object.entries(theirsReposMap).map(([repoName, prs]) => ({ repoName, prs }));

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden w-full">
      {/* Header Bar */}
      <Header
        onRefresh={fetchPRs}
        isLoading={isLoading}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onOpenCloseWorktreesModal={() => setIsCloseWorktreesModalOpen(true)}
        currentUser={currentUser}
        prCount={searchFilteredPRs.length}
        awaitingCommentCount={prsAwaitingOurComment.length}
        theirsToHandleCount={searchFilteredPRs.length - prsAwaitingOurComment.length}
        awaitingCommentItems={awaitingCommentItems}
        theirsToHandleItems={theirsToHandleItems}
        activeAgentPRs={activeAgentPRs}
        onClearActiveAgent={handleClearActiveAgent}
        onClearAllActiveAgents={handleClearAllActiveAgents}
        onSelectPR={handleSelectPR}
        col1Repo={col1Repo}
        col2Repo={col2Repo}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Container - Fills Remaining Screen Height */}
      <main className="flex-1 flex flex-col w-full px-6 overflow-hidden pb-5">

        {/* Global Action Feedback Banner */}
        {actionBanner && (
          <div
            className={`p-3.5 mb-4 rounded-xl border text-xs flex items-center justify-between gap-3 shrink-0 shadow-sm ${
              actionBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : actionBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {actionBanner.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
              {actionBanner.type === 'success' && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
              {actionBanner.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />}
              <span>{actionBanner.message}</span>
            </div>
            <button
              onClick={() => setActionBanner(null)}
              className="text-[11px] text-gray-400 hover:text-gray-700 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 mb-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-rose-800">GitHub API Notice</h4>
              <p className="text-xs text-rose-600">{error}</p>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
              >
                <Key className="w-3.5 h-3.5" /> Configure GitHub Access Token
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {isLoading && prsWithGates.length === 0 ? (
          <div className="py-24 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
            <RefreshCw className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
            <p className="text-xs text-gray-400 font-medium">
              Fetching private repositories, PRs, and comments...
            </p>
          </div>
        ) : searchFilteredPRs.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center panel rounded-xl p-12 space-y-3 my-auto">
            <GitPullRequest className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-semibold text-gray-700">
              {searchQuery ? 'No Matching Pull Requests' : 'No Open Pull Requests Found'}
            </h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {searchQuery
                ? `No PRs matching "${searchQuery}" across monitored repositories.`
                : 'There are currently no open PRs matching your filter across monitored repositories.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={fetchPRs}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border border-gray-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            )}
          </div>
        ) : (
          /* Sidebar + 2-Column Independent Scrolling Layout */
          <div className="flex-1 flex flex-col lg:flex-row items-start gap-6 w-full min-h-0 overflow-hidden">
            {/* PR Sidebar navigation */}
            <PRSidebar
              prsWithGates={sortedPRs}
              activeCol1PRId={effectiveActiveCol1PRId}
              activeCol2PRId={effectiveActiveCol2PRId}
              activeAgentPRs={activeAgentPRs}
              onSelectPR={handleSelectPR}
            />

            {/* Two Independent Scrolling Columns */}
            <div className="flex-1 w-full min-w-0 h-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start overflow-hidden">
              {/* COLUMN 1 */}
              <div className="flex flex-col h-full min-h-0 w-full panel rounded-xl p-4 overflow-hidden">
                {/* Column 1 Repository Selector Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 shrink-0 mb-3">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Column 1
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">Repo:</span>
                    <select
                      value={col1Repo}
                      onChange={(e) => handleCol1RepoChange(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {monitoredRepos.map((repo) => (
                        <option key={repo} value={repo} disabled={repo === col2Repo}>
                          {repo} {repo === col2Repo ? '(Selected in Col 2)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column 1 Scrollable Content */}
                <div ref={col1ScrollRef} className="flex-1 overflow-y-auto pr-1 space-y-6">
                  {col1PRs.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-400 italic">
                      No open PRs found for <strong className="text-gray-600">{col1Repo}</strong>.
                    </div>
                  ) : (
                    col1PRs.map((item) => {
                      const cardId = `pr-card-${item.pr.repo_full_name}-${item.pr.number}`;
                      const isInProcess = Boolean(activeAgentPRs[cardId]);
                      return (
                        <PRCard
                          key={`col1-${cardId}`}
                          customId={`col1-${cardId}`}
                          prWithGates={item}
                          isSelected={effectiveActiveCol1PRId === cardId}
                          columnTheme="blue"
                          isInProcess={isInProcess}
                          activeAgentInfo={activeAgentPRs[cardId]}
                          onClearActiveAgent={handleClearActiveAgent}
                          onTriggerGate={handleTriggerGate}
                          onMergePR={handleMergePR}
                          onOpenWorktree={handleOpenWorktree}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* COLUMN 2 */}
              <div className="flex flex-col h-full min-h-0 w-full panel rounded-xl p-4 overflow-hidden">
                {/* Column 2 Repository Selector Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 shrink-0 mb-3">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Column 2
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">Repo:</span>
                    <select
                      value={col2Repo}
                      onChange={(e) => handleCol2RepoChange(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-purple-700 focus:outline-none focus:border-purple-400 cursor-pointer"
                    >
                      {monitoredRepos.map((repo) => (
                        <option key={repo} value={repo} disabled={repo === col1Repo}>
                          {repo} {repo === col1Repo ? '(Selected in Col 1)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column 2 Scrollable Content */}
                <div ref={col2ScrollRef} className="flex-1 overflow-y-auto pr-1 space-y-6">
                  {col2PRs.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-400 italic">
                      No open PRs found for <strong className="text-gray-600">{col2Repo}</strong>.
                    </div>
                  ) : (
                    col2PRs.map((item) => {
                      const cardId = `pr-card-${item.pr.repo_full_name}-${item.pr.number}`;
                      const isInProcess = Boolean(activeAgentPRs[cardId]);
                      return (
                        <PRCard
                          key={`col2-${cardId}`}
                          customId={`col2-${cardId}`}
                          prWithGates={item}
                          isSelected={effectiveActiveCol2PRId === cardId}
                          columnTheme="purple"
                          isInProcess={isInProcess}
                          activeAgentInfo={activeAgentPRs[cardId]}
                          onClearActiveAgent={handleClearActiveAgent}
                          onTriggerGate={handleTriggerGate}
                          onMergePR={handleMergePR}
                          onOpenWorktree={handleOpenWorktree}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Prompt Trigger Modal */}
      {activeGateTrigger && (
        <PromptModal
          isOpen={!!activeGateTrigger}
          onClose={() => {
            setActiveGateTrigger(null);
            fetchPRs();
          }}
          prWithGates={activeGateTrigger.prWithGates}
          gateResult={activeGateTrigger.gateResult}
          onConfirmSpawn={handleConfirmSpawn}
          onStartActiveAgent={handleStartActiveAgent}
        />
      )}

      {/* Rules Editor Modal */}
      <RulesEditorModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        rules={rules}
        onSaveRules={handleSaveRules}
        currentUser={currentUser}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      {/* Close All Worktrees Confirm Modal */}
      <CloseWorktreesConfirmModal
        isOpen={isCloseWorktreesModalOpen}
        onClose={() => {
          if (!isClosingWorktrees) {
            setIsCloseWorktreesModalOpen(false);
            setCloseWorktreesError(null);
          }
        }}
        onConfirm={handleConfirmCloseAllWorktrees}
        isClosing={isClosingWorktrees}
        error={closeWorktreesError}
      />
    </div>
  );
}
