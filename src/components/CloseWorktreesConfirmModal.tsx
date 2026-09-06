"use client";

import { FolderX } from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

interface CloseWorktreesConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isClosing: boolean;
  error?: string | null;
}

export function CloseWorktreesConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isClosing,
  error,
}: CloseWorktreesConfirmModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Remove all worktrees?"
      description="Applies across all configured local repository paths."
      icon={<FolderX />}
      tone="danger"
      size="small"
      busy={isClosing}
      footer={
        <>
          <Button onClick={onClose} disabled={isClosing}>
            Keep worktrees
          </Button>
          <Button variant="danger" busy={isClosing} onClick={onConfirm}>
            {!isClosing && <FolderX size={16} />}
            {isClosing ? "Removing worktrees…" : "Remove all worktrees"}
          </Button>
        </>
      }
    >
      <Notice tone="danger" title="Uncommitted work can be lost">
        This force-removes linked worktree folders, including their uncommitted
        files. Make sure work you need has been committed or backed up.
      </Notice>
      <div className="confirmation-facts">
        <p>
          <strong>Removed</strong>
          <span>
            All linked worktrees in configured repositories, including
            environment-configured paths.
          </span>
        </p>
        <p>
          <strong>Kept</strong>
          <span>Main repository folders and their Git branches.</span>
        </p>
      </div>
      {error && (
        <Notice tone="danger" title="Could not remove worktrees">
          {error}
        </Notice>
      )}
    </Dialog>
  );
}
