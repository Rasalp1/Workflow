import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type { AgentType } from '../types/index.ts';
import { escapeAppleScriptString, sanitizeBranchName, validateLocalPath } from './security.ts';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

type CommandRunner = (command: string) => Promise<unknown>;

export interface TerminalLauncherDependencies {
  runCommand?: CommandRunner;
}

export interface SpawnAgentOptions {
  repoPath: string;
  branchName?: string;
  agent: AgentType;
  prompt: string;
}

export interface SpawnWorktreeOptions {
  repoPath: string;
  branchName: string;
  agent?: AgentType;
}

/**
 * Ensures a Git worktree exists for a given branch in `<parentDir>/worktrees/<branchSlug>`.
 */
export async function ensureWorktree({
  repoPath,
  branchName,
}: {
  repoPath: string;
  branchName: string;
}): Promise<string> {
  validateLocalPath(repoPath);
  const cleanBranch = sanitizeBranchName(branchName);
  const branchSlug = cleanBranch.replace(/[^a-zA-Z0-9._-]/g, '-');
  const cleanRepoPath = repoPath.replace(/\/$/, '');
  const parentDir = dirname(cleanRepoPath);
  const worktreesDir = join(parentDir, 'worktrees');
  const worktreePath = join(worktreesDir, branchSlug);

  // Ensure worktrees container directory exists
  await execFileAsync('mkdir', ['-p', worktreesDir]);

  // Check if worktree directory already exists on disk or in git worktree list
  const directoryExists = existsSync(worktreePath);
  const { stdout: existingWorktrees } = await execFileAsync('git', ['-C', cleanRepoPath, 'worktree', 'list']).catch(() => ({ stdout: '' }));
  const registeredInGit = existingWorktrees.split('\n').some((line) => line.includes(worktreePath) || line.includes(branchSlug));
  const alreadyExists = directoryExists || registeredInGit;

  if (!alreadyExists) {
    // Fetch latest commits from remote for branch
    await execFileAsync('git', ['-C', cleanRepoPath, 'fetch', 'origin', cleanBranch]).catch(() => {});

    // Try worktree add: branch directly, a new local branch from origin, then HEAD.
    const addAttempts = [
      ['worktree', 'add', worktreePath, cleanBranch],
      ['worktree', 'add', worktreePath, '-b', branchSlug, `origin/${cleanBranch}`],
      ['worktree', 'add', worktreePath, 'HEAD'],
    ];
    let addError: unknown;
    for (const args of addAttempts) {
      try {
        await execFileAsync('git', ['-C', cleanRepoPath, ...args]);
        addError = undefined;
        break;
      } catch (error: unknown) {
        addError = error;
      }
    }
    if (addError && !existsSync(worktreePath)) throw addError;
  }

  return worktreePath;
}

/**
 * Opens a terminal tab in the target Antigravity IDE window and executes commands.
 */
export async function openTerminalInAntigravity({
  cleanRepoPath,
  targetDir,
  cliCommand,
}: {
  cleanRepoPath: string;
  targetDir: string;
  cliCommand?: string;
}, dependencies: TerminalLauncherDependencies = {}): Promise<void> {
  const repoName = cleanRepoPath.split('/').pop() ?? '';
  const ideCli = '/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide';

  const fullCommand = cliCommand
    ? `cd "${targetDir}" && ${cliCommand}`
    : `cd "${targetDir}"`;

  const safeCommand = escapeAppleScriptString(fullCommand);

  const appleScript = `
set repoName to "${escapeAppleScriptString(repoName)}"
set repoPath to "${escapeAppleScriptString(cleanRepoPath)}"
set targetDir to "${escapeAppleScriptString(targetDir)}"
set ideCli to "${escapeAppleScriptString(ideCli)}"
set cmdString to "${safeCommand}"

-- Ensure the app is running
tell application "Antigravity IDE"
  activate
end tell
delay 0.5

-- Find the window whose title contains the repo folder name
set targetWindow to missing value
tell application "System Events"
  tell process "Antigravity IDE"
    repeat with w in every window
      if name of w contains repoName then
        set targetWindow to w
        exit repeat
      end if
    end repeat
  end tell
end tell

-- If no matching window, open the repo in a new window and wait for it to load
if targetWindow is missing value then
  «event sysoexec» quoted form of ideCli & " --new-window " & quoted form of repoPath
  delay 4
  tell application "System Events"
    tell process "Antigravity IDE"
      repeat with w in every window
        if name of w contains repoName then
          set targetWindow to w
          exit repeat
        end if
      end repeat
    end tell
  end tell
end if

-- Raise the matched window and open a terminal, then type command
tell application "System Events"
  tell process "Antigravity IDE"
    if targetWindow is not missing value then
      perform action "AXRaise" of targetWindow
    end if
    set frontmost to true
    delay 0.3
    -- Open command palette (Cmd+Shift+P)
    key code 35 using {command down, shift down}
    delay 0.6
    -- Create a new terminal via command ID
    keystroke "workbench.action.terminal.new"
    delay 0.4
    key code 36
    delay 1.2
    -- Paste the command into the fresh terminal
    set the clipboard to cmdString
    keystroke "v" using {command down}
    key code 36
  end tell
end tell
`;

  const tmpScript = join(tmpdir(), `antigravity-open-${Date.now()}.applescript`);
  await writeFile(tmpScript, appleScript, 'utf8');
  try {
    const runCommand: CommandRunner = dependencies.runCommand || ((command) => execAsync(command));
    await runCommand(`osascript "${tmpScript}"`);
  } catch (scriptErr: unknown) {
    const msg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
    const normalizedMessage = msg.toLowerCase();
    if (
      normalizedMessage.includes('1002') ||
      normalizedMessage.includes('not allowed to send keystrokes') ||
      normalizedMessage.includes('-1743') ||
      normalizedMessage.includes('not authorised to send apple events') ||
      normalizedMessage.includes('not authorized to send apple events')
    ) {
      const settingsPane =
        normalizedMessage.includes('-1743') ||
        normalizedMessage.includes('apple events')
          ? 'Privacy_Automation'
          : 'Privacy_Accessibility';
      await execAsync(
        `open "x-apple.systempreferences:com.apple.preference.security?${settingsPane}"`
      ).catch(() => {});
      throw new Error(
        normalizedMessage.includes('-1743') || normalizedMessage.includes('apple events')
          ? `macOS denied Apple Events from the process running the Workflow server. Check System Settings → Privacy & Security → Automation for the process that launched Workflow (currently /usr/bin/osascript), then retry. macOS reported: ${msg}`
          : `macOS denied keystrokes to Antigravity IDE. Check System Settings → Privacy & Security → Accessibility for the process running Workflow, then retry. macOS reported: ${msg}`
      );
    }
    throw scriptErr;
  } finally {
    await unlink(tmpScript).catch(() => {});
  }
}

export async function spawnAgentInTerminal({
  repoPath,
  branchName,
  agent,
  prompt,
}: SpawnAgentOptions): Promise<{ success: boolean; message: string }> {
  try {
    validateLocalPath(repoPath);
    const cleanRepoPath = repoPath.replace(/\/$/, '');

    let targetDir = cleanRepoPath;
    if (branchName) {
      targetDir = await ensureWorktree({ repoPath: cleanRepoPath, branchName });
    }

    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const promptFile = join(tmpdir(), `workflow-prompt-${promptId}.txt`);
    const runnerScript = join(tmpdir(), `workflow-runner-${promptId}.sh`);

    await writeFile(promptFile, prompt, 'utf8');

    const runnerContent = `#!/usr/bin/env bash
PROMPT_FILE=${JSON.stringify(promptFile)}
TARGET_DIR=${JSON.stringify(targetDir)}
AGENT=${JSON.stringify(agent)}

cd "$TARGET_DIR" || exit 1
PROMPT="$(cat "$PROMPT_FILE")"
rm -f "$PROMPT_FILE" "$0"
exec "$AGENT" "$PROMPT"
`;

    await writeFile(runnerScript, runnerContent, { mode: 0o755, encoding: 'utf8' });

    // Safety fallback cleanup in case terminal launch fails or script is not executed
    setTimeout(() => {
      unlink(promptFile).catch(() => {});
      unlink(runnerScript).catch(() => {});
    }, 60000);

    const cliCommand = `bash "${runnerScript}"`;

    await openTerminalInAntigravity({
      cleanRepoPath,
      targetDir,
      cliCommand,
    });

    return {
      success: true,
      message: branchName
        ? `Spawned ${agent} agent in Antigravity IDE terminal in worktree for branch "${branchName}"`
        : `Spawned ${agent} agent in Antigravity IDE terminal for ${cleanRepoPath}`,
    };
  } catch (error: unknown) {
    console.error('Failed to spawn agent in terminal:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to launch agent in terminal: ${msg}`,
    };
  }
}

export async function spawnWorktreeInAntigravity(
  {
    repoPath,
    branchName,
    agent = 'codex',
  }: SpawnWorktreeOptions,
  dependencies: TerminalLauncherDependencies = {}
): Promise<{ success: boolean; message: string; worktreePath: string; agent?: AgentType }> {
  try {
    validateLocalPath(repoPath);
    const cleanRepoPath = repoPath.replace(/\/$/, '');
    const cleanBranch = sanitizeBranchName(branchName);
    const worktreePath = await ensureWorktree({ repoPath: cleanRepoPath, branchName: cleanBranch });

    await openTerminalInAntigravity(
      {
        cleanRepoPath,
        targetDir: worktreePath,
        cliCommand: `git pull origin "${cleanBranch}" && "${agent}"`,
      },
      dependencies
    );

    return {
      success: true,
      message: `Worktree for branch "${cleanBranch}" opened with ${agent} in Antigravity IDE at "${worktreePath}"`,
      worktreePath,
      agent,
    };
  } catch (error: unknown) {
    console.error('Failed to spawn worktree in Antigravity:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to spawn worktree: ${msg}`,
      worktreePath: '',
    };
  }
}

export interface CloseAllWorktreesOptions {
  targetRepoPath: string;
  repoPaths: string[];
}

/**
 * Opens a terminal tab in the target repo in Antigravity IDE and executes terminal commands directly
 * (non-agentic) to close all worktrees existing in the specified repos.
 */
export async function closeAllWorktreesInTerminal({
  targetRepoPath,
  repoPaths,
}: CloseAllWorktreesOptions): Promise<{ success: boolean; message: string }> {
  try {
    validateLocalPath(targetRepoPath);
    repoPaths.forEach((p) => validateLocalPath(p));

    const cleanTarget = targetRepoPath.replace(/\/$/, '');
    const cleanRepoPaths = Array.from(new Set(repoPaths.map((p) => p.replace(/\/$/, ''))));

    let totalRemoved = 0;

    for (const repo of cleanRepoPaths) {
      try {
        const { stdout: listOut } = await execFileAsync('git', ['-C', repo, 'worktree', 'list', '--porcelain']).catch(() => ({ stdout: '' }));
        const lines = listOut.split('\n');
        const worktreePaths = lines
          .filter((line) => line.startsWith('worktree '))
          .map((line) => line.substring(9).trim());

        // Index 0 is the main repo root, skip it
        for (let i = 1; i < worktreePaths.length; i++) {
          const wt = worktreePaths[i];
          if (!wt) continue;
          try {
            await execFileAsync('git', ['-C', repo, 'worktree', 'remove', '--force', wt]);
          } catch {
            if (existsSync(wt)) {
              await rm(wt, { recursive: true, force: true }).catch(() => {});
            }
          }
          totalRemoved++;
        }

        await execFileAsync('git', ['-C', repo, 'worktree', 'prune']).catch(() => {});
      } catch (repoErr) {
        console.error(`Error removing worktrees for repo ${repo}:`, repoErr);
      }
    }

    const cliCommand = `echo "=== Worktree Cleanup Complete: ${totalRemoved} worktree(s) removed across ${cleanRepoPaths.length} repo(s) ==="`;

    try {
      await openTerminalInAntigravity({
        cleanRepoPath: cleanTarget,
        targetDir: cleanTarget,
        cliCommand,
      });
    } catch (termErr) {
      console.warn('Could not open notice in Antigravity terminal:', termErr);
    }

    return {
      success: true,
      message: `Successfully closed and removed ${totalRemoved} worktree(s) across ${cleanRepoPaths.length} repo(s).`,
    };
  } catch (error: unknown) {
    console.error('Failed to close worktrees:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to close worktrees: ${msg}`,
    };
  }
}
