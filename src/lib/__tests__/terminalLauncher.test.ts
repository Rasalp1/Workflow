import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { openTerminalInAntigravity, spawnWorktreeInAntigravity } from '../terminalLauncher.ts';

const execFileAsync = promisify(execFile);

/**
 * `osacompile` only exists on macOS, so the AppleScript syntax check is skipped
 * elsewhere (CI runs on Linux). The content assertions below run everywhere.
 */
const canCompileAppleScript = await (async () => {
  if (process.platform !== 'darwin') return false;
  try {
    await execFileAsync('osacompile', ['-h']);
    return true;
  } catch (error) {
    return (error as { code?: string }).code !== 'ENOENT';
  }
})();

describe('Antigravity integrated terminal launcher', () => {
  it('focuses the matching repository window and pastes into its integrated terminal', async () => {
    const commands: string[] = [];
    let generatedScript = '';

    const runCommand = async (command: string): Promise<unknown> => {
      commands.push(command);
      if (command.startsWith('osascript ')) {
        const scriptPath = command.match(/^osascript ["'](.+)["']$/)?.[1];
        assert.ok(scriptPath);
        generatedScript = await readFile(scriptPath, 'utf8');
        if (canCompileAppleScript) {
          const compiledPath = `${scriptPath}.compiled`;
          await execFileAsync('osacompile', ['-o', compiledPath, scriptPath]);
          await unlink(compiledPath);
        }
      }
      return undefined;
    };

    await openTerminalInAntigravity(
      {
        cleanRepoPath: process.cwd(),
        targetDir: process.cwd(),
        cliCommand: 'codex',
      },
      { runCommand },
    );

    assert.ok(commands.some((command) => command.startsWith('osascript ')));
    assert.equal(commands.filter((command) => command.startsWith('osascript ')).length, 1);
    assert.equal(commands.length, 1);
    assert.equal(generatedScript.includes('open POSIX file repoPath'), false);
    assert.equal(generatedScript.includes('set ideCli to'), true);
    assert.equal(
      generatedScript.includes('«event sysoexec» quoted form of ideCli & " --new-window " & quoted form of repoPath'),
      true,
    );
    assert.equal(generatedScript.includes('tell application "Terminal"'), false);
    assert.equal(generatedScript.includes('set the clipboard to cmdString'), true);
    assert.equal(generatedScript.includes('keystroke "v" using {command down}'), true);
    assert.equal(generatedScript.includes('workbench.action.terminal.new'), true);
    assert.equal(generatedScript.includes('open -a "Terminal"'), false);
    assert.equal(generatedScript.includes('«event sysoexec»'), true);
  });

  it('reports the required TCC access without launching another terminal', async () => {
    const commands: string[] = [];
    const runCommand = async (command: string): Promise<unknown> => {
      commands.push(command);
      if (command.startsWith('osascript ')) {
        throw new Error('System Events got an error: Not authorised to send Apple events to System Events. (-1743)');
      }
      return undefined;
    };

    await assert.rejects(
      openTerminalInAntigravity(
        { cleanRepoPath: process.cwd(), targetDir: process.cwd(), cliCommand: 'codex' },
        { runCommand },
      ),
      /Apple Events|Accessibility.*Automation/,
    );
    assert.equal(commands.length, 1);
  });

  it('builds terminal command that cds into worktree, pulls the branch, and starts the agent', async () => {
    let generatedScript = '';
    const runCommand = async (command: string): Promise<unknown> => {
      if (command.startsWith('osascript ')) {
        const scriptPath = command.match(/^osascript ["'](.+)["']$/)?.[1];
        assert.ok(scriptPath);
        generatedScript = await readFile(scriptPath, 'utf8');
      }
      return undefined;
    };

    const targetDir = '/Users/test/Projects/worktrees/feature-test';
    const branchName = 'feature-test';
    const agent = 'claude';

    await openTerminalInAntigravity(
      {
        cleanRepoPath: '/Users/test/Projects/repo',
        targetDir,
        cliCommand: `git pull origin "${branchName}" && ${agent}`,
      },
      { runCommand },
    );

    assert.ok(
      generatedScript.includes(
        `set cmdString to "cd \\"${targetDir}\\" && git pull origin \\"${branchName}\\" && ${agent}"`
      ),
      'Generated AppleScript should cd into worktree, pull the branch, and then start the agent',
    );
  });

  it('spawnWorktreeInAntigravity handles invalid paths gracefully', async () => {
    const result = await spawnWorktreeInAntigravity({
      repoPath: '/non/existent/path',
      branchName: 'feature-test',
      agent: 'claude',
    });
    assert.equal(result.success, false);
    assert.ok(result.message.includes('does not exist on disk'));
  });
});

