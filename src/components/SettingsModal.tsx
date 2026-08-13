'use client';

import React, { useState } from 'react';
import { AgentType, AppConfig } from '@/types';
import { X, Save, Key, GitBranch, Folder, ShieldCheck, Zap, Terminal, Cpu } from 'lucide-react';

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
  const [prevConfig, setPrevConfig] = useState<AppConfig | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [monitoredReposStr, setMonitoredReposStr] = useState('');
  const [repoPaths, setRepoPaths] = useState<Record<string, string>>({});
  const [defaultAgent, setDefaultAgent] = useState<AgentType>('codex');
  const [directAgentSpawn, setDirectAgentSpawn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (config && config !== prevConfig) {
    setPrevConfig(config);
    setGithubToken(config.maskedToken || config.githubToken || '');
    setMonitoredReposStr((config.monitoredRepos || []).join(', '));
    setRepoPaths(config.repoPaths || {});
    setDefaultAgent(config.defaultAgent || 'codex');
    setDirectAgentSpawn(!!config.directAgentSpawn);
  }

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
        defaultAgent,
        directAgentSpawn,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="panel-raised rounded-xl w-full max-w-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Credentials & Repository Mapping</h3>
              <p className="text-xs text-gray-500">Configure GitHub access tokens and local repo directory paths</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-white">
          {/* GitHub Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-500" /> GitHub Personal Access Token (PAT):
            </label>
            <input
              type="password"
              value={githubToken}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
            <p className="text-[11px] text-gray-400">Requires &apos;repo&apos; scope to read private repositories and comments.</p>
          </div>

          {/* Monitored Repos */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-purple-500" /> Monitored Repositories (Comma Separated):
            </label>
            <input
              type="text"
              value={monitoredReposStr}
              placeholder="owner/repo1, owner/repo2"
              onChange={(e) => setMonitoredReposStr(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Default Agent CLI Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-500" /> Default AI Agent CLI Model:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDefaultAgent('codex')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  defaultAgent === 'codex'
                    ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-semibold shadow-2xs ring-1 ring-blue-400/30'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Terminal className="w-4 h-4 text-blue-600" />
                <span>codex</span>
              </button>
              <button
                type="button"
                onClick={() => setDefaultAgent('claude')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  defaultAgent === 'claude'
                    ? 'bg-purple-50/80 border-purple-300 text-purple-800 font-semibold shadow-2xs ring-1 ring-purple-400/30'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>claude code</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Select the default CLI agent model executable dispatched when reviewing PRs or spawning worktrees.
            </p>
          </div>

          {/* Direct Agent Spawning Toggle */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>Direct AI Agent Launching</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Skip prompt confirmation modal and immediately launch the AI agent in Antigravity IDE when clicking action buttons.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={directAgentSpawn}
              onClick={() => setDirectAgentSpawn(!directAgentSpawn)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                directAgentSpawn ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  directAgentSpawn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Local Folder Mappings */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-500" /> Local Directory Path Mappings:
            </label>
            <p className="text-[11px] text-gray-500">
              Specify the local absolute disk folder path for each repo where `codex` / `claude` CLI will run:
            </p>

            <div className="space-y-2">
              {reposList.map((repo) => (
                <div key={repo} className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5">
                  <span className="text-xs font-semibold text-blue-700 font-mono">{repo}</span>
                  <input
                    type="text"
                    value={repoPaths[repo] || ''}
                    placeholder={`/Users/username/.../${repo.split('/')[1] || ''}`}
                    onChange={(e) => handlePathChange(repo, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
