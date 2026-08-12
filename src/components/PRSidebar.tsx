'use client';

import React from 'react';
import { PRWithGates } from '@/types';
import { GitPullRequest, CheckCircle2, AlertCircle, Clock, Layers, AlertTriangle } from 'lucide-react';

interface PRSidebarProps {
  prsWithGates: PRWithGates[];
  activePRId: string | null;
  onSelectPR: (prId: string) => void;
}

export const PRSidebar: React.FC<PRSidebarProps> = ({ prsWithGates, activePRId, onSelectPR }) => {
  return (
    <aside className="w-full lg:w-80 shrink-0 glass-panel rounded-2xl p-4 border border-slate-800/80 h-full overflow-y-auto space-y-3 shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Pull Requests ({prsWithGates.length})
          </h2>
        </div>
      </div>

      {prsWithGates.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-4 text-center">No pull requests available.</p>
      ) : (
        <div className="space-y-2">
          {prsWithGates.map(({ pr, evaluatedGates }) => {
            const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
            const isActive = activePRId === cardId;
            const passedGates = evaluatedGates.filter((g) => g.passed);

            return (
              <button
                key={cardId}
                onClick={() => onSelectPR(cardId)}
                className={`w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1.5 group ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500/60 shadow-lg shadow-indigo-900/20'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300 truncate max-w-[170px]" title={pr.repo_full_name}>
                    {pr.repo_name}
                  </span>
                  <div className="flex items-center gap-1">
                    {pr.has_merge_conflicts && (
                      <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/20 px-1 py-0.2 rounded border border-rose-500/40 shrink-0" title="Merge Conflicts">
                        Conflict
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20 shrink-0">
                      #{pr.number}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 line-clamp-2 leading-snug">
                  {pr.title}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] border-t border-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    {pr.has_merge_conflicts ? (
                      <span className="flex items-center gap-1 text-rose-400 font-bold">
                        <AlertTriangle className="w-3 h-3" /> Conflicts
                      </span>
                    ) : pr.checks_status === 'success' ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> CI Passed
                      </span>
                    ) : pr.checks_status === 'failure' ? (
                      <span className="flex items-center gap-1 text-rose-400 font-medium">
                        <AlertCircle className="w-3 h-3" /> CI Failing
                      </span>
                    ) : pr.checks_status === 'pending' ? (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      <span className="text-slate-500">CI N/A</span>
                    )}
                  </div>

                  {passedGates.length > 0 && (
                    <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30">
                      {passedGates.length} Gate{passedGates.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
