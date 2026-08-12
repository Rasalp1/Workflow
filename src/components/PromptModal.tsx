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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="panel-raised rounded-xl w-full max-w-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${isCommentAction ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
              {isCommentAction ? <MessageSquare className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                {isCommentAction ? 'Post GitHub Comment:' : 'Trigger Agent:'}{' '}
                <span className="text-blue-600">{gateResult.rule.buttonLabel}</span>
              </h3>
              <p className="text-xs text-gray-500">
                {pr.repo_full_name} • PR #{pr.number} ({pr.head.ref})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-white">
          {/* Target Local Folder Mapping Notice (Only for spawn agent action) */}
          {!isCommentAction && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-600">
                <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-gray-700">Local Directory:</span>
                <span className="font-mono text-gray-600 truncate max-w-md">
                  {pr.local_path || 'No path configured'}
                </span>
              </div>

              {!pr.local_path && (
                <span className="text-rose-500 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Path Missing
                </span>
              )}
            </div>
          )}

          {/* Agent Selector (Only for spawn agent action) */}
          {!isCommentAction && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">CLI Agent Binary:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAgent('codex')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                    selectedAgent === 'codex'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>codex agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAgent('claude')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                    selectedAgent === 'claude'
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
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
              <label className="text-xs font-semibold text-gray-700">
                {isCommentAction ? 'GitHub Comment Body:' : 'Generated Prompt:'}
              </label>
              <span className="text-[11px] text-gray-400">Dynamically compiled from logical gate rules</span>
            </div>

            <textarea
              rows={6}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors leading-relaxed"
            />
          </div>

          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleAction}
            disabled={isSubmitting || (!isCommentAction && !pr.local_path)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50 transition-all ${
              isCommentAction
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-blue-600 hover:bg-blue-700'
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
