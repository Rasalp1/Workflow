import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentType } from '@/types';
import { sanitizeBranchName, validateLocalPath } from '@/lib/security';

const execAsync = promisify(exec);

export interface SpawnAgentOptions {
  repoPath: string;
  branchName?: string;
  agent: AgentType;
  prompt: string;
}

export interface SpawnWorktreeOptions {
  repoPath: string;
  branchName: string;
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
  const parentDir = cleanRepoPath.substring(0, cleanRepoPath.lastIndexOf('/'));
  const worktreesDir = `${parentDir}/worktrees`;
  const worktreePath = `${worktreesDir}/${branchSlug}`;

  // Ensure worktrees container directory exists
  await execAsync(`mkdir -p "${worktreesDir}"`);

  // Check if worktree directory already exists on disk or in git worktree list
  const directoryExists = existsSync(worktreePath);
  const { stdout: existingWorktrees } = await execAsync(`git -C "${cleanRepoPath}" worktree list`).catch(() => ({ stdout: '' }));
  const registeredInGit = existingWorktrees.split('\n').some((line) => line.includes(worktreePath) || line.includes(branchSlug));
  const alreadyExists = directoryExists || registeredInGit;

  if (!alreadyExists) {
    // Fetch latest commits from remote for branch
    await execAsync(`git -C "${cleanRepoPath}" fetch origin "${cleanBranch}"`).catch(() => {});
    
    // Try worktree add: 1. branch directly, 2. new local branch from origin/branch, 3. fallback create
    const addCmd = `git -C "${cleanRepoPath}" worktree add "${worktreePath}" "${cleanBranch}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" -b "${branchSlug}" "origin/${cleanBranch}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" HEAD`;
    try {
      await execAsync(addCmd);
    } catch (addError: unknown) {
      if (!existsSync(worktreePath)) {
        throw addError;
      }
    }
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
}): Promise<void> {
  const repoName = cleanRepoPath.split('/').pop() ?? '';
  const ideCli = '/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide';

  const fullCommand = cliCommand
    ? `cd "${targetDir}" && ${cliCommand}`
    : `cd "${targetDir}"`;

  const safeCommand = fullCommand.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const appleScript = `
set repoName to "${repoName}"
set repoPath to "${cleanRepoPath}"
set targetDir to "${targetDir}"
set ideCli to "${ideCli}"
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
  do shell script quoted form of ideCli & " --new-window " & quoted form of repoPath
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
    -- Type the command into the fresh terminal
    keystroke cmdString
    key code 36
  end tell
end tell
`;

  const tmpScript = join(tmpdir(), `antigravity-open-${Date.now()}.applescript`);
  await writeFile(tmpScript, appleScript, 'utf8');
  try {
    await execAsync(`osascript "${tmpScript}"`);
  } catch (scriptErr: unknown) {
    const msg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
    if (msg.includes('1002') || msg.includes('not allowed to send keystrokes')) {
      await execAsync(
        `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`
      ).catch(() => {});
      throw new Error(`Permission required: Please grant Accessibility access to your terminal in System Settings, then try again.`);
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

    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const cliCommand = `${agent} "${escapedPrompt}"`;

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

export async function spawnWorktreeInAntigravity({
  repoPath,
  branchName,
}: SpawnWorktreeOptions): Promise<{ success: boolean; message: string; worktreePath: string }> {
  try {
    validateLocalPath(repoPath);
    const cleanRepoPath = repoPath.replace(/\/$/, '');
    const worktreePath = await ensureWorktree({ repoPath: cleanRepoPath, branchName });

    await openTerminalInAntigravity({
      cleanRepoPath,
      targetDir: worktreePath,
    });

    return {
      success: true,
      message: `Worktree for branch "${branchName}" opened in Antigravity IDE at "${worktreePath}"`,
      worktreePath,
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

    const repoListStr = cleanRepoPaths.map((p) => `"${p}"`).join(' ');
    const cliCommand = `for repo in ${repoListStr}; do echo "=== Closing worktrees for $repo ===" && git -C "$repo" worktree list --porcelain | grep '^worktree ' | cut -d' ' -f2- | tail -n +2 | while read -r wt; do echo "Removing worktree: $wt" && git -C "$repo" worktree remove --force "$wt"; done && git -C "$repo" worktree prune; done; echo "=== All worktrees closed successfully ==="`;

    await openTerminalInAntigravity({
      cleanRepoPath: cleanTarget,
      targetDir: cleanTarget,
      cliCommand,
    });

    return {
      success: true,
      message: `Opened terminal in ${cleanTarget} and executed commands to close all worktrees for ${cleanRepoPaths.length} repo(s)`,
    };
  } catch (error: unknown) {
    console.error('Failed to close worktrees in terminal:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to close worktrees in terminal: ${msg}`,
    };
  }
}



