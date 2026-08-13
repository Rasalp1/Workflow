'use client';

import React, { useState } from 'react';
import { ActiveAgentInfo, EvaluatedGateResult, PRWithGates } from '@/types';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { MergeConfirmModal } from '@/components/MergeConfirmModal';
import {
  GitPullRequest,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Wrench,
  Eye,
  AlertTriangle,
  Code2,
  FileCode,
  GitBranch,
  GitMerge,
  RefreshCw,
  X,
} from 'lucide-react';

interface PRCardProps {
  prWithGates: PRWithGates;
  onTriggerGate: (prWithGates: PRWithGates, gateResult: EvaluatedGateResult) => void;
  onMergePR?: (prWithGates: PRWithGates) => Promise<void> | void;
  isSelected?: boolean;
  columnTheme?: 'blue' | 'purple';
  customId?: string;
  isInProcess?: boolean;
  activeAgentInfo?: ActiveAgentInfo | null;
  onClearActiveAgent?: (cardId: string) => void;
}

export const PRCard: React.FC<PRCardProps> = ({
  prWithGates,
  onTriggerGate,
  onMergePR,
  isSelected,
  columnTheme = 'blue',
  customId,
  isInProcess,
  activeAgentInfo,
  onClearActiveAgent,
}) => {
  const { pr, evaluatedGates } = prWithGates;
  const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
  const elementId = customId || cardId;
  const passedGates = evaluatedGates.filter((g) => g.passed);

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const handleOpenMergeModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMergeError(null);
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (isMerging) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      if (onMergePR) {
        await onMergePR(prWithGates);
      } else {
        const res = await fetch('/api/prs/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoFullName: pr.repo_full_name,
            prNumber: pr.number,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to merge PR');
        }
      }
      setIsMergeModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Merge failed';
      setMergeError(msg);
    } finally {
      setIsMerging(false);
    }
  };

  const getGateIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Eye':
        return <Eye className="w-3.5 h-3.5" />;
      case 'Wrench':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'AlertTriangle':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      default:
        return <Terminal className="w-3.5 h-3.5" />;
    }
  };

  const getGateButtonStyles = (color?: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 hover:border-purple-300';
      case 'rose':
        return 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300';
      case 'emerald':
        return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300';
      case 'amber':
        return 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300';
      default:
        return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300';
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}hrs ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears}y ago`;
  };

  return (
    <div
      id={elementId}
      data-pr-id={cardId}
      className={`card rounded-xl p-5 mb-6 transition-all scroll-mt-20 ${
        isInProcess ? 'border-blue-400 bg-blue-50/20 ring-1 ring-blue-300/40' : ''
      } ${
        isSelected
          ? columnTheme === 'purple'
            ? 'border-purple-400 shadow-purple-100 ring-2 ring-purple-400/20'
            : 'border-blue-400 shadow-blue-100 ring-2 ring-blue-400/20'
          : 'border-gray-200'
      }`}
      style={
        isSelected && !isInProcess
          ? {
              boxShadow:
                columnTheme === 'purple'
                  ? '0 0 0 3px rgba(168,85,247,0.15), 0 4px 12px -2px rgba(0,0,0,0.08)'
                  : '0 0 0 3px rgba(59,130,246,0.15), 0 4px 12px -2px rgba(0,0,0,0.08)',
            }
          : {}
      }
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium border border-gray-200">
              {pr.repo_full_name}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
              #{pr.number}
            </span>
            <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200 flex items-center gap-1.5">
              <Code2 className="w-3 h-3 text-gray-400" />
              {pr.head.ref} → {pr.base.ref}
            </span>
          </div>

          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <a
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              {pr.title}
            </a>
          </h2>
        </div>

        {/* PR Status */}
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mergeability Status */}
            {!pr.has_merge_conflicts && pr.mergeable_state === 'behind' ? (
              <span
                className="text-xs flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium"
                title={`Branch ${pr.head.ref} is behind ${pr.base.ref}`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Behind {pr.base.ref}
              </span>
            ) : !pr.has_merge_conflicts && (pr.has_merge_conflicts === false || pr.mergeable_state === 'clean') ? (
              <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Mergeable
              </span>
            ) : null}

            {/* CI Status */}
            {pr.checks_status === 'success' && (
              <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> CI Passed
              </span>
            )}
            {pr.checks_status === 'failure' && (
              <span className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> CI Failing
              </span>
            )}

            <span className="text-xs text-gray-700 flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
              {pr.user.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
              ) : (
                <User className="w-3.5 h-3.5 text-gray-400" />
              )}
              @{pr.user.login}
            </span>
          </div>
        </div>
      </div>

      {/* Agent Working Callout Banner */}
      {isInProcess && (
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-purple-50/90 border border-blue-200 text-blue-900 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <span>Agent In Process</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-900 font-mono font-semibold uppercase">
                  {activeAgentInfo?.agent || 'codex'}
                </span>
              </h4>
              <p className="text-[11px] text-blue-700 font-medium leading-tight mt-0.5">
                CLI agent active on branch <span className="font-mono text-blue-950 font-bold">{pr.head.ref}</span> in Antigravity IDE terminal.
              </p>
            </div>
          </div>
          {onClearActiveAgent && (
            <button
              onClick={() => onClearActiveAgent(cardId)}
              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-blue-700 hover:text-blue-900 border border-blue-200 text-[11px] font-semibold transition-all shadow-2xs shrink-0"
            >
              Mark Done
            </button>
          )}
        </div>
      )}

      {/* High-Visibility Conflict Callout Banner */}
      {pr.has_merge_conflicts && (
        <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-500 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-rose-800 flex items-center gap-2">
              Merge Conflicts against <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-700 font-mono text-xs">{pr.base.ref}</code>
            </h4>
            <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">
              Branch <span className="font-mono text-rose-800 font-semibold">{pr.head.ref}</span> cannot be automatically merged into <span className="font-mono text-rose-800 font-semibold">{pr.base.ref}</span>. Rebase or merge to resolve conflicts before deploying agent workflows.
            </p>
          </div>
        </div>
      )}

      {/* PR Description + Comment Thread — unified continuous flow */}
      <div className="my-4 space-y-3 w-full">
        {pr.body && (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GitPullRequest className="w-3 h-3 text-blue-500" /> Description
            </h4>
            <MarkdownRenderer content={pr.body} />
          </div>
        )}

        {pr.comments.length === 0 ? (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-400 italic text-center">
            No discussion comments recorded for this PR yet.
          </div>
        ) : (
          <div className="space-y-3 w-full" id="comment-thread">
            {pr.comments.map((comment) => (
              <div
                key={`${comment.id}-${comment.review_state || (comment.is_review_comment ? 'rev' : 'iss')}`}
                className="w-full rounded-lg bg-white border border-gray-200 p-4 shadow-sm space-y-3 transition-colors hover:border-gray-300"
              >
                {/* Comment Author Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    {comment.user.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={comment.user.avatar_url}
                        alt={comment.user.login}
                        className="w-5 h-5 rounded-full border border-gray-200"
                      />
                    ) : (
                      <User className="w-4 h-4 text-gray-400" />
                    )}
                    <a
                      href={comment.user.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-xs text-blue-700 hover:underline"
                    >
                      @{comment.user.login}
                    </a>

                    {comment.review_state ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-mono border font-semibold ${
                          comment.review_state === 'CHANGES_REQUESTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : comment.review_state === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        <FileCode className="w-3 h-3" />
                        PR Review: {comment.review_state.replace(/_/g, ' ')}
                      </span>
                    ) : comment.is_review_comment ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono border border-purple-200">
                        <FileCode className="w-3 h-3" />
                        Code Review {comment.path ? `: ${comment.path}${comment.line ? `#L${comment.line}` : ''}` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-mono border border-gray-200">
                        Issue Comment
                      </span>
                    )}
                  </div>

                  <span
                    className="text-[11px] text-gray-400 flex items-center gap-1 font-mono"
                    title={new Date(comment.created_at).toLocaleString()}
                  >
                    <Clock className="w-3 h-3 text-gray-300" />
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>

                {/* Comment Rendered Markdown Content - Uses Full Width */}
                <div className="w-full pt-1">
                  <MarkdownRenderer content={comment.body} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar: Logic Gates Buttons */}
      <div id={`${elementId}-action-bar`} className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
            #{pr.number}
          </span>
          <span className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200 flex items-center gap-1.5" title={`${pr.head.ref} → ${pr.base.ref}`}>
            <GitBranch className="w-3 h-3 text-gray-400" />
            {pr.head.ref}
          </span>
          {pr.has_merge_conflicts && (
            <span
              className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-semibold"
              title={`Merge conflicts detected on branch ${pr.head.ref} against ${pr.base.ref}`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Conflicts with {pr.base.ref}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {passedGates.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No gate rules triggered for this PR state.</span>
          ) : (
            passedGates.map((gate) => (
              <button
                key={gate.rule.id}
                onClick={() => onTriggerGate(prWithGates, gate)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${getGateButtonStyles(
                  gate.rule.buttonColor
                )}`}
              >
                {getGateIcon(gate.rule.buttonIcon)}
                <span>{gate.rule.buttonLabel}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                  {gate.targetAgent}
                </span>
              </button>
            ))
          )}

          {!pr.has_merge_conflicts && (
            <button
              onClick={handleOpenMergeModal}
              disabled={isMerging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-300 transition-all disabled:opacity-50 cursor-pointer"
              title={`Merge PR #${pr.number} into ${pr.base.ref}`}
            >
              {isMerging ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              ) : (
                <GitMerge className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isMerging ? 'Merging...' : 'Merge'}</span>
            </button>
          )}

          {mergeError && (
            <span className="text-xs text-rose-600 font-medium" title={mergeError}>
              {mergeError}
            </span>
          )}
        </div>
      </div>

      {/* Custom Centered PR Merge Confirmation Modal */}
      <MergeConfirmModal
        isOpen={isMergeModalOpen}
        onClose={() => !isMerging && setIsMergeModalOpen(false)}
        pr={pr}
        onConfirm={handleConfirmMerge}
        isMerging={isMerging}
        error={mergeError}
      />
    </div>
  );
};

