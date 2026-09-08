import React, { useEffect, useRef, useState } from "react";
import { ActiveAgentInfo, AgentType } from "@/types";
import {
  GitPullRequest,
  RefreshCw,
  SlidersHorizontal,
  Settings2,
  FolderX,
  Search,
  X,
  ArrowUpRight,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ClearAgentsModal } from "@/components/ClearAgentsModal";
import { WorkflowIcon } from "@/components/ui/WorkflowIcon";

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCloseWorktreesModal?: () => void;
  defaultAgent?: AgentType;
  onChangeAgent?: (agent: AgentType) => void;
  currentUser: string | null;
  directAgentSpawn?: boolean;
  prCount: number;
  awaitingCommentCount: number;
  awaitingCommentItems: {
    repoName: string;
    prs: {
      number: number;
      title: string;
      cardId: string;
      branchName?: string;
      hasMergeConflicts?: boolean;
    }[];
  }[];
  theirsToHandleCount: number;
  theirsToHandleItems?: {
    repoName: string;
    prs: {
      number: number;
      title: string;
      cardId: string;
      branchName?: string;
      hasMergeConflicts?: boolean;
    }[];
  }[];
  activeAgentPRs?: Record<string, ActiveAgentInfo>;
  onClearActiveAgent?: (cardId: string) => void;
  onClearAllActiveAgents?: () => void;
  onSelectPR: (cardId: string, position?: "top" | "bottom") => void;
  col1Repo?: string;
  col2Repo?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const WorkspaceBrand = () => (
  <div className="brand-lockup">
    <span className="brand-icon">
      <WorkflowIcon size={24} strokeWidth={1.5} />
    </span>
    <div>
      <div className="brand-name">Workflow</div>
      <p>Your review workspace</p>
    </div>
  </div>
);

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isLoading,
  onOpenSettings,
  onOpenRules,
  onOpenCloseWorktreesModal,
  currentUser,
  directAgentSpawn = false,
  prCount,
  awaitingCommentCount,
  awaitingCommentItems,
  theirsToHandleCount,
  theirsToHandleItems = [],
  activeAgentPRs = {},
  onClearAllActiveAgents,
  onSelectPR,
  searchQuery = "",
  onSearchChange,
}) => {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [openQueue, setOpenQueue] = useState<"yours" | "theirs" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const activeAgentCount = Object.keys(activeAgentPRs).length;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setOpenQueue(null);
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !queueRef.current?.contains(event.target)
      )
        setOpenQueue(null);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  return (
    <header className="workspace-header">
      <div className="workspace-toolbar">
        <h1 className="workspace-title">
          Pull requests <span>{prCount}</span>
        </h1>
        <div className="workspace-search">
          <Search size={16} />
          <input
            ref={searchRef}
            aria-label="Search pull requests"
            placeholder="Search title, repository, branch…"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
          {searchQuery ? (
            <button
              aria-label="Clear search"
              onClick={() => onSearchChange?.("")}
            >
              <X size={14} />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </div>
        {directAgentSpawn && (
          <button className="direct-launch-note" onClick={onOpenSettings}>
            Direct launch is on
          </button>
        )}
        <div
          className={
            activeAgentCount
              ? "agent-summary agent-summary--active"
              : "agent-summary"
          }
        >
          <Cpu size={14} />
          <span>
            {activeAgentCount
              ? `${activeAgentCount} active session${activeAgentCount === 1 ? "" : "s"}`
              : "No active agents"}
          </span>
          {activeAgentCount > 0 && onClearAllActiveAgents && (
            <button
              title="Clear all agent sessions"
              aria-label="Clear all agent sessions"
              onClick={() => setIsClearModalOpen(true)}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <Button size="small" onClick={onOpenRules}>
            <SlidersHorizontal size={15} />
            <span>Logic gates</span>
          </Button>
          <Button size="small" onClick={onOpenSettings}>
            <Settings2 size={15} />
            <span>Settings</span>
          </Button>
          {onOpenCloseWorktreesModal && (
            <Button
              size="small"
              variant="danger-quiet"
              onClick={onOpenCloseWorktreesModal}
              title="Remove linked worktrees"
              aria-label="Remove all worktrees"
            >
              <FolderX size={16} />
              <span>Worktrees</span>
            </Button>
          )}
          <span className="toolbar-divider" />
          <Button
            size="small"
            variant="primary"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>{isLoading ? "Refreshing" : "Refresh"}</span>
          </Button>
          {currentUser && (
            <span
              className="user-avatar"
              title={`Signed in as @${currentUser}`}
              aria-label={`Signed in as @${currentUser}`}
            >
              {currentUser.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <div className="workspace-summary" ref={queueRef}>
        <div className="summary-queues">
          <button
            className={`summary-item ${openQueue === "theirs" ? "is-open" : ""}`}
            aria-expanded={openQueue === "theirs"}
            aria-controls="review-queue-popover"
            onClick={() =>
              setOpenQueue(openQueue === "theirs" ? null : "theirs")
            }
          >
            <span className="status-dot" />
            Waiting on others <strong>{theirsToHandleCount}</strong>
          </button>
          <button
            className={`summary-item summary-item--attention ${openQueue === "yours" ? "is-open" : ""}`}
            aria-expanded={openQueue === "yours"}
            aria-controls="review-queue-popover"
            onClick={() => setOpenQueue(openQueue === "yours" ? null : "yours")}
          >
            <span className="status-dot amber" />
            Needs your attention <strong>{awaitingCommentCount}</strong>
          </button>
        </div>
        {openQueue && (
          <div className="queue-popover" id="review-queue-popover">
            <div className="queue-popover-heading">
              <strong>
                {openQueue === "yours"
                  ? "Needs your attention"
                  : "Waiting on others"}
              </strong>
              <button
                className="ui-button ui-button--quiet icon-button"
                aria-label="Close review queue"
                onClick={() => setOpenQueue(null)}
              >
                <X size={15} />
              </button>
            </div>
            {(openQueue === "yours"
              ? awaitingCommentItems
              : theirsToHandleItems
            ).length === 0 ? (
              <p className="queue-empty">Nothing here. You’re all caught up.</p>
            ) : (
              (openQueue === "yours"
                ? awaitingCommentItems
                : theirsToHandleItems
              ).map(({ repoName, prs }) => (
                <div key={repoName}>
                  <p className="queue-repo">{repoName}</p>
                  {prs.map((pr) => (
                    <button
                      key={pr.cardId}
                      className="queue-link"
                      onClick={() => {
                        onSelectPR(pr.cardId, "bottom");
                        setOpenQueue(null);
                      }}
                    >
                      <GitPullRequest size={13} />
                      <strong className="queue-pr-number">#{pr.number}</strong>
                      <span className="queue-branch" title={pr.branchName}>
                        {pr.branchName ?? pr.title}
                      </span>
                      {activeAgentPRs[pr.cardId] && (
                        <span
                          className="queue-agent"
                          data-agent={activeAgentPRs[pr.cardId].agent}
                          title={`${activeAgentPRs[pr.cardId].agent} is working on this pull request`}
                        >
                          <RefreshCw size={10} className="animate-spin" />
                          {activeAgentPRs[pr.cardId].agent}
                        </span>
                      )}
                      {pr.hasMergeConflicts && (
                        <span className="queue-conflict">Conflict</span>
                      )}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <ClearAgentsModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={() => {
          onClearAllActiveAgents?.();
          setIsClearModalOpen(false);
        }}
        activeCount={activeAgentCount}
      />
    </header>
  );
};
