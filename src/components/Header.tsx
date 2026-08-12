'use client';

import React from 'react';
import { AgentType } from '@/types';
import { GitPullRequest, RefreshCw, Settings, Sliders, Terminal, ShieldCheck, Cpu, Key } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  defaultAgent: AgentType;
  onChangeAgent: (agent: AgentType) => void;
  currentUser: string | null;
  prCount: number;
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
}) => {
  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-slate-800/80 px-6 py-4 mb-8">
      <div className="w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <GitPullRequest className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Git Workflow Agent Hub
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-medium">
                {prCount} Active PRs
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Logical Gates</span> • <span>Antigravity IDE CLI Spawns</span>
              {currentUser && (
                <span className="text-slate-300 font-medium flex items-center gap-1 ml-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> @{currentUser}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Controls Header */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Agent CLI Switcher */}
          <div className="flex items-center bg-slate-900/80 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => onChangeAgent('codex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                defaultAgent === 'codex'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>codex</span>
            </button>
            <button
              onClick={() => onChangeAgent('claude')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                defaultAgent === 'claude'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>claude code</span>
            </button>
          </div>

          {/* Rules Editor Toggle */}
          <button
            onClick={onOpenRules}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700/60 transition-all hover:border-slate-600"
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Logic Gates & Rules</span>
          </button>

          {/* Credentials Modal Toggle */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700/60 transition-all hover:border-slate-600"
          >
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Credentials</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh PRs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
