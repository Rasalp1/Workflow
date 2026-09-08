import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

let isStarting = false;

/** Build fingerprint of the binary a running menu bar process was launched from. */
function readBinaryFingerprint(binPath: string): string {
  try {
    const stat = fs.statSync(binPath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return '';
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startMenubar(customPort?: number): void {
  if (process.platform !== 'darwin') {
    return;
  }

  // Prevent concurrent start calls
  if (isStarting) return;
  isStarting = true;

  try {
    const projectDir = process.cwd();
    const scriptsDir = path.join(projectDir, 'scripts');
    const binPath = path.join(scriptsDir, 'workflow-menubar');
    const buildScript = path.join(scriptsDir, 'build-menubar.sh');
    const dataDir = path.join(projectDir, '.workflow-data');
    const pidFile = path.join(dataDir, 'menubar.pid');
    const buildFile = path.join(dataDir, 'menubar.build');

    // Always give the build script a chance to run; it recompiles only when the
    // Swift source is newer than the binary. Without this, edits to the menu bar
    // app silently never reach the running process.
    if (fs.existsSync(buildScript)) {
      try {
        console.log('[Workflow Menubar] Checking menubar binary is up to date...');
        execSync(`bash "${buildScript}"`, { stdio: 'inherit' });
      } catch (buildErr) {
        console.error('[Workflow Menubar] Build step failed:', buildErr);
      }
    }

    if (!fs.existsSync(binPath)) {
      console.error('[Workflow Menubar] Binary not found and could not be built:', binPath);
      return;
    }

    const fingerprint = readBinaryFingerprint(binPath);

    // Reuse a live instance only when it was launched from the current binary.
    if (fs.existsSync(pidFile)) {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      const runningFingerprint = fs.existsSync(buildFile)
        ? fs.readFileSync(buildFile, 'utf-8').trim()
        : '';

      if (!isNaN(oldPid) && isProcessAlive(oldPid)) {
        if (runningFingerprint === fingerprint) {
          console.log(`[Workflow Menubar] Already running with PID ${oldPid}`);
          return;
        }

        console.log(
          `[Workflow Menubar] Binary changed; restarting stale menu bar process (PID ${oldPid})...`
        );
        try {
          process.kill(oldPid, 'SIGTERM');
        } catch (killErr) {
          console.error('[Workflow Menubar] Could not stop stale process:', killErr);
        }
      }
    }

    const port = customPort || parseInt(process.env.PORT || '3000', 10);
    const parentPid = process.pid;

    console.log(`[Workflow Menubar] Launching menu bar item for port ${port} (parent PID: ${parentPid})...`);

    const child = spawn(binPath, ['--port', port.toString(), '--parent-pid', parentPid.toString()], {
      detached: true,
      stdio: 'ignore',
    });

    if (child.pid) {
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(pidFile, child.pid.toString(), 'utf-8');
        fs.writeFileSync(buildFile, fingerprint, 'utf-8');
      } catch (err) {
        console.error('[Workflow Menubar] Could not save PID file:', err);
      }

      // Cleanup on server exit
      const cleanup = () => {
        try {
          if (child.pid) {
            process.kill(child.pid, 'SIGTERM');
          }
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
          if (fs.existsSync(buildFile)) {
            fs.unlinkSync(buildFile);
          }
        } catch {
          // Ignore if already dead
        }
      };

      process.once('exit', cleanup);
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);

      child.unref();
      console.log(`[Workflow Menubar] Menu bar item started with PID ${child.pid}`);
    }
  } catch (error) {
    console.error('[Workflow Menubar] Error launching menu bar item:', error);
  } finally {
    isStarting = false;
  }
}
