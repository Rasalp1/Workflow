import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentType } from '@/types';

const execAsync = promisify(exec);

export interface SpawnAgentOptions {
  repoPath: string;
  agent: AgentType;
  prompt: string;
}

export interface SpawnWorktreeOptions {
  repoPath: string;
  branchName: string;
}

export async function spawnAgentInTerminal({
  repoPath,
  agent,
  prompt,
}: SpawnAgentOptions): Promise<{ success: boolean; message: string }> {
  // Sanitize prompt for shell execution safely
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const cliCommand = `${agent} "${escapedPrompt}"`;

  // AppleScript to activate Antigravity IDE, create a new terminal tab in the repo directory, and execute the agent command
  const appleScript = `
    tell application "System Events"
      -- Try to find Antigravity process or bring it to front
      if exists (process "Antigravity") then
        tell process "Antigravity"
          set frontmost to true
        end tell
      end if
    end tell

    delay 0.3

    -- Run shell script to launch a new terminal tab in Antigravity or system shell targeting repoPath
    do shell script "open -a Antigravity \\"${repoPath}\\""
  `;

  try {
    // 1. Ensure target path exists
    if (repoPath) {
      // Execute AppleScript to focus Antigravity on target directory
      const commandScript = `
        osascript -e '${appleScript}'
      `;
      await execAsync(commandScript);
    }

    // 2. Also run AppleScript keystroke to open terminal and send CLI command if Antigravity is open
    const terminalScript = `
      osascript -e '
        tell application "System Events"
          tell process "Antigravity"
            set frontmost to true
            delay 0.2
            -- Shortcut to open terminal in Antigravity (Control + grave accent \`)
            key code 50 using {control down}
            delay 0.5
            keystroke "cd \\"${repoPath}\\" && ${cliCommand}"
            key code 36 -- Return key
          end tell
        end tell
      '
    `;

    try {
      await execAsync(terminalScript);
      return {
        success: true,
        message: `Successfully spawned ${agent} agent in Antigravity IDE terminal for ${repoPath}`,
      };
    } catch (err: any) {
      // Fallback: If keystroke AppleScript fails (e.g. process name difference), launch via macOS Terminal app targeting Antigravity repo directory
      const fallbackScript = `
        osascript -e '
          tell application "Terminal"
            do script "cd \\"${repoPath}\\" && ${cliCommand}"
            activate
          end tell
        '
      `;
      await execAsync(fallbackScript);
      return {
        success: true,
        message: `Spawned ${agent} agent in terminal window for ${repoPath}`,
      };
    }
  } catch (error: any) {
    console.error('Failed to spawn agent in terminal:', error);
    return {
      success: false,
      message: `Failed to launch agent in terminal: ${error.message}`,
    };
  }
}

export async function spawnWorktreeInAntigravity({
  repoPath,
  branchName,
}: SpawnWorktreeOptions): Promise<{ success: boolean; message: string; worktreePath: string }> {
  try {
    const branchSlug = branchName.replace(/[^a-zA-Z0-9._-]/g, '-');
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
      await execAsync(`git -C "${cleanRepoPath}" fetch origin "${branchName}"`).catch(() => {});
      
      // Try worktree add: 1. branch directly, 2. new local branch from origin/branch, 3. fallback create
      const addCmd = `git -C "${cleanRepoPath}" worktree add "${worktreePath}" "${branchName}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" -b "${branchSlug}" "origin/${branchName}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" HEAD`;
      try {
        await execAsync(addCmd);
      } catch (addError: any) {
        // If git worktree add failed (e.g. branch or folder already exists elsewhere), but worktree directory exists on disk now, do not abort
        if (!existsSync(worktreePath)) {
          throw addError;
        }
      }
    }

    // Open a new terminal tab in the correct Antigravity IDE window (the one showing this repo).
    // If no window with this repo is open, launch it first.
    const repoName = cleanRepoPath.split('/').pop() ?? '';
    const ideCli = '/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide';

    const appleScript = `
set repoName to "${repoName}"
set repoPath to "${cleanRepoPath}"
set worktreePath to "${worktreePath}"
set ideCli to "${ideCli}"

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

-- Raise the matched window and open a terminal, then cd to worktree
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
    -- Type the cd command into the fresh terminal
    keystroke "cd '" & worktreePath & "'"
    key code 36
  end tell
end tell
`;
    const tmpScript = join(tmpdir(), `worktree-open-${Date.now()}.applescript`);
    await writeFile(tmpScript, appleScript, 'utf8');
    try {
      await execAsync(`osascript "${tmpScript}"`);
    } catch (scriptErr: any) {
      // Error 1002 = Accessibility permission not granted
      if (scriptErr.message?.includes('1002') || scriptErr.message?.includes('not allowed to send keystrokes')) {
        // Open System Settings to the Accessibility pane so the user can grant permission
        await execAsync(
          `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`
        ).catch(() => {});
        return {
          success: false,
          message: `Permission required: Please grant Accessibility access to your terminal in the System Settings window that just opened, then try again.`,
          worktreePath,
        };
      }
      throw scriptErr;
    } finally {
      await unlink(tmpScript).catch(() => {});
    }

    const wasExisting = alreadyExists || existsSync(worktreePath);
    return {
      success: true,
      message: wasExisting
        ? `Worktree for branch "${branchName}" already exists at "${worktreePath}" — opened terminal and navigated in Antigravity IDE`
        : `Worktree for branch "${branchName}" spawned at "${worktreePath}" and opened in Antigravity IDE`,
      worktreePath,
    };
  } catch (error: any) {
    console.error('Failed to spawn worktree in Antigravity:', error);
    return {
      success: false,
      message: `Failed to spawn worktree: ${error.message}`,
      worktreePath: '',
    };
  }
}
