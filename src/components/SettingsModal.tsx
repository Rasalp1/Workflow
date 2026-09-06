"use client";

import { useState } from "react";
import { FolderGit2, KeyRound, Save, Settings2, Zap } from "lucide-react";
import type { AgentType, AppConfig } from "@/types";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { AgentPicker } from "./ui/AgentPicker";
import { Notice } from "./ui/Notice";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: Partial<AppConfig>) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  config,
  ...props
}: SettingsModalProps) {
  if (!isOpen) return null;
  if (!config)
    return (
      <Dialog
        isOpen
        onClose={props.onClose}
        title="Workspace settings"
        icon={<Settings2 />}
        footer={<Button onClick={props.onClose}>Close</Button>}
      >
        <Notice tone="warning" title="Settings are unavailable">
          Close this dialog and refresh the workspace to try loading your
          configuration again.
        </Notice>
      </Dialog>
    );
  return <SettingsForm config={config} {...props} />;
}

function SettingsForm({
  config,
  onClose,
  onSaveConfig,
}: Omit<SettingsModalProps, "isOpen" | "config"> & { config: AppConfig }) {
  const [githubToken, setGithubToken] = useState("");
  const [repositories, setRepositories] = useState(
    config.monitoredRepos.join(", "),
  );
  const [repoPaths, setRepoPaths] = useState(config.repoPaths);
  const [defaultAgent, setDefaultAgent] = useState<AgentType>(
    config.defaultAgent || "codex",
  );
  const [directAgentSpawn, setDirectAgentSpawn] = useState(
    !!config.directAgentSpawn,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repos = [
    ...new Set(
      repositories
        .split(",")
        .map((repo) => repo.trim())
        .filter(Boolean),
    ),
  ];
  const hasSavedToken = !!(
    config.hasToken ||
    config.maskedToken ||
    config.githubToken
  );

  async function save() {
    setError(null);
    if (repos.some((repo) => !/^[\w.-]+\/[\w.-]+$/.test(repo))) {
      setError(
        "Use owner/repository for each repository, separated by commas.",
      );
      return;
    }
    setIsSaving(true);
    try {
      await onSaveConfig({
        ...(githubToken.trim() ? { githubToken: githubToken.trim() } : {}),
        monitoredRepos: repos,
        repoPaths,
        defaultAgent,
        directAgentSpawn,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save settings. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Workspace settings"
      description="Connect GitHub, map your repositories, and choose how agents launch."
      icon={<Settings2 />}
      busy={isSaving}
      footer={
        <>
          <span className="footer-hint">Changes apply when you save.</span>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" busy={isSaving} onClick={save}>
            {!isSaving && <Save size={16} />}
            {isSaving ? "Saving settings…" : "Save settings"}
          </Button>
        </>
      }
    >
      {error && (
        <Notice tone="danger" title="Settings weren’t saved">
          {error}
        </Notice>
      )}
      <fieldset className="settings-section" disabled={isSaving}>
        <legend className="section-heading">
          <KeyRound size={17} /> GitHub connection
        </legend>
        <div className="field-heading">
          <label className="field-label" htmlFor="github-token">
            Personal access token
          </label>
          <span
            className={`status-badge ${hasSavedToken ? "status-badge--success" : "status-badge--warning"}`}
          >
            {hasSavedToken ? "Token configured" : "Token needed"}
          </span>
        </div>
        <input
          id="github-token"
          className="ui-input font-mono"
          type="password"
          autoComplete="new-password"
          value={githubToken}
          placeholder={
            hasSavedToken
              ? "Enter a new token to replace the saved token"
              : "ghp_…"
          }
          onChange={(event) => {
            setGithubToken(event.target.value);
          }}
          aria-describedby="token-help"
        />
        <p className="field-help" id="token-help">
          Use a token with repository access to read private pull requests and
          comments.{" "}
          {hasSavedToken && !githubToken && "Your saved token will be kept."}
        </p>
      </fieldset>
      <fieldset className="settings-section" disabled={isSaving}>
        <legend className="section-heading">
          <FolderGit2 size={17} /> Repositories
        </legend>
        <label className="field-label" htmlFor="monitored-repos">
          Monitored repositories
        </label>
        <input
          id="monitored-repos"
          className="ui-input font-mono"
          value={repositories}
          onChange={(event) => setRepositories(event.target.value)}
          placeholder="owner/repository, owner/another-repository"
          aria-describedby="repositories-help"
        />
        <p className="field-help" id="repositories-help">
          Separate repositories with commas. Add a local path to enable
          worktrees and agent launches.
        </p>
        <div className="path-list">
          {repos.map((repo, index) => (
            <div className="path-row" key={repo}>
              <div className="field-heading">
                <label
                  htmlFor={`repo-path-${index}`}
                  className="field-label font-mono"
                >
                  {repo}
                </label>
                <span
                  className={`status-badge ${repoPaths[repo] ? "status-badge--neutral" : "status-badge--warning"}`}
                >
                  {repoPaths[repo] ? "Path set" : "Path missing"}
                </span>
              </div>
              <input
                id={`repo-path-${index}`}
                className="ui-input font-mono"
                value={repoPaths[repo] || ""}
                placeholder={`/Users/you/Projects/${repo.split("/").pop()}`}
                onChange={(event) =>
                  setRepoPaths({ ...repoPaths, [repo]: event.target.value })
                }
              />
            </div>
          ))}
        </div>
      </fieldset>
      <section className="settings-section">
        <h3 className="section-heading">
          <Zap size={17} /> Agent workflow
        </h3>
        <AgentPicker
          value={defaultAgent}
          onChange={setDefaultAgent}
          disabled={isSaving}
          label="Default agent"
        />
        <label className="launch-setting" data-enabled={directAgentSpawn}>
          <span>
            <strong>Launch agents immediately</strong>
            <small>
              {directAgentSpawn
                ? "Action buttons launch the agent without a prompt review."
                : "Review and edit the prompt before launching an agent."}
            </small>
          </span>
          <input
            className="ui-switch"
            type="checkbox"
            role="switch"
            checked={directAgentSpawn}
            onChange={(event) => setDirectAgentSpawn(event.target.checked)}
            disabled={isSaving}
          />
        </label>
      </section>
    </Dialog>
  );
}
