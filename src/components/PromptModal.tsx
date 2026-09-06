"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Folder,
  GitPullRequest,
  MessageSquare,
  Play,
  Terminal,
} from "lucide-react";
import type { AgentType, EvaluatedGateResult, PRWithGates } from "@/types";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { AgentPicker } from "./ui/AgentPicker";
import { Notice } from "./ui/Notice";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prWithGates: PRWithGates | null;
  gateResult: EvaluatedGateResult | null;
  onConfirmSpawn: (payload: {
    repoFullName: string;
    localPath: string;
    branchName?: string;
    agent: AgentType;
    prompt: string;
    cardId?: string;
  }) => Promise<void>;
  onStartActiveAgent?: (cardId: string, agent?: AgentType) => void;
}

export function PromptModal({
  isOpen,
  prWithGates,
  gateResult,
  ...props
}: PromptModalProps) {
  if (!isOpen || !prWithGates || !gateResult) return null;
  return (
    <PromptForm
      key={`${prWithGates.pr.id}-${gateResult.rule.id}`}
      prWithGates={prWithGates}
      gateResult={gateResult}
      {...props}
    />
  );
}

function PromptForm({
  prWithGates,
  gateResult,
  onClose,
  onConfirmSpawn,
  onStartActiveAgent,
}: Omit<PromptModalProps, "isOpen" | "prWithGates" | "gateResult"> & {
  prWithGates: PRWithGates;
  gateResult: EvaluatedGateResult;
}) {
  const { pr } = prWithGates;
  const [prompt, setPrompt] = useState(gateResult.generatedPrompt);
  const [agent, setAgent] = useState<AgentType>(
    gateResult.targetAgent || "codex",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isComment = gateResult.rule.actionType === "post_comment";
  const isUndraft = gateResult.rule.actionType === "undraft_pr";
  const isAgent = !isComment && !isUndraft;
  const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;

  async function copy(track = false) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (track && isAgent) {
        onStartActiveAgent?.(cardId, agent);
        onClose();
      }
    } catch {
      setError(
        "Could not copy to the clipboard. Select and copy the text manually.",
      );
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isAgent) {
        await onConfirmSpawn({
          repoFullName: pr.repo_full_name,
          localPath: pr.local_path || "",
          branchName: pr.head.ref,
          agent,
          prompt,
          cardId,
        });
      } else {
        const response = await fetch(
          isUndraft ? "/api/prs/undraft" : "/api/prs/comment",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repoFullName: pr.repo_full_name,
              prNumber: pr.number,
              ...(isComment ? { commentBody: prompt } : {}),
            }),
          },
        );
        const data = await response.json();
        if (!response.ok || data.error)
          throw new Error(data.error || "The action could not be completed.");
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The action failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title = isUndraft
    ? "Mark ready for review"
    : isComment
      ? "Post a GitHub comment"
      : "Launch an agent";
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={title}
      description={`${pr.repo_full_name} · #${pr.number}`}
      icon={
        isUndraft ? (
          <GitPullRequest />
        ) : isComment ? (
          <MessageSquare />
        ) : (
          <Terminal />
        )
      }
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {isAgent && onStartActiveAgent && (
            <Button
              onClick={() => copy(true)}
              disabled={busy || !prompt.trim()}
              title="Copy the prompt and track a session you launch manually"
            >
              <Copy size={16} />
              Copy & track agent
            </Button>
          )}
          <Button
            variant="primary"
            busy={busy}
            disabled={
              (isAgent && !pr.local_path) || (!isUndraft && !prompt.trim())
            }
            onClick={submit}
          >
            {!busy &&
              (isAgent ? (
                <Play size={16} />
              ) : isComment ? (
                <MessageSquare size={16} />
              ) : (
                <GitPullRequest size={16} />
              ))}
            {busy
              ? "Working…"
              : isUndraft
                ? "Mark ready for review"
                : isComment
                  ? "Post comment"
                  : `Launch ${agent === "claude" ? "Claude Code" : "Codex"}`}
          </Button>
        </>
      }
    >
      <div className="action-context">
        <span className="status-badge status-badge--accent">
          {gateResult.rule.buttonLabel}
        </span>
        <h3>{pr.title}</h3>
        <code>{pr.head.ref}</code>
      </div>
      {error && (
        <Notice tone="danger" title="Action not completed">
          {error}
        </Notice>
      )}
      {isAgent && (
        <>
          <AgentPicker value={agent} onChange={setAgent} disabled={busy} />
          {pr.local_path ? (
            <div className="execution-target">
              <Folder size={17} />
              <div>
                <span className="field-label">Launch directory</span>
                <code>{pr.local_path}</code>
              </div>
            </div>
          ) : (
            <Notice
              tone="warning"
              title="Add a local repository path to launch"
            >
              Set the path in Workspace settings. You can still copy this prompt
              to run it manually.
            </Notice>
          )}
        </>
      )}
      {isUndraft ? (
        <Notice title="Make this pull request available for review">
          The pull request will move from draft to open on GitHub. Its commits
          and discussion are kept.
        </Notice>
      ) : (
        <div className="field-group">
          <div className="field-heading">
            <label htmlFor="action-prompt" className="field-label">
              {isComment ? "Comment to publish" : "Review and edit the prompt"}
            </label>
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => copy()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <textarea
            id="action-prompt"
            className="ui-input prompt-editor"
            rows={10}
            value={prompt}
            disabled={busy}
            onChange={(event) => {
              setPrompt(event.target.value);
              setCopied(false);
            }}
          />
          <p className="field-help">
            {isComment
              ? "This text will be posted to the pull request’s discussion under your GitHub account when you confirm."
              : "Launch opens the selected agent in your IDE terminal. Copy & track is for an agent you start manually."}
          </p>
        </div>
      )}
    </Dialog>
  );
}
