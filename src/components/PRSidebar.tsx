'use client';

import React from 'react';
import { PRWithGates } from '@/types';
import { CheckCircle2, AlertCircle, Clock, Layers, AlertTriangle } from 'lucide-react';

interface PRSidebarProps {
  prsWithGates: PRWithGates[];
  activePRId: string | null;
  onSelectPR: (prId: string) => void;
}

export const PRSidebar: React.FC<PRSidebarProps> = ({ prsWithGates, activePRId, onSelectPR }) => {
  return (
    <aside className="w-full lg:w-72 shrink-0 panel rounded-xl p-3 h-full overflow-y-auto space-y-2">
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 mb-1">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Pull Requests ({prsWithGates.length})
          </h2>
        </div>
      </div>

      {prsWithGates.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-4 text-center">No pull requests available.</p>
      ) : (
        <div className="space-y-1">
          {prsWithGates.map(({ pr, evaluatedGates }) => {
            const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
            const isActive = activePRId === cardId;
            const passedGates = evaluatedGates.filter((g) => g.passed);

            return (
              <button
                key={cardId}
                onClick={() => onSelectPR(cardId)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border flex flex-col gap-1.5 group ${
                  isActive
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-500 group-hover:text-gray-700 truncate max-w-[150px]" title={pr.repo_full_name}>
                    {pr.repo_name}
                  </span>
                  <div className="flex items-center gap-1">
                    {pr.has_merge_conflicts && (
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0" title="Merge Conflicts">
                        Conflict
                      </span>
                    )}
                    <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                      isActive ? 'text-blue-700 bg-blue-100 border-blue-200' : 'text-gray-500 bg-gray-100 border-gray-200'
                    }`}>
                      #{pr.number}
                    </span>
                  </div>
                </div>

                <div className={`text-xs font-medium line-clamp-2 leading-snug ${
                  isActive ? 'text-blue-900' : 'text-gray-800 group-hover:text-gray-900'
                }`}>
                  {pr.title}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    {pr.has_merge_conflicts ? (
                      <span className="flex items-center gap-1 text-rose-500 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Conflicts
                      </span>
                    ) : pr.checks_status === 'success' ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> CI Passed
                      </span>
                    ) : pr.checks_status === 'failure' ? (
                      <span className="flex items-center gap-1 text-rose-500 font-medium">
                        <AlertCircle className="w-3 h-3" /> CI Failing
                      </span>
                    ) : pr.checks_status === 'pending' ? (
                      <span className="flex items-center gap-1 text-amber-500 font-medium">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      <span className="text-gray-400">CI N/A</span>
                    )}
                  </div>

                  {passedGates.length > 0 && (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
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
