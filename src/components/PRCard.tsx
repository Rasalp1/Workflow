'use client';

import React, { useState } from 'react';
import { EvaluatedGateResult, PRWithGates } from '@/types';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
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
  Check,
} from 'lucide-react';

interface PRCardProps {
  prWithGates: PRWithGates;
  onTriggerGate: (prWithGates: PRWithGates, gateResult: EvaluatedGateResult) => void;
  isSelected?: boolean;
}

export const PRCard: React.FC<PRCardProps> = ({ prWithGates, onTriggerGate, isSelected }) => {
  const { pr, evaluatedGates } = prWithGates;
  const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
  const passedGates = evaluatedGates.filter((g) => g.passed);

  const [isSpawningWorktree, setIsSpawningWorktree] = useState(false);
  const [worktreeStatus, setWorktreeStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSpawnWorktree = async () => {
    setIsSpawningWorktree(true);
    setWorktreeStatus(null);
    try {
      const res = await fetch('/api/worktree/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: pr.repo_full_name,
          localPath: pr.local_path,
          branchName: pr.head.ref,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWorktreeStatus({ success: false, message: data.error || 'Failed to spawn worktree' });
      } else {
        setWorktreeStatus({ success: true, message: data.message || 'Worktree opened in Antigravity IDE!' });
        setTimeout(() => setWorktreeStatus(null), 6000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error spawning worktree';
      setWorktreeStatus({ success: false, message: msg });
    } finally {
      setIsSpawningWorktree(false);
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
      id={cardId}
      className={`card rounded-xl p-5 mb-6 transition-all scroll-mt-20 ${
        isSelected
          ? 'border-blue-300 shadow-blue-100'
          : 'border-gray-200'
      }`}
      style={isSelected ? { boxShadow: '0 0 0 3px rgba(59,130,246,0.1), 0 4px 12px -2px rgba(0,0,0,0.08)' } : {}}
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

            {/* Worktree Button */}
            <button
              onClick={handleSpawnWorktree}
              disabled={isSpawningWorktree}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:border-blue-300 transition-all disabled:opacity-50"
              title={`Spawn Git Worktree for branch "${pr.head.ref}" in Antigravity IDE`}
            >
              <GitBranch className="w-3 h-3 shrink-0" />
              <span>{isSpawningWorktree ? 'Spawning...' : 'Worktree'}</span>
            </button>
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
            {/* Merge Conflict & Mergeability Status */}
            {pr.has_merge_conflicts ? (
              <span
                className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold"
                title={`Merge conflicts detected on branch ${pr.head.ref} against ${pr.base.ref}`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Conflicts with {pr.base.ref}
              </span>
            ) : pr.mergeable_state === 'behind' ? (
              <span
                className="text-xs flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium"
                title={`Branch ${pr.head.ref} is behind ${pr.base.ref}`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Behind {pr.base.ref}
              </span>
            ) : pr.has_merge_conflicts === false || pr.mergeable_state === 'clean' ? (
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
                <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
              ) : (
                <User className="w-3.5 h-3.5 text-gray-400" />
              )}
              @{pr.user.login}
            </span>
          </div>
        </div>
      </div>

      {/* High-Visibility Conflict Callout Banner */}
      {pr.has_merge_conflicts && (
        <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
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

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              onClick={handleSpawnWorktree}
              disabled={isSpawningWorktree}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold border border-rose-700 transition-all disabled:opacity-50"
              title={`Spawn Git Worktree for branch "${pr.head.ref}" to resolve conflicts`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{isSpawningWorktree ? 'Opening...' : 'Resolve via Worktree'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Worktree Spawning Notification Banner */}
      {worktreeStatus && (
        <div
          className={`mt-3 p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            worktreeStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {worktreeStatus.success ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{worktreeStatus.message}</span>
          </div>
          <button
            onClick={() => setWorktreeStatus(null)}
            className="text-[11px] text-gray-500 hover:text-gray-700 font-medium"
          >
            Dismiss
          </button>
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
                key={comment.id}
                className="w-full rounded-lg bg-white border border-gray-200 p-4 shadow-sm space-y-3 transition-colors hover:border-gray-300"
              >
                {/* Comment Author Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    {comment.user.avatar_url ? (
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

                    {comment.is_review_comment ? (
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

      {/* Action Bar: Logic Gates & Spawner Buttons */}
      <div id={`${cardId}-action-bar`} className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
            #{pr.number}
          </span>
          <span className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200 flex items-center gap-1.5" title={`${pr.head.ref} → ${pr.base.ref}`}>
            <GitBranch className="w-3 h-3 text-gray-400" />
            {pr.head.ref}
          </span>

          {/* Worktree Button */}
          <button
            onClick={handleSpawnWorktree}
            disabled={isSpawningWorktree}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:border-blue-300 shadow-sm transition-all disabled:opacity-50"
            title={`Spawn Git Worktree for branch "${pr.head.ref}" in Antigravity IDE`}
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span>{isSpawningWorktree ? 'Spawning...' : 'Worktree'}</span>
          </button>
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
        </div>
      </div>
    </div>
  );
};
