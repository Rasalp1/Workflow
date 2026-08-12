import React from 'react';
import { ActiveAgentInfo, AgentType } from '@/types';
import { GitPullRequest, RefreshCw, Sliders, Terminal, ShieldCheck, Cpu, Key, MessageSquare, X } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  defaultAgent: AgentType;
  onChangeAgent: (agent: AgentType) => void;
  currentUser: string | null;
  prCount: number;
  awaitingCommentCount: number;
  awaitingCommentItems: { repoName: string; prs: { number: number; title: string; cardId: string; branchName?: string }[] }[];
  theirsToHandleCount: number;
  activeAgentPRs?: Record<string, ActiveAgentInfo>;
  onClearActiveAgent?: (cardId: string) => void;
  onSelectPR: (cardId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isLoading,
  onOpenSettings,
  onOpenRules,
  defaultAgent,
  onChangeAgent,
  currentUser,
  prCount,
  awaitingCommentCount,
  awaitingCommentItems,
  theirsToHandleCount,
  activeAgentPRs = {},
  onClearActiveAgent,
  onSelectPR,
}) => {
  const activeAgentCount = Object.keys(activeAgentPRs).length;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 mb-6" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
      <div className="w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/60 shadow-sm text-white flex items-center justify-center">
            <GitPullRequest className="w-5 h-5 text-sky-400" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                <span>Workflow</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                  Agent Hub
                </span>
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                {prCount} Active PRs
              </span>
              {activeAgentCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-blue-800 font-semibold flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                  {activeAgentCount} Agent{activeAgentCount > 1 ? 's' : ''} Working
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
              <span>Logical Gates</span> • <span>Antigravity IDE CLI Spawns</span>
              {currentUser && (
                <span className="text-gray-700 font-medium flex items-center gap-1 ml-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> @{currentUser}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Controls Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Theirs to Handle Stat */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-400 tracking-tight leading-none">
                {theirsToHandleCount}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-600 leading-tight">
                  Theirs to Handle
                </span>
                <span className="text-[10px] text-gray-400 leading-tight">
                  Our comment is latest
                </span>
              </div>
            </div>
          </div>

          {/* PRs Awaiting Comment Stat with Hover Popover */}
          <div className="relative group">
            <div className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-amber-300 px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer">
              <div className="p-1 rounded-md bg-amber-50 border border-amber-200">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-amber-500 tracking-tight leading-none">
                  {awaitingCommentCount}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-800 leading-tight">
                    PRs Awaiting Our Comment
                  </span>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    Not by @{currentUser || 'Rasalp1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hover Popover Menu */}
            {awaitingCommentCount > 0 && (
              <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50 w-80 sm:w-96">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xl space-y-3" style={{ boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)' }}>
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                      PRs Awaiting Comment ({awaitingCommentCount})
                    </span>
                    <span className="text-[10px] text-gray-400">Click # to jump</span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
                    {awaitingCommentItems.map(({ repoName, prs }) => (
                      <div key={repoName} className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-blue-600 truncate border-b border-gray-100 pb-1 uppercase tracking-wider" title={repoName}>
                          {repoName.split('/')[1] || repoName}
                        </div>
                        {prs.length === 0 ? (
                          <div className="text-[11px] text-gray-400 italic py-1 px-1">None</div>
                        ) : (
                          <div className="space-y-1">
                            {prs.map((pr) => {
                              const isInProcess = Boolean(activeAgentPRs[pr.cardId]);
                              const agentInfo = activeAgentPRs[pr.cardId];
                              return (
                                <button
                                  key={pr.number}
                                  onClick={() => onSelectPR(pr.cardId)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between group/pr ${
                                    isInProcess
                                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                                      : 'bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-200 text-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-blue-600 font-bold">#{pr.number}</span>
                                    <span className="text-[10px] text-gray-600 group-hover/pr:text-gray-900 font-sans truncate max-w-[150px]" title={pr.branchName || pr.title}>
                                      {pr.branchName || pr.title}
                                    </span>
                                  </div>

                                  {isInProcess ? (
                                    <span className="text-[10px] text-blue-700 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-md font-sans font-semibold flex items-center gap-1.5 shrink-0">
                                      <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                                      <span>{agentInfo?.agent || 'agent'}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 group-hover/pr:text-blue-600 shrink-0">Jump →</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Agent CLI Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            <button
              onClick={() => onChangeAgent('codex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                defaultAgent === 'codex'
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>codex</span>
            </button>
            <button
              onClick={() => onChangeAgent('claude')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                defaultAgent === 'claude'
                  ? 'bg-white text-purple-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>claude code</span>
            </button>
          </div>

          {/* Rules Editor Toggle */}
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>Logic Gates</span>
          </button>

          {/* Credentials Modal Toggle */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 transition-all"
          >
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>Credentials</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh PRs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
