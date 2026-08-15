import React, { useState } from 'react';
import { ActiveAgentInfo, AgentType } from '@/types';
import { GitPullRequest, RefreshCw, Sliders, ShieldCheck, Key, MessageSquare, X, FolderX, Search } from 'lucide-react';
import { ClearAgentsModal } from '@/components/ClearAgentsModal';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCloseWorktreesModal?: () => void;
  defaultAgent?: AgentType;
  onChangeAgent?: (agent: AgentType) => void;
  currentUser: string | null;
  prCount: number;
  awaitingCommentCount: number;
  awaitingCommentItems: { repoName: string; prs: { number: number; title: string; cardId: string; branchName?: string; hasMergeConflicts?: boolean }[] }[];
  theirsToHandleCount: number;
  theirsToHandleItems?: { repoName: string; prs: { number: number; title: string; cardId: string; branchName?: string; hasMergeConflicts?: boolean }[] }[];
  activeAgentPRs?: Record<string, ActiveAgentInfo>;
  onClearActiveAgent?: (cardId: string) => void;
  onClearAllActiveAgents?: () => void;
  onSelectPR: (cardId: string, position?: 'top' | 'bottom') => void;
  col1Repo?: string;
  col2Repo?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isLoading,
  onOpenSettings,
  onOpenRules,
  onOpenCloseWorktreesModal,
  currentUser,
  prCount,
  awaitingCommentCount,
  awaitingCommentItems,
  theirsToHandleCount,
  theirsToHandleItems = [],
  activeAgentPRs = {},
  onClearAllActiveAgents,
  onSelectPR,
  col1Repo,
  col2Repo,
  searchQuery = '',
  onSearchChange,
}) => {
  const activeAgentCount = Object.keys(activeAgentPRs).length;
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const getRepoTheme = (repoName: string, index: number): 'blue' | 'purple' => {
    if (col2Repo && repoName === col2Repo) return 'purple';
    if (col1Repo && repoName === col1Repo) return 'blue';
    return index % 2 === 1 ? 'purple' : 'blue';
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 mb-6" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
      <div className="w-full mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Title (Left) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative p-2 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/60 shadow-sm text-white flex items-center justify-center">
            <GitPullRequest className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-1.5 leading-none">
                <span>Workflow</span>
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium inline-flex items-center leading-none">
                {prCount} Active PRs
              </span>
              {activeAgentCount > 0 && (
                <span className="text-xs pl-2 pr-1 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-blue-800 font-semibold inline-flex items-center gap-1.5 leading-none">
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin shrink-0" />
                  <span>{activeAgentCount} Agent{activeAgentCount > 1 ? 's' : ''} Working</span>
                  {onClearAllActiveAgents && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsClearModalOpen(true);
                      }}
                      className="p-0.5 hover:bg-blue-200 text-blue-700 hover:text-blue-950 rounded-full transition-colors leading-none cursor-pointer flex items-center justify-center ml-0.5"
                      title="Clear all agent sessions"
                      aria-label="Clear all agent sessions"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )}
            </div>
            {currentUser && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                <span className="text-gray-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> @{currentUser}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Center: Stat Badges (Centered Horizontally) */}
        <div className="flex items-center justify-center gap-2 flex-wrap flex-1 my-1 lg:my-0">
          {/* Theirs to Handle Stat with Hover Popover */}
          <div className="relative group">
            <div className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer">
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

            {/* Hover Popover Menu */}
            {theirsToHandleCount > 0 && theirsToHandleItems.length > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 hidden group-hover:block z-50 w-80 sm:w-96">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xl space-y-3" style={{ boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)' }}>
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <GitPullRequest className="w-3.5 h-3.5 text-gray-400" />
                      Theirs to Handle ({theirsToHandleCount})
                    </span>
                    <span className="text-[10px] text-gray-400">Click # to jump</span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
                    {theirsToHandleItems.map(({ repoName, prs }, repoIdx) => {
                      const isPurple = getRepoTheme(repoName, repoIdx) === 'purple';
                      return (
                        <div key={repoName} className="space-y-1.5">
                          <div
                            className={`text-[11px] font-semibold truncate border-b border-gray-100 pb-1 uppercase tracking-wider ${
                              isPurple ? 'text-purple-600' : 'text-blue-600'
                            }`}
                            title={repoName}
                          >
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
                                    onClick={() => onSelectPR(pr.cardId, 'bottom')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between group/pr ${
                                      isInProcess
                                        ? isPurple
                                          ? 'bg-purple-50/80 border-purple-200 text-purple-900 font-semibold'
                                          : 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                                        : isPurple
                                        ? 'bg-gray-50 hover:bg-purple-50 border-gray-200 hover:border-purple-200 text-gray-700'
                                        : 'bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-200 text-gray-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`${isPurple ? 'text-purple-600' : 'text-blue-600'} font-bold`}>
                                        #{pr.number}
                                      </span>
                                      <span
                                        className="text-[10px] text-gray-600 group-hover/pr:text-gray-900 font-sans truncate max-w-[150px]"
                                        title={pr.branchName || pr.title}
                                      >
                                        {pr.branchName || pr.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {pr.hasMergeConflicts && (
                                        <span className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                          Conflict
                                        </span>
                                      )}
                                      {isInProcess ? (
                                        <span
                                          className={`text-[10px] px-2 py-0.5 rounded-md font-sans font-semibold flex items-center gap-1.5 shrink-0 ${
                                            isPurple
                                              ? 'text-purple-700 bg-purple-100/80 border border-purple-200'
                                              : 'text-blue-700 bg-blue-100/80 border border-blue-200'
                                          }`}
                                        >
                                          <RefreshCw
                                            className={`w-3 h-3 ${
                                              isPurple ? 'text-purple-600' : 'text-blue-600'
                                            } animate-spin`}
                                          />
                                          <span>{agentInfo?.agent || 'agent'}</span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`text-[10px] text-gray-400 shrink-0 ${
                                            isPurple
                                              ? 'group-hover/pr:text-purple-600'
                                              : 'group-hover/pr:text-blue-600'
                                          }`}
                                        >
                                          Jump →
                                        </span>
                                      )}
                                    </div>
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
            )}
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
                    Not by @{currentUser || 'you'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hover Popover Menu */}
            {awaitingCommentCount > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 hidden group-hover:block z-50 w-80 sm:w-96">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xl space-y-3" style={{ boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)' }}>
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                      PRs Awaiting Comment ({awaitingCommentCount})
                    </span>
                    <span className="text-[10px] text-gray-400">Click # to jump</span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
                    {awaitingCommentItems.map(({ repoName, prs }, repoIdx) => {
                      const isPurple = getRepoTheme(repoName, repoIdx) === 'purple';
                      return (
                        <div key={repoName} className="space-y-1.5">
                          <div
                            className={`text-[11px] font-semibold truncate border-b border-gray-100 pb-1 uppercase tracking-wider ${
                              isPurple ? 'text-purple-600' : 'text-blue-600'
                            }`}
                            title={repoName}
                          >
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
                                    onClick={() => onSelectPR(pr.cardId, 'bottom')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between group/pr ${
                                      isInProcess
                                        ? isPurple
                                          ? 'bg-purple-50/80 border-purple-200 text-purple-900 font-semibold'
                                          : 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                                        : isPurple
                                        ? 'bg-gray-50 hover:bg-purple-50 border-gray-200 hover:border-purple-200 text-gray-700'
                                        : 'bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-200 text-gray-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`${isPurple ? 'text-purple-600' : 'text-blue-600'} font-bold`}>
                                        #{pr.number}
                                      </span>
                                      <span
                                        className="text-[10px] text-gray-600 group-hover/pr:text-gray-900 font-sans truncate max-w-[150px]"
                                        title={pr.branchName || pr.title}
                                      >
                                        {pr.branchName || pr.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {pr.hasMergeConflicts && (
                                        <span className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                          Conflict
                                        </span>
                                      )}
                                      {isInProcess ? (
                                        <span
                                          className={`text-[10px] px-2 py-0.5 rounded-md font-sans font-semibold flex items-center gap-1.5 shrink-0 ${
                                            isPurple
                                              ? 'text-purple-700 bg-purple-100/80 border border-purple-200'
                                              : 'text-blue-700 bg-blue-100/80 border border-blue-200'
                                          }`}
                                        >
                                          <RefreshCw
                                            className={`w-3 h-3 ${
                                              isPurple ? 'text-purple-600' : 'text-blue-600'
                                            } animate-spin`}
                                          />
                                          <span>{agentInfo?.agent || 'agent'}</span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`text-[10px] text-gray-400 shrink-0 ${
                                            isPurple
                                              ? 'group-hover/pr:text-purple-600'
                                              : 'group-hover/pr:text-blue-600'
                                          }`}
                                        >
                                          Jump →
                                        </span>
                                      )}
                                    </div>
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
            )}
          </div>

          {/* Search Input Field */}
          {onSearchChange && (
            <div className="relative flex items-center ml-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search PRs..."
                className="pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-36 sm:w-44 lg:w-52 transition-all placeholder:text-gray-400 text-gray-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Header (Right) */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Rules Editor Toggle */}
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>Logic Gates</span>
          </button>

          {/* Settings & Keys Modal Toggle */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 transition-all"
          >
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>Settings & Keys</span>
          </button>

          {/* Close All Worktrees Toggle */}
          {onOpenCloseWorktreesModal && (
            <button
              onClick={onOpenCloseWorktreesModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 text-xs font-medium border border-rose-200 transition-all cursor-pointer shadow-2xs"
              title="Close all git worktrees across monitored repos in Antigravity IDE terminal"
            >
              <FolderX className="w-3.5 h-3.5 text-rose-600" />
              <span>Close all worktrees</span>
            </button>
          )}

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

      {/* Clear All Agents Confirmation Modal */}
      {onClearAllActiveAgents && (
        <ClearAgentsModal
          isOpen={isClearModalOpen}
          onClose={() => setIsClearModalOpen(false)}
          onConfirm={onClearAllActiveAgents}
          activeCount={activeAgentCount}
        />
      )}
    </header>
  );
};
