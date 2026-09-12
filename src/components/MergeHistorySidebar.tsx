'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Columns2,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequestClosed,
  History,
  RefreshCw,
} from 'lucide-react';
import { HistoryBranch, HistoryColumn, MergeHistoryEntry } from '@/types';

interface MergeHistorySidebarProps {
  monitoredRepos: string[];
  refreshKey?: number;
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export const MergeHistorySidebar: React.FC<MergeHistorySidebarProps> = ({
  monitoredRepos,
  refreshKey = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mergedEntries, setMergedEntries] = useState<MergeHistoryEntry[]>([]);
  const [closedEntries, setClosedEntries] = useState<MergeHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const [targetBranch, setTargetBranch] = useState<HistoryBranch>('main');
  const [selectedColumn, setSelectedColumn] = useState<HistoryColumn>('merged');
  const monitoredRepoKey = monitoredRepos.join(',');

  const repoLabel = useMemo(() => {
    if (monitoredRepos.length === 1) return monitoredRepos[0];
    return `${monitoredRepos.length} repositories`;
  }, [monitoredRepos]);

  useEffect(() => {
    if (!isOpen || monitoredRepoKey.length === 0) return;

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/prs/history?${refreshKey || manualRefreshKey ? 'force=true' : ''}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Could not load PR history');
        setMergedEntries(Array.isArray(data.mergeHistory) ? data.mergeHistory : []);
        setClosedEntries(Array.isArray(data.closedHistory) ? data.closedHistory : []);
        setError(data.warning || null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load PR history');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, manualRefreshKey, monitoredRepoKey, refreshKey]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const toggleDrawer = () => {
    if (!isOpen) {
      setIsLoading(monitoredRepos.length > 0);
      setError(null);
    }
    setIsOpen((open) => !open);
  };

  const filteredMerged = useMemo(() => {
    return mergedEntries.filter((entry) => entry.base_branch === targetBranch);
  }, [mergedEntries, targetBranch]);

  const filteredClosed = useMemo(() => {
    return closedEntries;
  }, [closedEntries]);

  const renderEntry = (entry: MergeHistoryEntry, type: 'merged' | 'closed') => {
    const isMerged = type === 'merged';
    const timestamp = isMerged ? entry.merged_at : (entry.closed_at || entry.merged_at);

    return (
      <li key={`${entry.repo_full_name}-${entry.id}-${type}`} className="merge-history-entry">
        <span
          className={`merge-history-marker ${isMerged ? 'is-merged' : 'is-closed'}`}
          aria-hidden="true"
        >
          {isMerged ? <GitMerge size={12} /> : <GitPullRequestClosed size={12} />}
        </span>
        <div className="merge-history-entry-body">
          <div className="merge-history-entry-meta">
            <span className="merge-history-entry-repo" title={entry.repo_full_name}>
              {entry.repo_full_name}
            </span>
            <div className="merge-history-entry-tags">
              <span className={`merge-history-branch-tag ${entry.base_branch === 'staging' ? 'is-staging' : 'is-main'}`}>
                {entry.base_branch}
              </span>
              {timestamp && (
                <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>
                  {formatTimestamp(timestamp)}
                </time>
              )}
            </div>
          </div>
          <a href={entry.html_url} target="_blank" rel="noreferrer" className="merge-history-entry-link">
            <span>#{entry.number}</span>
            <strong>{entry.title}</strong>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
          <div className="merge-history-entry-footer">
            <div className="merge-history-entry-people">
              <a
                href={entry.user?.html_url || undefined}
                target={entry.user?.html_url ? '_blank' : undefined}
                rel={entry.user?.html_url ? 'noreferrer' : undefined}
                className="merge-history-person-badge is-creator"
                title={entry.user?.login ? `Created by @${entry.user.login}` : undefined}
              >
                {entry.user?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={entry.user.avatar_url} alt="" className="merge-history-entry-author-avatar" />
                ) : (
                  <span className="merge-history-entry-author-fallback" aria-hidden="true" />
                )}
                <span>created by @{entry.user?.login || 'unknown'}</span>
              </a>

              {isMerged && (
                <a
                  href={entry.merged_by?.html_url || entry.user?.html_url || undefined}
                  target={(entry.merged_by?.html_url || entry.user?.html_url) ? '_blank' : undefined}
                  rel={(entry.merged_by?.html_url || entry.user?.html_url) ? 'noreferrer' : undefined}
                  className="merge-history-person-badge is-merger"
                  title={`Merged by @${entry.merged_by?.login || entry.user?.login || 'unknown'}`}
                >
                  {entry.merged_by?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={entry.merged_by.avatar_url} alt="" className="merge-history-entry-author-avatar" />
                  ) : (
                    <span className="merge-history-merger-icon" aria-hidden="true">
                      <GitMerge size={9} />
                    </span>
                  )}
                  <span>merged by @{entry.merged_by?.login || entry.user?.login || 'unknown'}</span>
                </a>
              )}

              {!isMerged && (entry.closed_by || entry.user) && (
                <a
                  href={entry.closed_by?.html_url || entry.user?.html_url || undefined}
                  target={(entry.closed_by?.html_url || entry.user?.html_url) ? '_blank' : undefined}
                  rel={(entry.closed_by?.html_url || entry.user?.html_url) ? 'noreferrer' : undefined}
                  className="merge-history-person-badge is-closer"
                  title={`Closed by @${entry.closed_by?.login || entry.user?.login || 'unknown'}`}
                >
                  {entry.closed_by?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={entry.closed_by.avatar_url} alt="" className="merge-history-entry-author-avatar" />
                  ) : (
                    <span className="merge-history-closer-icon" aria-hidden="true">
                      <GitPullRequestClosed size={9} />
                    </span>
                  )}
                  <span>closed by @{entry.closed_by?.login || entry.user?.login || 'unknown'}</span>
                </a>
              )}
            </div>
            {!isMerged && (
              <span className="merge-history-status-tag">Closed</span>
            )}
          </div>
        </div>
      </li>
    );
  };

  const renderEmptyState = (type: 'merged' | 'closed') => {
    if (type === 'merged') {
      return (
        <div className="merge-history-state">
          <GitMerge size={20} aria-hidden="true" />
          <p>No PRs merged into <code>{targetBranch}</code> yet.</p>
          <span>{monitoredRepos.length === 0 ? 'Add a repository to start tracking.' : `Watching ${repoLabel}.`}</span>
        </div>
      );
    }
    return (
      <div className="merge-history-state">
        <GitPullRequestClosed size={20} aria-hidden="true" />
        <p>No closed PRs found.</p>
        <span>{monitoredRepos.length === 0 ? 'Add a repository to start tracking.' : `Watching ${repoLabel}.`}</span>
      </div>
    );
  };

  const isSplit = selectedColumn === 'split';

  return (
    <aside
      className={`merge-history-drawer ${isOpen ? 'is-open' : ''} ${isSplit ? 'is-split' : ''}`}
      aria-label="Merge history"
    >
      <button
        type="button"
        className="merge-history-tab"
        aria-expanded={isOpen}
        aria-controls="merge-history-panel"
        onClick={toggleDrawer}
      >
        <History size={15} aria-hidden="true" />
        <span>Merge history</span>
        <ChevronLeft size={14} aria-hidden="true" />
      </button>

      <div
        className={`merge-history-panel ${isSplit ? 'is-split' : ''}`}
        id="merge-history-panel"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Panel Heading */}
        <div className="merge-history-heading">
          <div>
            <span className="merge-history-eyebrow">Delivery log</span>
            <h2>
              {selectedColumn === 'closed'
                ? 'Closed PRs'
                : isSplit
                ? 'Merge & Closed PRs'
                : 'Merge history'}
            </h2>
            <p>
              {selectedColumn === 'closed' ? (
                <>All closed pull requests</>
              ) : isSplit ? (
                <>Pull requests targeting <code>{targetBranch}</code></>
              ) : (
                <>Pull requests landed in <code>{targetBranch}</code></>
              )}
            </p>
          </div>
          <button
            type="button"
            className="merge-history-close"
            aria-label="Close merge history"
            onClick={() => setIsOpen(false)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Interactive Controls: Target Branch Selection & Column Selector */}
        <div className="merge-history-controls">
          <div className="merge-history-control-row">
            {selectedColumn !== 'closed' && (
            <div className="merge-history-control-item">
              <span className="merge-history-control-label">
                <GitBranch size={12} aria-hidden="true" />
                <span>Target:</span>
              </span>
              <div className="merge-history-pill-group" role="group" aria-label="Select target branch">
                <button
                  type="button"
                  className={`merge-history-pill ${targetBranch === 'main' ? 'is-active' : ''}`}
                  onClick={() => setTargetBranch('main')}
                  aria-pressed={targetBranch === 'main'}
                >
                  main
                </button>
                <button
                  type="button"
                  className={`merge-history-pill ${targetBranch === 'staging' ? 'is-active' : ''}`}
                  onClick={() => setTargetBranch('staging')}
                  aria-pressed={targetBranch === 'staging'}
                >
                  staging
                </button>
              </div>
            </div>
            )}

            <div className="merge-history-control-item">
              <span className="merge-history-control-label">
                <Columns2 size={12} aria-hidden="true" />
                <span>Column:</span>
              </span>
              <div className="merge-history-tab-group" role="tablist" aria-label="Select history column">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedColumn === 'merged'}
                  className={`merge-history-col-tab ${selectedColumn === 'merged' ? 'is-active' : ''}`}
                  onClick={() => setSelectedColumn('merged')}
                >
                  <GitMerge size={12} aria-hidden="true" />
                  <span>Merged</span>
                  <span className="merge-history-badge">{filteredMerged.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedColumn === 'closed'}
                  className={`merge-history-col-tab is-closed-tab ${selectedColumn === 'closed' ? 'is-active' : ''}`}
                  onClick={() => setSelectedColumn('closed')}
                >
                  <GitPullRequestClosed size={12} aria-hidden="true" />
                  <span>Closed</span>
                  <span className="merge-history-badge">{filteredClosed.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  title={isSplit ? 'Single column view' : 'Dual column split view'}
                  aria-label="Split view (both columns)"
                  aria-selected={isSplit}
                  className={`merge-history-col-tab is-icon-only ${isSplit ? 'is-active' : ''}`}
                  onClick={() => setSelectedColumn(isSplit ? 'merged' : 'split')}
                >
                  <Columns2 size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Counter & Refresh */}
        <div className="merge-history-toolbar">
          <span>
            {selectedColumn === 'merged' && (
              <>{filteredMerged.length} recent {filteredMerged.length === 1 ? 'merge' : 'merges'}</>
            )}
            {selectedColumn === 'closed' && (
              <>{filteredClosed.length} recent closed {filteredClosed.length === 1 ? 'PR' : 'PRs'}</>
            )}
            {isSplit && (
              <>{filteredMerged.length} merged · {filteredClosed.length} closed</>
            )}
          </span>
          <button
            type="button"
            className="merge-history-refresh"
            aria-label="Refresh merge history"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              setManualRefreshKey((key) => key + 1);
            }}
            disabled={isLoading || monitoredRepos.length === 0}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : undefined} aria-hidden="true" />
          </button>
        </div>

        {/* Body Content */}
        {isLoading ? (
          <div className="merge-history-state" role="status">
            <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
            <p>Checking recent pull requests…</p>
          </div>
        ) : error && mergedEntries.length === 0 && closedEntries.length === 0 ? (
          <div className="merge-history-state is-error" role="status">
            <p>{error}</p>
          </div>
        ) : isSplit ? (
          /* Split Dual Column Layout */
          <div className="merge-history-split-container">
            {error && <p className="merge-history-warning">Some repositories could not be checked.</p>}
            <div className="merge-history-split-columns">
              {/* Column 1: Merged */}
              <div className="merge-history-split-column">
                <div className="merge-history-column-header">
                  <div className="merge-history-column-title">
                    <GitMerge size={13} className="text-purple-600" aria-hidden="true" />
                    <strong>Merged into {targetBranch}</strong>
                  </div>
                  <span className="merge-history-column-count">{filteredMerged.length}</span>
                </div>
                <div className="merge-history-column-scroll">
                  {filteredMerged.length === 0 ? (
                    renderEmptyState('merged')
                  ) : (
                    <ol className="merge-history-list">
                      {filteredMerged.map((entry) => renderEntry(entry, 'merged'))}
                    </ol>
                  )}
                </div>
              </div>

              {/* Column 2: Closed */}
              <div className="merge-history-split-column">
                <div className="merge-history-column-header">
                  <div className="merge-history-column-title">
                    <GitPullRequestClosed size={13} className="text-rose-500" aria-hidden="true" />
                    <strong>Closed PRs</strong>
                  </div>
                  <span className="merge-history-column-count">{filteredClosed.length}</span>
                </div>
                <div className="merge-history-column-scroll">
                  {filteredClosed.length === 0 ? (
                    renderEmptyState('closed')
                  ) : (
                    <ol className="merge-history-list">
                      {filteredClosed.map((entry) => renderEntry(entry, 'closed'))}
                    </ol>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : selectedColumn === 'merged' ? (
          /* Single Column: Merged into targetBranch */
          <div className="merge-history-scroll">
            {error && <p className="merge-history-warning">Some repositories could not be checked.</p>}
            {filteredMerged.length === 0 ? (
              renderEmptyState('merged')
            ) : (
              <ol className="merge-history-list">
                {filteredMerged.map((entry) => renderEntry(entry, 'merged'))}
              </ol>
            )}
          </div>
        ) : (
          /* Single Column: Closed PRs */
          <div className="merge-history-scroll">
            {error && <p className="merge-history-warning">Some repositories could not be checked.</p>}
            {filteredClosed.length === 0 ? (
              renderEmptyState('closed')
            ) : (
              <ol className="merge-history-list">
                {filteredClosed.map((entry) => renderEntry(entry, 'closed'))}
              </ol>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
