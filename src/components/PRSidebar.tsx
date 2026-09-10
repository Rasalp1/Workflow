import React from "react";
import { isPrAwaitingComment } from "@/lib/logicGates";
import { ActiveAgentInfo, PRWithGates } from "@/types";
import { GitPullRequest, FolderGit2, HardDrive, RefreshCw } from "lucide-react";

interface PRSidebarProps {
  prsWithGates: PRWithGates[];
  currentUser?: string | null;
  activeCol1PRId?: string | null;
  activeCol2PRId?: string | null;
  activePRId?: string | null;
  activeAgentPRs?: Record<string, ActiveAgentInfo>;
  onSelectPR: (prId: string, position?: "top" | "bottom") => void;
}

export const PRSidebar: React.FC<PRSidebarProps> = ({
  prsWithGates,
  currentUser,
  activeCol1PRId,
  activeCol2PRId,
  activePRId,
  activeAgentPRs = {},
  onSelectPR,
}) => {
  const repos = [...new Set(prsWithGates.map(({ pr }) => pr.repo_full_name))];
  return (
    <aside className="review-sidebar" aria-label="Pull request navigation">
      <div className="sidebar-heading">
        <span>Review queue</span>
        <span>{prsWithGates.length}</span>
      </div>
      <div className="sidebar-scroll">
        {repos.map((repo) => (
          <section className="sidebar-repo" key={repo}>
            <h2 title={repo}>
              <FolderGit2 size={14} />
              <span>{repo.split("/").pop()}</span>
              <small>
                {
                  prsWithGates.filter(({ pr }) => pr.repo_full_name === repo)
                    .length
                }
              </small>
            </h2>
            {prsWithGates
              .filter(({ pr }) => pr.repo_full_name === repo)
              .map(({ pr, evaluatedGates }) => {
                const cardId = `pr-card-${pr.repo_full_name}-${pr.number}`;
                const selected = [
                  activeCol1PRId,
                  activeCol2PRId,
                  activePRId,
                ].includes(cardId);
                const agent = activeAgentPRs[cardId];
                const needsAttention = isPrAwaitingComment(
                  pr,
                  currentUser || null,
                );
                const status = pr.has_merge_conflicts
                  ? "Conflicts"
                  : pr.checks_status === "success"
                    ? "Checks passed"
                    : pr.checks_status === "failure"
                      ? "Checks failing"
                      : pr.checks_status === "pending"
                        ? "Checks pending"
                        : "No checks";
                const statusClass =
                  pr.has_merge_conflicts || pr.checks_status === "failure"
                    ? "rose"
                    : pr.checks_status === "success"
                      ? "green"
                      : pr.checks_status === "pending"
                        ? "amber"
                        : "";
                return (
                  <button
                    key={cardId}
                    data-column={
                      activeCol1PRId === cardId
                        ? "primary"
                        : activeCol2PRId === cardId
                          ? "secondary"
                          : undefined
                    }
                    className={`sidebar-pr ${selected ? "is-selected" : ""}`}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelectPR(cardId, "top")}
                  >
                    <div className="sidebar-pr-meta">
                      <GitPullRequest size={14} />
                      <span className="sidebar-pr-number">#{pr.number}</span>
                      {pr.is_draft && (
                        <span className="sidebar-draft">Draft</span>
                      )}
                      {agent && (
                        <span
                          className="sidebar-agent"
                          data-agent={agent.agent}
                        >
                          <RefreshCw size={11} className="animate-spin" />
                          {agent.agent}
                        </span>
                      )}
                    </div>
                    {needsAttention && (
                      <span className="sidebar-attention">
                        Needs your attention
                      </span>
                    )}
                    <span className="sidebar-pr-title">{pr.title}</span>
                    <span className="sidebar-pr-author">
                      {pr.user.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pr.user.avatar_url}
                          alt=""
                          className="sidebar-pr-author-avatar"
                        />
                      ) : (
                        <span className="sidebar-pr-author-fallback" aria-hidden="true" />
                      )}
                      <span>by @{pr.user.login}</span>
                    </span>
                    <div
                      className={
                        "sidebar-pr-status sidebar-pr-status--" + statusClass
                      }
                    >
                      <span className={`status-dot ${statusClass}`} />
                      {status}
                      {evaluatedGates.some((gate) => gate.passed) && (
                        <span className="sidebar-ready">Action ready</span>
                      )}
                    </div>
                  </button>
                );
              })}
          </section>
        ))}
        {repos.length === 0 && (
          <p className="queue-empty">Your pull requests will appear here.</p>
        )}
      </div>
      <div className="sidebar-footer">
        <HardDrive size={16} />
        <div>
          <strong>Local workspace</strong>
          <span>{repos.length} repositories in this view</span>
        </div>
      </div>
    </aside>
  );
};
