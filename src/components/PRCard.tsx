'use client';

import React, { useState } from 'react';
import { EvaluatedGateResult, PRWithGates } from '@/types';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  GitPullRequest,
  User,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Wrench,
  Eye,
  AlertTriangle,
  Folder,
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
    } catch (err: any) {
      setWorktreeStatus({ success: false, message: err.message || 'Network error spawning worktree' });
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
        return 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40 hover:border-purple-400 glow-purple';
      case 'rose':
        return 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40 hover:border-rose-400';
      case 'emerald':
        return 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40 hover:border-emerald-400';
      case 'amber':
        return 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40 hover:border-amber-400';
      default:
        return 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40 hover:border-indigo-400 glow-blue';
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
      className={`glass-card rounded-2xl p-6 mb-8 border transition-all scroll-mt-24 ${
        isSelected
          ? 'border-indigo-500/80 shadow-xl shadow-indigo-950/40 ring-1 ring-indigo-500/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-400 font-semibold border border-slate-700/80">
              {pr.repo_full_name}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-mono font-bold border border-purple-500/20">
              #{pr.number}
            </span>
            <span className="text-xs text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              {pr.head.ref} → {pr.base.ref}
            </span>

            {/* Worktree Button */}
            <button
              onClick={handleSpawnWorktree}
              disabled={isSpawningWorktree}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 active:bg-indigo-600/50 text-indigo-300 hover:text-indigo-200 text-xs font-semibold border border-indigo-500/40 hover:border-indigo-400 transition-all shadow-sm disabled:opacity-50"
              title={`Spawn Git Worktree for branch "${pr.head.ref}" in Antigravity IDE`}
            >
              <GitBranch className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{isSpawningWorktree ? 'Spawning...' : 'Worktree'}</span>
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
            <a
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
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
                className="text-xs flex items-center gap-1 text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/40 font-bold animate-pulse shadow-sm shadow-rose-950/50"
                title={`Merge conflicts detected on branch ${pr.head.ref} against ${pr.base.ref}`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Conflicts with {pr.base.ref}
              </span>
            ) : pr.mergeable_state === 'behind' ? (
              <span
                className="text-xs flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 font-medium"
                title={`Branch ${pr.head.ref} is behind ${pr.base.ref}`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Behind {pr.base.ref}
              </span>
            ) : pr.has_merge_conflicts === false || pr.mergeable_state === 'clean' ? (
              <span className="text-xs flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Mergeable Clean
              </span>
            ) : null}

            {/* CI Status */}
            {pr.checks_status === 'success' && (
              <span className="text-xs flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> CI Checks Passed
              </span>
            )}
            {pr.checks_status === 'failure' && (
              <span className="text-xs flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> CI Checks Failing
              </span>
            )}

            <span className="text-xs text-slate-300 flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              {pr.user.avatar_url ? (
                <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-400" />
              )}
              @{pr.user.login}
            </span>
          </div>
        </div>
      </div>

      {/* High-Visibility Conflict Callout Banner */}
      {pr.has_merge_conflicts && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg shadow-rose-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5 md:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                Merge Conflicts Detected against <code className="bg-rose-950/60 px-1.5 py-0.5 rounded text-rose-200 font-mono text-xs">{pr.base.ref}</code>
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5 leading-relaxed">
                Branch <span className="font-mono text-slate-100 font-semibold">{pr.head.ref}</span> cannot be automatically merged into <span className="font-mono text-slate-100 font-semibold">{pr.base.ref}</span>. Rebase or merge <span className="font-mono">{pr.base.ref}</span> to resolve conflict markers before deploying agent workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              onClick={handleSpawnWorktree}
              disabled={isSpawningWorktree}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 active:bg-rose-600/70 text-rose-100 text-xs font-bold border border-rose-500/50 transition-all shadow-sm disabled:opacity-50"
              title={`Spawn Git Worktree for branch "${pr.head.ref}" to resolve conflicts`}
            >
              <GitBranch className="w-3.5 h-3.5 text-rose-300" />
              <span>{isSpawningWorktree ? 'Opening Worktree...' : 'Resolve via Worktree'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Worktree Spawning Notification Banner */}
      {worktreeStatus && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            worktreeStatus.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {worktreeStatus.success ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{worktreeStatus.message}</span>
          </div>
          <button
            onClick={() => setWorktreeStatus(null)}
            className="text-[11px] text-slate-400 hover:text-slate-200 font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* PR Description + Comment Thread — unified continuous flow */}
      <div className="my-5 space-y-4 w-full">
        {pr.body && (
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GitPullRequest className="w-3.5 h-3.5 text-indigo-400" /> Description
            </h4>
            <MarkdownRenderer content={pr.body} />
          </div>
        )}

        {pr.comments.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 italic text-center">
            No discussion comments recorded for this PR yet.
          </div>
        ) : (
          <div className="space-y-4 w-full" id="comment-thread">
            {pr.comments.map((comment) => (
              <div
                key={comment.id}
                className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-sm space-y-3 transition-colors hover:border-slate-700"
              >
                {/* Comment Author Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/60 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    {comment.user.avatar_url ? (
                      <img
                        src={comment.user.avatar_url}
                        alt={comment.user.login}
                        className="w-5 h-5 rounded-full border border-slate-700"
                      />
                    ) : (
                      <User className="w-4 h-4 text-indigo-400" />
                    )}
                    <a
                      href={comment.user.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-xs text-indigo-300 hover:underline"
                    >
                      @{comment.user.login}
                    </a>

                    {comment.is_review_comment ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                        <FileCode className="w-3 h-3" />
                        Code Review {comment.path ? `: ${comment.path}${comment.line ? `#L${comment.line}` : ''}` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono border border-slate-700">
                        Issue Comment
                      </span>
                    )}
                  </div>

                  <span
                    className="text-[11px] text-slate-400 flex items-center gap-1 font-mono"
                    title={new Date(comment.created_at).toLocaleString()}
                  >
                    <Clock className="w-3 h-3 text-slate-500" />
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
      <div className="pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Logical Gates Evaluated:
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            {passedGates.length} / {evaluatedGates.length} Actionable
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {passedGates.length === 0 ? (
            <span className="text-xs text-slate-500 italic">No logical gate rules triggered for this PR state.</span>
          ) : (
            passedGates.map((gate) => (
              <button
                key={gate.rule.id}
                onClick={() => onTriggerGate(prWithGates, gate)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-md ${getGateButtonStyles(
                  gate.rule.buttonColor
                )}`}
              >
                {getGateIcon(gate.rule.buttonIcon)}
                <span>{gate.rule.buttonLabel}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-300 font-mono">
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
