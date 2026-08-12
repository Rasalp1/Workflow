'use client';

import React, { useEffect, useState } from 'react';
import { AgentType, AppConfig, EvaluatedGateResult, LogicalGateRule, PRWithGates } from '@/types';
import { Header } from '@/components/Header';
import { PRCard } from '@/components/PRCard';
import { PRSidebar } from '@/components/PRSidebar';
import { PromptModal } from '@/components/PromptModal';
import { RulesEditorModal } from '@/components/RulesEditorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { GitPullRequest, Search, RefreshCw, Key, ShieldAlert, Columns, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const [prsWithGates, setPrsWithGates] = useState<PRWithGates[]>([]);
  const [monitoredRepos, setMonitoredRepos] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePRId, setActivePRId] = useState<string | null>(null);

  // Column Repositories State
  const [col1Repo, setCol1Repo] = useState<string>('');
  const [col2Repo, setCol2Repo] = useState<string>('');

  // Filters & Settings State
  const [searchQuery, setSearchQuery] = useState<string>('');
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
  const fetchPRs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prs');
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

        if (fetchedPRs.length > 0 && !activePRId) {
          const firstId = `pr-card-${fetchedPRs[0].pr.repo_full_name}-${fetchedPRs[0].pr.number}`;
          setActivePRId(firstId);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pull requests.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch App Config & Rules
  const fetchConfigAndRules = async () => {
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
  };

  useEffect(() => {
    fetchConfigAndRules();
    fetchPRs();
  }, []);

  // IntersectionObserver to sync sidebar active state on scroll
  useEffect(() => {
    if (prsWithGates.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActivePRId(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    prsWithGates.forEach(({ pr }) => {
      const el = document.getElementById(`pr-card-${pr.repo_full_name}-${pr.number}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [prsWithGates, col1Repo, col2Repo]);

  const handleSelectPR = (cardId: string) => {
    setActivePRId(cardId);
    // Find PR's repo
    const foundPR = prsWithGates.find(
      ({ pr }) => `pr-card-${pr.repo_full_name}-${pr.number}` === cardId
    );
    if (foundPR) {
      const repoName = foundPR.pr.repo_full_name;
      // If repo is not visible in either column, switch column 2 to show it
      if (col1Repo !== repoName && col2Repo !== repoName) {
        setCol2Repo(repoName);
      }
    }

    setTimeout(() => {
      const element = document.getElementById(cardId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleConfirmSpawn = async (payload: {
    repoFullName: string;
    localPath: string;
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

  // Filtered PR list by search query & excluding bot accounts
  const searchFilteredPRs = prsWithGates.filter(({ pr }) => {
    const isBot =
      pr.user?.login === 'github-actions[bot]' ||
      pr.user?.login?.toLowerCase().includes('github-actions');
    if (isBot) return false;

    return (
      searchQuery === '' ||
      pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.user.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.head.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.repo_full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Sort PRs:
  // 1. Top: PRs where user (Rasalp1) does NOT have the latest comment/description
  // 2. Bottom: PRs where user (Rasalp1) HAS the latest comment/description
  // 3. Secondary sort: PR number descending
  const sortedPRs = [...searchFilteredPRs].sort((a, b) => {
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

  // Filter PRs for Column 1 & Column 2
  const col1PRs = sortedPRs.filter(
    ({ pr }) => col1Repo === 'ALL' || pr.repo_full_name === col1Repo
  );
  const col2PRs = sortedPRs.filter(
    ({ pr }) => col2Repo === 'ALL' || pr.repo_full_name === col2Repo
  );

  // Count & List PRs where target user (currentUser or Rasalp1) does NOT have the latest comment or description
  const targetUser = (currentUser || 'Rasalp1').toLowerCase();
  const prsWithoutOurLatestComment = searchFilteredPRs.filter(({ pr }) => {
    const lastUser = (pr.last_comment?.user?.login || pr.user.login).toLowerCase();
    return lastUser !== targetUser;
  });

  // Group PRs by repository for 2-column hover popover
  const availableRepos = Array.from(
    new Set([
      ...monitoredRepos,
      ...prsWithGates.map(({ pr }) => pr.repo_full_name),
    ])
  );

  const reposMap: Record<string, typeof searchFilteredPRs> = {};
  availableRepos.forEach((repo) => {
    reposMap[repo] = [];
  });

  prsWithoutOurLatestComment.forEach((item) => {
    const repoKey = item.pr.repo_full_name;
    if (!reposMap[repoKey]) {
      reposMap[repoKey] = [];
    }
    reposMap[repoKey].push(item);
  });

  const repoKeys = Object.keys(reposMap);
  const col1ReposList = repoKeys.filter((_, idx) => idx % 2 === 0);
  const col2ReposList = repoKeys.filter((_, idx) => idx % 2 === 1);

  return (
    <div className="h-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden w-full">
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
      />

      {/* Main Container - Fills Remaining Screen Height */}
      <main className="flex-1 flex flex-col w-full px-6 overflow-hidden pb-5">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 glass-panel p-4 rounded-2xl border border-slate-800 shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PR title, author, branch across all repos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
          </div>

          {/* Large Stat Counter with 2-Column Hover Popover */}
          <div className="relative group">
            <div className="flex items-center gap-3.5 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-amber-950/20 border border-slate-800 hover:border-amber-500/40 px-4 py-2.5 rounded-xl shadow-lg shadow-black/20 transition-all cursor-pointer">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent tracking-tight">
                  {prsWithoutOurLatestComment.length}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 leading-tight">
                    PRs Awaiting Our Comment
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Latest activity is not by @{currentUser || 'Rasalp1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hover Box Popover */}
            <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50 w-80 sm:w-96">
              <div className="glass-panel bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    PRs Awaiting Comment ({prsWithoutOurLatestComment.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Click # to jump</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Column 1 Header & Repo PRs */}
                  <div className="space-y-3">
                    {col1ReposList.map((repoName) => {
                      const items = reposMap[repoName] || [];
                      const displayTitle = repoName.split('/')[1] || repoName;
                      return (
                        <div key={repoName} className="space-y-1.5">
                          <div
                            className="text-[11px] font-extrabold text-indigo-400 truncate border-b border-indigo-500/20 pb-1 uppercase tracking-wider"
                            title={repoName}
                          >
                            {displayTitle}
                          </div>
                          {items.length === 0 ? (
                            <div className="text-[11px] text-slate-500 italic py-1 px-1">None</div>
                          ) : (
                            <div className="space-y-1">
                              {items.map(({ pr }) => {
                                const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
                                return (
                                  <button
                                    key={pr.number}
                                    onClick={() => handleSelectPR(cardId)}
                                    className="w-full text-left px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/80 hover:border-indigo-500/50 text-slate-200 text-xs font-mono font-bold transition-all flex items-center justify-between group/pr"
                                  >
                                    <span className="text-indigo-300">#{pr.number}</span>
                                    <span
                                      className="text-[10px] text-slate-400 group-hover/pr:text-slate-200 font-sans font-normal truncate max-w-[100px]"
                                      title={pr.title}
                                    >
                                      {pr.title}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Column 2 Header & Repo PRs */}
                  <div className="space-y-3">
                    {col2ReposList.map((repoName) => {
                      const items = reposMap[repoName] || [];
                      const displayTitle = repoName.split('/')[1] || repoName;
                      return (
                        <div key={repoName} className="space-y-1.5">
                          <div
                            className="text-[11px] font-extrabold text-purple-400 truncate border-b border-purple-500/20 pb-1 uppercase tracking-wider"
                            title={repoName}
                          >
                            {displayTitle}
                          </div>
                          {items.length === 0 ? (
                            <div className="text-[11px] text-slate-500 italic py-1 px-1">None</div>
                          ) : (
                            <div className="space-y-1">
                              {items.map(({ pr }) => {
                                const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
                                return (
                                  <button
                                    key={pr.number}
                                    onClick={() => handleSelectPR(cardId)}
                                    className="w-full text-left px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-purple-600/30 border border-slate-700/80 hover:border-purple-500/50 text-slate-200 text-xs font-mono font-bold transition-all flex items-center justify-between group/pr"
                                  >
                                    <span className="text-purple-300">#{pr.number}</span>
                                    <span
                                      className="text-[10px] text-slate-400 group-hover/pr:text-slate-200 font-sans font-normal truncate max-w-[100px]"
                                      title={pr.title}
                                    >
                                      {pr.title}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-300">GitHub API Notice</h4>
              <p className="text-xs text-rose-200/90">{error}</p>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/40 transition-colors"
              >
                <Key className="w-3.5 h-3.5" /> Configure GitHub Access Token
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {isLoading && prsWithGates.length === 0 ? (
          <div className="py-24 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">
              Fetching private repositories, PRs, and comments...
            </p>
          </div>
        ) : searchFilteredPRs.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center glass-card rounded-2xl p-12 border border-slate-800 space-y-3 my-auto">
            <GitPullRequest className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No Open Pull Requests Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              There are currently no open PRs matching your filter across monitored repositories.
            </p>
            <button
              onClick={fetchPRs}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Stream
            </button>
          </div>
        ) : (
          /* Sidebar + 2-Column Independent Scrolling Layout */
          <div className="flex-1 flex flex-col lg:flex-row items-start gap-6 w-full min-h-0 overflow-hidden">
            {/* PR Sidebar navigation */}
            <PRSidebar
              prsWithGates={sortedPRs}
              activePRId={activePRId}
              onSelectPR={handleSelectPR}
            />

            {/* Two Independent Scrolling Columns */}
            <div className="flex-1 w-full min-w-0 h-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start overflow-hidden">
              {/* COLUMN 1 */}
              <div className="flex flex-col h-full min-h-0 w-full glass-panel rounded-2xl border border-slate-800/80 p-4 shadow-md overflow-hidden">
                {/* Column 1 Repository Selector Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0 mb-4">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Column 1
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Repo:</span>
                    <select
                      value={col1Repo}
                      onChange={(e) => setCol1Repo(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                  {col1PRs.length === 0 ? (
                    <div className="p-8 text-center glass-card rounded-2xl border border-slate-800 text-xs text-slate-400 italic">
                      No open PRs found for <strong className="text-slate-300">{col1Repo}</strong>.
                    </div>
                  ) : (
                    col1PRs.map((item) => {
                      const cardId = `pr-card-${item.pr.repo_full_name}-${item.pr.number}`;
                      return (
                        <PRCard
                          key={cardId}
                          prWithGates={item}
                          isSelected={activePRId === cardId}
                          onTriggerGate={(prWithGates, gateResult) =>
                            setActiveGateTrigger({ prWithGates, gateResult })
                          }
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* COLUMN 2 */}
              <div className="flex flex-col h-full min-h-0 w-full glass-panel rounded-2xl border border-slate-800/80 p-4 shadow-md overflow-hidden">
                {/* Column 2 Repository Selector Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0 mb-4">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Column 2
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Repo:</span>
                    <select
                      value={col2Repo}
                      onChange={(e) => setCol2Repo(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-500 cursor-pointer"
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
                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                  {col2PRs.length === 0 ? (
                    <div className="p-8 text-center glass-card rounded-2xl border border-slate-800 text-xs text-slate-400 italic">
                      No open PRs found for <strong className="text-slate-300">{col2Repo}</strong>.
                    </div>
                  ) : (
                    col2PRs.map((item) => {
                      const cardId = `pr-card-${item.pr.repo_full_name}-${item.pr.number}`;
                      return (
                        <PRCard
                          key={cardId}
                          prWithGates={item}
                          isSelected={activePRId === cardId}
                          onTriggerGate={(prWithGates, gateResult) =>
                            setActiveGateTrigger({ prWithGates, gateResult })
                          }
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
