"use client";

import { ListRestart } from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

interface ClearAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activeCount: number;
}

export function ClearAgentsModal({
  isOpen,
  onClose,
  onConfirm,
  activeCount,
}: ClearAgentsModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Clear tracked agent sessions?"
      description={`${activeCount} active session${activeCount === 1 ? "" : "s"} in this workspace`}
      icon={<ListRestart />}
      tone="warning"
      size="small"
      footer={
        <>
          <Button onClick={onClose}>Keep tracking</Button>
          <Button
            variant="primary"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <ListRestart size={16} />
            Clear {activeCount} session{activeCount === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <p className="confirmation-title">
        Reset the working indicators in your review queue.
      </p>
      <Notice title="Running agents will continue">
        This only clears Workflow’s tracking state. It does not stop agents or
        close terminals and worktrees.
      </Notice>
    </Dialog>
  );
}
