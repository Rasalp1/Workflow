'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AgentType, AppConfig, EvaluatedGateResult, LogicalGateRule, PRWithGates } from '@/types';
import { Header } from '@/components/Header';
import { PRCard } from '@/components/PRCard';
import { PRSidebar } from '@/components/PRSidebar';
import { PromptModal } from '@/components/PromptModal';
import { RulesEditorModal } from '@/components/RulesEditorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { GitPullRequest, RefreshCw, Key, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const [prsWithGates, setPrsWithGates] = useState<PRWithGates[]>([]);
  const [monitoredRepos, setMonitoredRepos] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dual Active Column PR States & Refs
  const [activeCol1PRId, setActiveCol1PRId] = useState<string | null>(null);
  const [activeCol2PRId, setActiveCol2PRId] = useState<string | null>(null);
  const col1ScrollRef = useRef<HTMLDivElement>(null);
  const col2ScrollRef = useRef<HTMLDivElement>(null);

  // Column Repositories State
  const [col1Repo, setCol1Repo] = useState<string>('');
  const [col2Repo, setCol2Repo] = useState<string>('');

  // Settings State
  const [defaultAgent, setDefaultAgent] = useState<AgentType>('codex');

  // Modals
  const [activeGateTrigger, setActiveGateTrigger] = useState<{
    prWithGates: PRWithGates;
    gateResult: EvaluatedGateResult;
  } | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rules, setRules] = useState<LogicalGateRule[]>([]);

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

        // Auto-assign default repos to columns if not set
        if (repos.length > 0) {
          setCol1Repo((prev) => (prev && repos.includes(prev) ? prev : repos[0]));
          setCol2Repo((prev) => (prev && repos.includes(prev) ? prev : repos[1] || repos[0]));
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
        setDefaultAgent(configData.config.defaultAgent || 'codex');
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

  // Filtered PR list — excluding bot accounts
  const searchFilteredPRs = prsWithGates.filter(({ pr }) => {
    const isBot =
      pr.user?.login === 'github-actions[bot]' ||
      pr.user?.login?.toLowerCase().includes('github-actions');
    return !isBot;
  });

  // Sort PRs:
  // 1. Top: PRs where user (Rasalp1) does NOT have the latest comment/description
  // 2. Bottom: PRs where user (Rasalp1) HAS the latest comment/description
  // 3. Secondary sort: PR number descending
  const sortedPRs = React.useMemo(() => {
    return [...searchFilteredPRs].sort((a, b) => {
      const targetUser = (currentUser || 'Rasalp1').toLowerCase();
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
      ({ pr }) => col1Repo === 'ALL' || pr.repo_full_name === col1Repo
    );
  }, [sortedPRs, col1Repo]);

  const col2PRs = React.useMemo(() => {
    return sortedPRs.filter(
      ({ pr }) => col2Repo === 'ALL' || pr.repo_full_name === col2Repo
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

  const handleSelectPR = (cardId: string) => {
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
      setActiveCol2PRId(cardId);
    }

    setTimeout(() => {
      if (inCol1 || (!inCol1 && !inCol2)) {
        const targetId = `col1-${cardId}`;
        const actionBar = document.getElementById(`${targetId}-action-bar`);
        if (actionBar) {
          actionBar.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          const el = document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
      if (inCol2) {
        const targetId = `col2-${cardId}`;
        const actionBar = document.getElementById(`${targetId}-action-bar`);
        if (actionBar) {
          actionBar.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          const el = document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }, 100);
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

  const handleChangeDefaultAgent = async (agent: AgentType) => {
    setDefaultAgent(agent);
    if (config) {
      const updated = { ...config, defaultAgent: agent };
      setConfig(updated);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    }
  };

  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleConfirmSpawn = async (payload: {
    repoFullName: string;
    localPath: string;
    branchName?: string;
    agent: AgentType;
    prompt: string;
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
  };

  const handleTriggerGate = async (prWithGates: PRWithGates, gateResult: EvaluatedGateResult) => {
    if (config?.directAgentSpawn) {
      if (gateResult.rule.actionType === 'post_comment') {
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

  // Count & List PRs where target user (currentUser or Rasalp1) does NOT have the latest comment or description
  const targetUser = (currentUser || 'Rasalp1').toLowerCase();
  const prsWithoutOurLatestComment = searchFilteredPRs.filter(({ pr }) => {
    const lastUser = (pr.last_comment?.user?.login || pr.user.login).toLowerCase();
    return lastUser !== targetUser;
  });

  // Build awaiting-comment items for Header popover
  const awaitingReposMap: Record<string, { number: number; title: string; branchName: string; cardId: string }[]> = {};
  prsWithoutOurLatestComment.forEach(({ pr }) => {
    const key = pr.repo_full_name;
    if (!awaitingReposMap[key]) awaitingReposMap[key] = [];
    awaitingReposMap[key].push({
      number: pr.number,
      title: pr.title,
      branchName: pr.head.ref,
      cardId: `pr-card-${pr.repo_full_name}-${pr.number}`,
    });
  });
  const awaitingCommentItems = Object.entries(awaitingReposMap).map(([repoName, prs]) => ({ repoName, prs }));

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden w-full">
      {/* Header Bar */}
      <Header
        onRefresh={fetchPRs}
        isLoading={isLoading}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenRules={() => setIsRulesModalOpen(true)}
        defaultAgent={defaultAgent}
        onChangeAgent={handleChangeDefaultAgent}
        currentUser={currentUser}
        prCount={searchFilteredPRs.length}
        awaitingCommentCount={prsWithoutOurLatestComment.length}
        theirsToHandleCount={searchFilteredPRs.length - prsWithoutOurLatestComment.length}
        awaitingCommentItems={awaitingCommentItems}
        onSelectPR={handleSelectPR}
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
            <h3 className="text-base font-semibold text-gray-700">No Open Pull Requests Found</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              There are currently no open PRs matching your filter across monitored repositories.
            </p>
            <button
              onClick={fetchPRs}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border border-gray-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        ) : (
          /* Sidebar + 2-Column Independent Scrolling Layout */
          <div className="flex-1 flex flex-col lg:flex-row items-start gap-6 w-full min-h-0 overflow-hidden">
            {/* PR Sidebar navigation */}
            <PRSidebar
              prsWithGates={sortedPRs}
              activeCol1PRId={effectiveActiveCol1PRId}
              activeCol2PRId={effectiveActiveCol2PRId}
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
                      onChange={(e) => setCol1Repo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      <option value="ALL">All Repositories</option>
                      {monitoredRepos.map((repo) => (
                        <option key={repo} value={repo}>
                          {repo}
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
                      return (
                        <PRCard
                          key={`col1-${cardId}`}
                          customId={`col1-${cardId}`}
                          prWithGates={item}
                          isSelected={effectiveActiveCol1PRId === cardId}
                          columnTheme="blue"
                          onTriggerGate={handleTriggerGate}
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
                      onChange={(e) => setCol2Repo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-purple-700 focus:outline-none focus:border-purple-400 cursor-pointer"
                    >
                      <option value="ALL">All Repositories</option>
                      {monitoredRepos.map((repo) => (
                        <option key={repo} value={repo}>
                          {repo}
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
                      return (
                        <PRCard
                          key={`col2-${cardId}`}
                          customId={`col2-${cardId}`}
                          prWithGates={item}
                          isSelected={effectiveActiveCol2PRId === cardId}
                          columnTheme="purple"
                          onTriggerGate={handleTriggerGate}
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
          onClose={() => setActiveGateTrigger(null)}
          prWithGates={activeGateTrigger.prWithGates}
          gateResult={activeGateTrigger.gateResult}
          onConfirmSpawn={handleConfirmSpawn}
        />
      )}

      {/* Rules Editor Modal */}
      <RulesEditorModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        rules={rules}
        onSaveRules={handleSaveRules}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
