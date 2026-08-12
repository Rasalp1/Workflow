'use client';

import React, { useState } from 'react';
import { AppConfig } from '@/types';
import { X, Save, Key, GitBranch, Folder, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: Partial<AppConfig>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [githubToken, setGithubToken] = useState('');
  const [monitoredReposStr, setMonitoredReposStr] = useState('');
  const [repoPaths, setRepoPaths] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (config) {
      setGithubToken(config.githubToken || '');
      setMonitoredReposStr((config.monitoredRepos || []).join(', '));
      setRepoPaths(config.repoPaths || {});
    }
  }, [config]);

  if (!isOpen || !config) return null;

  const handlePathChange = (repo: string, path: string) => {
    setRepoPaths((prev) => ({
      ...prev,
      [repo]: path,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const repos = monitoredReposStr
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      await onSaveConfig({
        githubToken: githubToken.includes('...') ? config.githubToken : githubToken,
        monitoredRepos: repos,
        repoPaths,
      });

      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const reposList = monitoredReposStr
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-2xl w-full max-w-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Credentials & Repository Mapping</h3>
              <p className="text-xs text-slate-400">Configure GitHub access tokens and local repo directory paths</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-900/40">
          {/* GitHub Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-400" /> GitHub Personal Access Token (PAT):
            </label>
            <input
              type="password"
              value={githubToken}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500">Requires &apos;repo&apos; scope to read private repositories and comments.</p>
          </div>

          {/* Monitored Repos */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-purple-400" /> Monitored Repositories (Comma Separated):
            </label>
            <input
              type="text"
              value={monitoredReposStr}
              placeholder="owner/repo1, owner/repo2"
              onChange={(e) => setMonitoredReposStr(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Local Folder Mappings */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-indigo-400" /> Local Directory Path Mappings:
            </label>
            <p className="text-[11px] text-slate-400">
              Specify the local absolute disk folder path for each repo where `codex` / `claude` CLI will run:
            </p>

            <div className="space-y-3">
              {reposList.map((repo) => (
                <div key={repo} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-indigo-300 font-mono">{repo}</span>
                  <input
                    type="text"
                    value={repoPaths[repo] || ''}
                    placeholder={`/Users/username/.../${repo.split('/')[1] || ''}`}
                    onChange={(e) => handlePathChange(repo, e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
