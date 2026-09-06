"use client";

import { ArrowDown, GitBranch, GitMerge } from "lucide-react";
import type { PullRequest } from "@/types";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

interface MergeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  pr: PullRequest | null;
  onConfirm: () => Promise<void>;
  isMerging: boolean;
  error?: string | null;
}

export function MergeConfirmModal({
  isOpen,
  onClose,
  pr,
  onConfirm,
  isMerging,
  error,
}: MergeConfirmModalProps) {
  if (!isOpen || !pr) return null;
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Merge pull request #${pr.number}?`}
      description={pr.repo_full_name}
      icon={<GitMerge />}
      tone="success"
      size="small"
      busy={isMerging}
      footer={
        <>
          <Button onClick={onClose} disabled={isMerging}>
            Cancel
          </Button>
          <Button variant="success" busy={isMerging} onClick={onConfirm}>
            {!isMerging && <GitMerge size={16} />}
            {isMerging ? "Merging…" : "Confirm merge"}
          </Button>
        </>
      }
    >
      <h3 className="confirmation-title">{pr.title}</h3>
      <div className="merge-route">
        <span className="field-label">From branch</span>
        <code>
          <GitBranch size={15} />
          {pr.head.ref}
        </code>
        <ArrowDown size={18} />
        <span className="field-label">Into base branch</span>
        <code className="merge-target">
          <GitMerge size={15} />
          {pr.base.ref}
        </code>
      </div>
      <Notice
        tone={
          pr.checks_status === "failure" || pr.checks_status === "pending"
            ? "warning"
            : "info"
        }
        title={
          pr.checks_status === "failure"
            ? "Checks are failing"
            : pr.checks_status === "pending"
              ? "Checks are still running"
              : "This changes the base branch"
        }
      >
        Confirming merges this pull request on GitHub. Review the target branch
        before continuing.
      </Notice>
      {error && (
        <Notice tone="danger" title="Merge failed">
          {error}
        </Notice>
      )}
    </Dialog>
  );
}
