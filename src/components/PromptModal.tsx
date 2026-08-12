'use client';

import React, { useState } from 'react';
import { AgentType, EvaluatedGateResult, PRWithGates } from '@/types';
import { X, Play, Terminal, Cpu, Folder, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prWithGates: PRWithGates | null;
  gateResult: EvaluatedGateResult | null;
  onConfirmSpawn: (payload: {
    repoFullName: string;
    localPath: string;
    agent: AgentType;
    prompt: string;
  }) => Promise<void>;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  prWithGates,
  gateResult,
  onConfirmSpawn,
}) => {
  const [promptText, setPromptText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('codex');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (gateResult && prWithGates) {
      setPromptText(gateResult.generatedPrompt);
      setSelectedAgent(gateResult.targetAgent || 'codex');
      setStatusMessage(null);
    }
  }, [gateResult, prWithGates]);

  if (!isOpen || !prWithGates || !gateResult) return null;

  const { pr } = prWithGates;
  const isCommentAction = gateResult.rule.actionType === 'post_comment';

  const handleAction = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (isCommentAction) {
        // Post GitHub comment directly
        const res = await fetch('/api/prs/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoFullName: pr.repo_full_name,
            prNumber: pr.number,
            commentBody: promptText,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to post comment');
        }

        setStatusMessage({
          type: 'success',
          text: `Comment posted on GitHub PR #${pr.number}!`,
        });
      } else {
        // Spawn CLI Agent in Antigravity IDE
        await onConfirmSpawn({
          repoFullName: pr.repo_full_name,
          localPath: pr.local_path || '',
          agent: selectedAgent,
          prompt: promptText,
        });

        setStatusMessage({
          type: 'success',
          text: `Launched ${selectedAgent} agent in Antigravity IDE terminal!`,
        });
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Action failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-2xl w-full max-w-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              {isCommentAction ? <MessageSquare className="w-5 h-5 text-amber-400" /> : <Terminal className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {isCommentAction ? 'Post GitHub Comment:' : 'Trigger Agent:'}{' '}
                <span className="text-indigo-400">{gateResult.rule.buttonLabel}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {pr.repo_full_name} • PR #{pr.number} ({pr.head.ref})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Target Local Folder Mapping Notice (Only for spawn agent action) */}
          {!isCommentAction && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-slate-200">Local Directory:</span>
                <span className="font-mono text-slate-300 truncate max-w-md">
                  {pr.local_path || 'No path configured'}
                </span>
              </div>

              {!pr.local_path && (
                <span className="text-rose-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Path Missing
                </span>
              )}
            </div>
          )}

          {/* Agent Selector (Only for spawn agent action) */}
          {!isCommentAction && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">CLI Agent Binary:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAgent('codex')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    selectedAgent === 'codex'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-600/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>codex agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAgent('claude')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    selectedAgent === 'claude'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-lg shadow-purple-600/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                  <span>claude code agent</span>
                </button>
              </div>
            </div>
          )}

          {/* Generated Prompt/Comment Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                {isCommentAction ? 'GitHub Comment Body:' : 'Generated Prompt:'}
              </label>
              <span className="text-[11px] text-slate-400">Dynamically compiled from logical gate rules</span>
            </div>

            <textarea
              rows={6}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleAction}
            disabled={isSubmitting || (!isCommentAction && !pr.local_path)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg disabled:opacity-50 transition-all ${
              isCommentAction
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-600/20'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
            }`}
          >
            {isCommentAction ? <MessageSquare className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>
              {isSubmitting
                ? isCommentAction
                  ? 'Posting Comment...'
                  : 'Spawning in IDE Terminal...'
                : isCommentAction
                ? 'Post Comment on GitHub PR'
                : 'Spawn Agent in Antigravity Terminal'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
