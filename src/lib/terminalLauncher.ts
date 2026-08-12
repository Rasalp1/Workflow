import { exec } from 'child_process';
import { promisify } from 'util';
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

    // Check if worktree directory already exists
    const { stdout: existingWorktrees } = await execAsync(`git -C "${cleanRepoPath}" worktree list`).catch(() => ({ stdout: '' }));
    const alreadyExists = existingWorktrees.includes(worktreePath);

    if (!alreadyExists) {
      // Fetch latest commits from remote for branch
      await execAsync(`git -C "${cleanRepoPath}" fetch origin "${branchName}"`).catch(() => {});
      
      // Try worktree add: 1. branch directly, 2. new local branch from origin/branch, 3. fallback create
      const addCmd = `git -C "${cleanRepoPath}" worktree add "${worktreePath}" "${branchName}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" -b "${branchSlug}" "origin/${branchName}" 2>/dev/null || git -C "${cleanRepoPath}" worktree add "${worktreePath}" HEAD`;
      await execAsync(addCmd);
    }

    // Launch Antigravity IDE pointing to worktreePath
    const appleScript = `
      tell application "System Events"
        if exists (process "Antigravity") then
          tell process "Antigravity"
            set frontmost to true
          end tell
        end if
      end tell
      do shell script "open -a Antigravity \\"${worktreePath}\\""
    `;
    await execAsync(`osascript -e '${appleScript}'`);

    return {
      success: true,
      message: `Worktree for branch "${branchName}" spawned at "${worktreePath}" and opened in Antigravity IDE`,
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
