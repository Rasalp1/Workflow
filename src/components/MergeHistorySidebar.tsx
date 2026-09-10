'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, GitMerge, History, RefreshCw } from 'lucide-react';
import { MergeHistoryEntry } from '@/types';

interface MergeHistorySidebarProps {
  monitoredRepos: string[];
  refreshKey?: number;
}

function formatMergedAt(value: string) {
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
  const [entries, setEntries] = useState<MergeHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const monitoredRepoKey = monitoredRepos.join(',');

  const repoLabel = useMemo(() => {
    if (monitoredRepos.length === 1) return monitoredRepos[0];
    return `${monitoredRepos.length} repositories`;
  }, [monitoredRepos]);

  useEffect(() => {
    if (!isOpen || monitoredRepoKey.length === 0) return;

    const controller = new AbortController();
    fetch(`/api/prs/history?${refreshKey || manualRefreshKey ? 'force=true' : ''}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Could not load merge history');
        setEntries(Array.isArray(data.mergeHistory) ? data.mergeHistory : []);
        setError(data.warning || null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load merge history');
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

  return (
    <aside className={`merge-history-drawer ${isOpen ? 'is-open' : ''}`} aria-label="Merge history">
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

      <div className="merge-history-panel" id="merge-history-panel" aria-hidden={!isOpen} inert={!isOpen}>
        <div className="merge-history-heading">
          <div>
            <span className="merge-history-eyebrow">Delivery log</span>
            <h2>Merge history</h2>
            <p>Pull requests landed in <code>main</code></p>
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

        <div className="merge-history-toolbar">
          <span>{entries.length} recent {entries.length === 1 ? 'merge' : 'merges'}</span>
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

        {isLoading ? (
          <div className="merge-history-state" role="status">
            <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
            <p>Checking recent merges…</p>
          </div>
        ) : error && entries.length === 0 ? (
          <div className="merge-history-state is-error" role="status">
            <p>{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="merge-history-state">
            <GitMerge size={20} aria-hidden="true" />
            <p>No PRs merged into <code>main</code> yet.</p>
            <span>{monitoredRepos.length === 0 ? 'Add a repository to start tracking.' : `Watching ${repoLabel}.`}</span>
          </div>
        ) : (
          <div className="merge-history-scroll">
            {error && <p className="merge-history-warning">Some repositories could not be checked.</p>}
            <ol className="merge-history-list">
              {entries.map((entry) => (
                <li key={`${entry.repo_full_name}-${entry.id}`} className="merge-history-entry">
                  <span className="merge-history-marker" aria-hidden="true"><GitMerge size={12} /></span>
                  <div className="merge-history-entry-body">
                    <div className="merge-history-entry-meta">
                      <span>{entry.repo_full_name}</span>
                      <time dateTime={entry.merged_at} title={new Date(entry.merged_at).toLocaleString()}>
                        {formatMergedAt(entry.merged_at)}
                      </time>
                    </div>
                    <a href={entry.html_url} target="_blank" rel="noreferrer" className="merge-history-entry-link">
                      <span>#{entry.number}</span>
                      <strong>{entry.title}</strong>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                    <a
                      href={entry.user.html_url || undefined}
                      target={entry.user.html_url ? '_blank' : undefined}
                      rel={entry.user.html_url ? 'noreferrer' : undefined}
                      className="merge-history-entry-author"
                    >
                      {entry.user.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={entry.user.avatar_url} alt="" className="merge-history-entry-author-avatar" />
                      ) : (
                        <span className="merge-history-entry-author-fallback" aria-hidden="true" />
                      )}
                      <span>by @{entry.user.login}</span>
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
};
