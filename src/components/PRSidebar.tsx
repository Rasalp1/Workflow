import React from 'react';
import { ActiveAgentInfo, PRWithGates } from '@/types';
import { CheckCircle2, AlertCircle, Clock, Layers, AlertTriangle, RefreshCw } from 'lucide-react';

interface PRSidebarProps {
  prsWithGates: PRWithGates[];
  activeCol1PRId?: string | null;
  activeCol2PRId?: string | null;
  activePRId?: string | null;
  activeAgentPRs?: Record<string, ActiveAgentInfo>;
  onSelectPR: (prId: string, position?: 'top' | 'bottom') => void;
}

export const PRSidebar: React.FC<PRSidebarProps> = ({
  prsWithGates,
  activeCol1PRId,
  activeCol2PRId,
  activePRId,
  activeAgentPRs = {},
  onSelectPR,
}) => {
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
            const isCol1Active = activeCol1PRId === cardId || (activePRId === cardId && !activeCol2PRId);
            const isCol2Active = activeCol2PRId === cardId;
            const isBothActive = isCol1Active && isCol2Active;
            const isInProcess = Boolean(activeAgentPRs[cardId]);
            const agentInfo = activeAgentPRs[cardId];
            const passedGates = evaluatedGates.filter((g) => g.passed);

            let containerClasses = 'bg-white hover:bg-gray-50 border-gray-100 hover:border-gray-200';
            let numberClasses = 'text-gray-500 bg-gray-100 border-gray-200';
            let titleClasses = 'text-gray-800 group-hover:text-gray-900';

            if (isBothActive) {
              containerClasses =
                'bg-gradient-to-r from-blue-50/90 to-purple-50/90 border-indigo-300 shadow-sm ring-1 ring-indigo-200/60';
              numberClasses = 'text-indigo-800 bg-indigo-100 border-indigo-200 font-bold';
              titleClasses = 'text-indigo-950 font-semibold';
            } else if (isCol1Active) {
              containerClasses =
                'bg-blue-50/90 border-blue-300 shadow-sm ring-1 ring-blue-200/60';
              numberClasses = 'text-blue-800 bg-blue-100 border-blue-200 font-bold';
              titleClasses = 'text-blue-950 font-semibold';
            } else if (isCol2Active) {
              containerClasses =
                'bg-purple-50/90 border-purple-300 shadow-sm ring-1 ring-purple-200/60';
              numberClasses = 'text-purple-800 bg-purple-100 border-purple-200 font-bold';
              titleClasses = 'text-purple-950 font-semibold';
            }

            return (
              <button
                key={cardId}
                onClick={() => onSelectPR(cardId, 'top')}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border flex flex-col gap-1.5 group ${containerClasses}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] font-medium text-gray-500 group-hover:text-gray-700 truncate max-w-[130px]"
                    title={pr.repo_full_name}
                  >
                    {pr.repo_name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Active Agent In Process Badge */}
                    {isInProcess && (
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs tracking-wider uppercase flex items-center gap-1"
                        title={`Agent working: ${agentInfo?.agent || 'cli agent'}`}
                      >
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        {agentInfo?.agent || 'AGENT'}
                      </span>
                    )}

                    {/* Active Column Badges */}
                    {isCol1Active && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs tracking-wider uppercase">
                        Col 1
                      </span>
                    )}
                    {isCol2Active && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white shadow-2xs tracking-wider uppercase">
                        Col 2
                      </span>
                    )}
                    {pr.has_merge_conflicts && (
                      <span
                        className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0"
                        title="Merge Conflicts"
                      >
                        Conflict
                      </span>
                    )}
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border shrink-0 ${numberClasses}`}>
                      #{pr.number}
                    </span>
                  </div>
                </div>

                <div className={`text-xs line-clamp-2 leading-snug ${titleClasses}`}>
                  {pr.title}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] border-t border-gray-100/80">
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
