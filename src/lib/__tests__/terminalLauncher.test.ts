import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { openTerminalInAntigravity } from '../terminalLauncher.ts';

const execFileAsync = promisify(execFile);

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
        const compiledPath = `${scriptPath}.compiled`;
        await execFileAsync('osacompile', ['-o', compiledPath, scriptPath]);
        await unlink(compiledPath);
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
});
