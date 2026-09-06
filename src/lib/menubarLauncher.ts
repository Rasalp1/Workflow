import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

let isStarting = false;

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
    const pidFile = path.join(projectDir, '.workflow-data', 'menubar.pid');

    // Check if an instance is already running
    if (fs.existsSync(pidFile)) {
      try {
        const oldPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
        if (!isNaN(oldPid)) {
          // Check if process is alive
          process.kill(oldPid, 0);
          console.log(`[Workflow Menubar] Already running with PID ${oldPid}`);
          return;
        }
      } catch {
        // Process is not running; stale pid file
      }
    }

    // Build binary if it doesn't exist
    if (!fs.existsSync(binPath)) {
      if (fs.existsSync(buildScript)) {
        console.log('[Workflow Menubar] Compiling workflow-menubar binary...');
        execSync(`bash "${buildScript}"`, { stdio: 'inherit' });
      } else {
        console.error('[Workflow Menubar] Build script not found:', buildScript);
        return;
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
        const dataDir = path.join(projectDir, '.workflow-data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(pidFile, child.pid.toString(), 'utf-8');
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
