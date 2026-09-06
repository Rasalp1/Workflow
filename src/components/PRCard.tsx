"use client";

import React, { useState } from "react";
import { ActiveAgentInfo, EvaluatedGateResult, PRWithGates } from "@/types";
import { GateIcon } from "@/components/ui/GateIcon";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { MergeConfirmModal } from "@/components/MergeConfirmModal";
import { isPrAwaitingComment } from "@/lib/logicGates";
import { checkRebaseStatus } from "@/lib/rebaseDetector";
import {
  GitPullRequest,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Eye,
  AlertTriangle,
  Code2,
  FileCode,
  GitBranch,
  GitMerge,
  GitCommit,
  RefreshCw,
  FolderPlus,
  Copy,
  Check,
} from "lucide-react";

interface PRCardProps {
  prWithGates: PRWithGates;
  onTriggerGate: (
    prWithGates: PRWithGates,
    gateResult: EvaluatedGateResult,
  ) => void;
  onMergePR?: (prWithGates: PRWithGates) => Promise<void> | void;
  onOpenWorktree?: (prWithGates: PRWithGates) => Promise<void> | void;
  isSelected?: boolean;
  customId?: string;
  currentUser?: string | null;
  isInProcess?: boolean;
  activeAgentInfo?: ActiveAgentInfo | null;
  onClearActiveAgent?: (cardId: string) => void;
}

export const PRCard: React.FC<PRCardProps> = ({
  prWithGates,
  onTriggerGate,
  onMergePR,
  onOpenWorktree,
  isSelected,
  customId,
  currentUser,
  isInProcess,
  activeAgentInfo,
  onClearActiveAgent,
}) => {
  const { pr, evaluatedGates } = prWithGates;
  const needsAttention = isPrAwaitingComment(pr, currentUser || null);
  const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
  const elementId = customId || cardId;
  const passedGates = evaluatedGates.filter((g) => g.passed);

  const addressIssuesGate = evaluatedGates.find(
    (g) => g.rule.id === "address-issues",
  ) || {
    rule: {
      id: "address-issues",
      name: "Address Review Issues",
      description: "PR owned by user with latest comment from someone else.",
      enabled: true,
      buttonLabel: "Address Issues",
      buttonIcon: "Wrench",
      buttonColor: "purple",
      actionType: "spawn_agent",
      conditions: {},
      promptTemplate: `Address review issues for PR #{pr_number} \n\nLook at the complete comment history on the pr that exists on this branch. Read it all, and then adress the reviewers recentmost feedback with the whole context of the PR in mind. Check the issues the reviewer has raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to adress the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a very detailed comment to the pr explaining what you did and why. `,
    },
    passed: false,
    generatedPrompt: `Address review issues for PR #${pr.number} \n\nLook at the complete comment history on the pr that exists on this branch. Read it all, and then adress the reviewers recentmost feedback with the whole context of the PR in mind. Check the issues the reviewer has raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to adress the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a very detailed comment to the pr explaining what you did and why. `,
    targetAgent: "codex",
  };
  const hasPassedAddressIssues = passedGates.some(
    (g) => g.rule.id === "address-issues",
  );

  const addressLatestGate = evaluatedGates.find(
    (g) => g.rule.id === "address-latest-comment",
  ) || {
    rule: {
      id: "address-latest-comment",
      name: "Address Recent Comment",
      description:
        "Address only the very recentmost comment/review on this PR instead of full history.",
      enabled: true,
      buttonLabel: "Address Latest",
      buttonIcon: "Wrench",
      buttonColor: "purple",
      actionType: "spawn_agent",
      conditions: {},
      promptTemplate: `Address review feedback on PR #{pr_number} ({pr_title}) based ONLY on the recentmost comment by @{last_comment_author}:\n\n"{last_comment_body}"\n\nFocus specifically and solely on addressing the issues and feedback raised in this most recent comment, without getting distracted by previous conversation history. Check the issues raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to address the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a clear comment to the PR explaining what you did and why.`,
    },
    passed: false,
    generatedPrompt: `Address review feedback on PR #${pr.number} (${pr.title}) based ONLY on the recentmost comment by @${pr.last_comment?.user.login || "reviewer"}:\n\n"${pr.last_comment?.body || "No recent comment"}"\n\nFocus specifically and solely on addressing the issues and feedback raised in this most recent comment, without getting distracted by previous conversation history. Check the issues raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to address the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a clear comment to the PR explaining what you did and why.`,
    targetAgent: "codex",
  };
  const hasPassedAddressLatest = passedGates.some(
    (g) => g.rule.id === "address-latest-comment",
  );

  const reviewWithContextGate = evaluatedGates.find(
    (g) => g.rule.id === "review-with-context",
  );
  const hasPassedReviewWithContext = passedGates.some(
    (g) => g.rule.id === "review-with-context",
  );

  const reviewLatestGate = evaluatedGates.find(
    (g) => g.rule.id === "review-latest-comment",
  ) || {
    rule: {
      id: "review-latest-comment",
      name: "Review Recent Comment",
      description:
        "Review PR considering only the author’s very recentmost comment/update instead of full history.",
      enabled: true,
      buttonLabel: "Review Latest",
      buttonIcon: "Eye",
      buttonColor: "emerald",
      actionType: "spawn_agent",
      conditions: {},
      promptTemplate: `Review PR #{pr_number} ({pr_title}) against branch {base_branch}, focusing specifically on the author’s recentmost response by @{last_comment_author}:\n\n"{last_comment_body}"\n\nWe’re the reviewer. Instead of re-evaluating the full historical comment backlog, focus specifically on this latest update and comment. Has the author addressed the specific points raised in this recentmost feedback? Are the claimed fixes in place in the code, or are they pushing back rightfully? Conduct a focused code review on this update and publish a "changes requested" or "approve" review comment on the PR with clear, constructive feedback.`,
    },
    passed: false,
    generatedPrompt: `Review PR #${pr.number} (${pr.title}) against branch ${pr.base.ref}, focusing specifically on the author’s recentmost response by @${pr.last_comment?.user.login || "author"}:\n\n"${pr.last_comment?.body || "No recent comment"}"\n\nWe’re the reviewer. Instead of re-evaluating the full historical comment backlog, focus specifically on this latest update and comment. Has the author addressed the specific points raised in this recentmost feedback? Are the claimed fixes in place in the code, or are they pushing back rightfully? Conduct a focused code review on this update and publish a "changes requested" or "approve" review comment on the PR with clear, constructive feedback.`,
    targetAgent: "codex",
  };
  const hasPassedReviewLatest = passedGates.some(
    (g) => g.rule.id === "review-latest-comment",
  );

  const hasComments = Boolean(
    (pr.comments && pr.comments.length > 0) || pr.last_comment,
  );
  const isOwner = currentUser
    ? pr.user.login.toLowerCase() === currentUser.toLowerCase()
    : evaluatedGates.some(
        (g) => g.rule.conditions?.prOwnedByCurrentUser && g.passed,
      );

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [isSpawningWorktree, setIsSpawningWorktree] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [copiedBranch, setCopiedBranch] = useState(false);

  const handleCopyBranch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(
        `git checkout ${pr.head.ref} && git pull`,
      );
      setCopiedBranch(true);
      setTimeout(() => setCopiedBranch(false), 2000);
    } catch (err) {
      console.error("Failed to copy branch checkout command", err);
    }
  };

  const handleOpenWorktree = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSpawningWorktree) return;
    setIsSpawningWorktree(true);
    setWorktreeError(null);
    try {
      if (onOpenWorktree) {
        await onOpenWorktree(prWithGates);
      } else {
        const preferredAgent = passedGates.find(
          (g) => g.targetAgent,
        )?.targetAgent;
        const res = await fetch("/api/worktree/spawn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoFullName: pr.repo_full_name,
            localPath: pr.local_path || "",
            branchName: pr.head.ref,
            agent: preferredAgent,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to spawn worktree");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Worktree error";
      setWorktreeError(msg);
    } finally {
      setIsSpawningWorktree(false);
    }
  };

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
        const res = await fetch("/api/prs/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoFullName: pr.repo_full_name,
            prNumber: pr.number,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to merge PR");
        }
      }
      setIsMergeModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setMergeError(msg);
    } finally {
      setIsMerging(false);
    }
  };

  const getGateButtonStyles = (color?: string) => {
    const tones: Record<string, string> = {
      purple: "gate-button gate-button--purple",
      rose: "gate-button gate-button--rose",
      emerald: "gate-button gate-button--emerald",
      amber: "gate-button gate-button--amber",
      indigo: "gate-button gate-button--indigo",
      blue: "gate-button gate-button--blue",
    };
    return tones[color || "blue"] || tones.blue;
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
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
      className={`card pr-detail ${isSelected ? "is-selected" : ""} ${isInProcess ? "agent-active" : ""}`}
    >
      <div className="pr-priority-row">
        <span
          className={
            needsAttention
              ? "status-badge status-badge--warning"
              : "status-badge status-badge--neutral"
          }
        >
          {pr.is_draft
            ? "Draft · not ready for review"
            : needsAttention
              ? "Needs your attention"
              : "Waiting on others"}
        </span>
        <a className="action-jump" href={"#" + elementId + "-action-bar"}>
          View actions ↓
        </a>
      </div>
      {/* Header Info */}
      <div className="pr-detail-header">
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

          <h2 className="pr-detail-title">
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
            {/* Draft Status */}
            {pr.is_draft && (
              <span className="text-xs flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-300 font-medium">
                <GitPullRequest className="w-3.5 h-3.5 text-gray-500" /> Draft
                PR
              </span>
            )}

            {/* Mergeability Status */}
            {!pr.has_merge_conflicts && pr.mergeable_state === "behind" ? (
              <span
                className="text-xs flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium"
                title={`Branch ${pr.head.ref} is behind ${pr.base.ref}`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Behind{" "}
                {pr.base.ref}
              </span>
            ) : !pr.has_merge_conflicts &&
              (pr.has_merge_conflicts === false ||
                pr.mergeable_state === "clean") ? (
              <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{" "}
                Mergeable
              </span>
            ) : null}

            {/* CI Status */}
            {pr.checks_status === "success" && (
              <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> CI
                Passed
              </span>
            )}
            {pr.checks_status === "failure" && (
              <span className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> CI Failing
              </span>
            )}
            {pr.checks_status === "pending" && (
              <span className="status-badge status-badge--warning">
                <Clock size={13} />
                Checks running
              </span>
            )}
            {(!pr.checks_status || pr.checks_status === "unknown") && (
              <span className="status-badge status-badge--neutral">
                Checks unavailable
              </span>
            )}

            <span className="text-xs text-gray-700 flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
              {pr.user.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pr.user.avatar_url}
                  alt={pr.user.login}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-gray-400" />
              )}
              @{pr.user.login}
            </span>

            {pr.created_at && (
              <span
                className="text-xs text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200"
                title={`Created ${new Date(pr.created_at).toLocaleString()}`}
              >
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatRelativeTime(pr.created_at)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Agent Working Callout Banner */}
      {isInProcess && (
        <div
          className="agent-working-banner"
          data-agent={activeAgentInfo?.agent || "codex"}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <span>Agent session active</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-900 font-mono font-semibold uppercase">
                  {activeAgentInfo?.agent || "codex"}
                </span>
              </h4>
              <p className="text-[11px] text-blue-700 font-medium leading-tight mt-0.5">
                CLI agent active on branch{" "}
                <span className="font-mono text-blue-950 font-bold">
                  {pr.head.ref}
                </span>{" "}
                in Antigravity IDE terminal.
              </p>
            </div>
          </div>
          {onClearActiveAgent && (
            <button
              onClick={() => onClearActiveAgent(cardId)}
              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-blue-700 hover:text-blue-900 border border-blue-200 text-[11px] font-semibold transition-all shadow-2xs shrink-0"
            >
              Mark done
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
              Merge Conflicts against{" "}
              <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-700 font-mono text-xs">
                {pr.base.ref}
              </code>
            </h4>
            <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">
              Branch{" "}
              <span className="font-mono text-rose-800 font-semibold">
                {pr.head.ref}
              </span>{" "}
              cannot be automatically merged into{" "}
              <span className="font-mono text-rose-800 font-semibold">
                {pr.base.ref}
              </span>
              . Rebase or merge to resolve conflicts before deploying agent
              workflows.
            </p>
          </div>
        </div>
      )}

      {/* PR Description + Comment Thread — unified continuous flow */}
      <div className="pr-discussion">
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
          <div className="comment-thread" id={`${elementId}-comment-thread`}>
            {pr.comments.map((comment) => {
              const rebaseStatus = checkRebaseStatus(comment, pr.commits);

              return (
                <div
                  key={`${comment.id}-${comment.review_state || (comment.is_review_comment ? "rev" : "iss")}`}
                  className={`discussion-comment space-y-3 ${comment === pr.comments[pr.comments.length - 1] ? "discussion-comment--latest" : ""}`}
                >
                  {comment === pr.comments[pr.comments.length - 1] && (
                    <span className="latest-comment-label">Latest update</span>
                  )}
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
                            comment.review_state === "CHANGES_REQUESTED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : comment.review_state === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                        >
                          <FileCode className="w-3 h-3" />
                          PR Review: {comment.review_state.replace(/_/g, " ")}
                        </span>
                      ) : comment.is_review_comment ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono border border-purple-200">
                          <FileCode className="w-3 h-3" />
                          Code Review{" "}
                          {comment.path
                            ? `: ${comment.path}${comment.line ? `#L${comment.line}` : ""}`
                            : ""}
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

                  {/* Rebase Status Indicator (if comment asks for rebase) */}
                  {rebaseStatus.asksForRebase && (
                    <div
                      className={`mt-3 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                        rebaseStatus.hasCommitsSince
                          ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                          : "bg-amber-50/90 border-amber-200 text-amber-900"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-2.5">
                        {rebaseStatus.hasCommitsSince ? (
                          <div className="p-1 rounded-md bg-emerald-100 text-emerald-600 shrink-0 mt-0.5 sm:mt-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1 rounded-md bg-amber-100 text-amber-600 shrink-0 mt-0.5 sm:mt-0">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold flex items-center gap-2 flex-wrap">
                            <span>
                              {rebaseStatus.hasCommitsSince
                                ? "Branch Rebased / Commits Made"
                                : "No Commits Made Since Request"}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                rebaseStatus.hasCommitsSince
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {rebaseStatus.hasCommitsSince
                                ? `${rebaseStatus.commitsSinceCount} commit${
                                    rebaseStatus.commitsSinceCount > 1
                                      ? "s"
                                      : ""
                                  } since comment`
                                : "0 commits since comment"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 leading-normal ${
                              rebaseStatus.hasCommitsSince
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {rebaseStatus.hasCommitsSince
                              ? `Commits were pushed to ${pr.head.ref} after this comment${
                                  rebaseStatus.latestCommitDate
                                    ? ` (latest ${formatRelativeTime(rebaseStatus.latestCommitDate)})`
                                    : ""
                                }.`
                              : `No new commits have been pushed to ${pr.head.ref} since this comment asked for a rebase.`}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] font-medium">
                        {rebaseStatus.hasCommitsSince ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold shadow-2xs">
                            <GitCommit className="w-3.5 h-3.5 text-emerald-600" />{" "}
                            Rebased
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-md border border-amber-200 font-semibold shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Not
                            Rebased
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Bar: Logic Gates Buttons */}
      <div id={`${elementId}-action-bar`} className="pr-actions">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
            #{pr.number}
          </span>
          <div
            className="inline-flex items-center text-xs text-gray-600 font-mono bg-gray-50 pl-2 pr-1 py-0.5 rounded-md border border-gray-200 gap-1.5"
            title={`${pr.head.ref} → ${pr.base.ref}`}
          >
            <GitBranch className="w-3 h-3 text-gray-400" />
            <span className="branch-name">{pr.head.ref}</span>
            <button
              type="button"
              onClick={handleCopyBranch}
              className="ui-button ui-button--quiet branch-copy-button"
              title={
                copiedBranch
                  ? "Checkout command copied!"
                  : `Copy "git checkout ${pr.head.ref} && git pull"`
              }
              aria-label={`Copy git checkout ${pr.head.ref} && git pull`}
            >
              {copiedBranch ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          {pr.has_merge_conflicts && (
            <span
              className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-semibold"
              title={`Merge conflicts detected on branch ${pr.head.ref} against ${pr.base.ref}`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Conflicts
              with {pr.base.ref}
            </span>
          )}
        </div>

        <div className="pr-action-buttons">
          <span className="action-group-label">Review & act</span>
          <button
            onClick={handleOpenWorktree}
            disabled={isSpawningWorktree}
            className="ui-button ui-button--secondary"
            title={`Open Git worktree for branch ${pr.head.ref} in Antigravity IDE terminal`}
          >
            {isSpawningWorktree ? (
              <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
            ) : (
              <FolderPlus className="w-3.5 h-3.5 text-sky-600" />
            )}
            <span>
              {isSpawningWorktree ? "Opening Worktree..." : "Worktree"}
            </span>
          </button>

          {passedGates.map((gate) => (
            <button
              key={gate.rule.id}
              onClick={() => onTriggerGate(prWithGates, gate)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${getGateButtonStyles(
                gate.rule.buttonColor,
              )}`}
            >
              <GateIcon name={gate.rule.buttonIcon} />
              <span>{gate.rule.buttonLabel}</span>
              {(gate.rule.actionType === "spawn_agent" ||
                !gate.rule.actionType) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                  {gate.targetAgent}
                </span>
              )}
            </button>
          ))}

          {!hasPassedAddressIssues &&
            addressIssuesGate &&
            addressIssuesGate.rule.enabled !== false &&
            !pr.is_draft && (
              <button
                onClick={() => onTriggerGate(prWithGates, addressIssuesGate)}
                className="gate-button gate-button--purple"
                title="Address review issues with AI agent (considering complete history)"
              >
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {addressIssuesGate.rule.buttonLabel || "Address Issues"}
                </span>
                {(addressIssuesGate.rule.actionType === "spawn_agent" ||
                  !addressIssuesGate.rule.actionType) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                    {addressIssuesGate.targetAgent}
                  </span>
                )}
              </button>
            )}

          {!hasPassedAddressLatest &&
            addressLatestGate &&
            addressLatestGate.rule.enabled !== false &&
            !pr.is_draft &&
            hasComments && (
              <button
                onClick={() => onTriggerGate(prWithGates, addressLatestGate)}
                className="gate-button gate-button--purple"
                title="Address only the very recentmost comment with AI agent"
              >
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {addressLatestGate.rule.buttonLabel || "Address Latest"}
                </span>
                {(addressLatestGate.rule.actionType === "spawn_agent" ||
                  !addressLatestGate.rule.actionType) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                    {addressLatestGate.targetAgent}
                  </span>
                )}
              </button>
            )}

          {!hasPassedReviewWithContext &&
            reviewWithContextGate &&
            reviewWithContextGate.rule.enabled !== false &&
            !pr.is_draft &&
            !isOwner &&
            hasComments && (
              <button
                onClick={() =>
                  onTriggerGate(prWithGates, reviewWithContextGate)
                }
                className="gate-button gate-button--emerald"
                title="Review PR with AI agent (considering complete history)"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {reviewWithContextGate.rule.buttonLabel ||
                    "Review with context"}
                </span>
                {(reviewWithContextGate.rule.actionType === "spawn_agent" ||
                  !reviewWithContextGate.rule.actionType) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                    {reviewWithContextGate.targetAgent}
                  </span>
                )}
              </button>
            )}

          {!hasPassedReviewLatest &&
            reviewLatestGate &&
            reviewLatestGate.rule.enabled !== false &&
            !pr.is_draft &&
            !isOwner &&
            hasComments && (
              <button
                onClick={() => onTriggerGate(prWithGates, reviewLatestGate)}
                className="gate-button gate-button--emerald"
                title="Review PR considering only the author's very recentmost comment/update"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {reviewLatestGate.rule.buttonLabel || "Review Latest"}
                </span>
                {(reviewLatestGate.rule.actionType === "spawn_agent" ||
                  !reviewLatestGate.rule.actionType) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/8 text-gray-600 font-mono">
                    {reviewLatestGate.targetAgent}
                  </span>
                )}
              </button>
            )}

          {!pr.is_draft && !pr.has_merge_conflicts && (
            <button
              onClick={handleOpenMergeModal}
              disabled={isMerging}
              className="ui-button ui-button--success"
              title={`Merge PR #${pr.number} into ${pr.base.ref}`}
            >
              {isMerging ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              ) : (
                <GitMerge className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isMerging ? "Merging..." : "Merge"}</span>
            </button>
          )}

          {worktreeError && (
            <span
              className="text-xs text-rose-600 font-medium"
              title={worktreeError}
            >
              {worktreeError}
            </span>
          )}

          {mergeError && (
            <span
              className="text-xs text-rose-600 font-medium"
              title={mergeError}
            >
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
