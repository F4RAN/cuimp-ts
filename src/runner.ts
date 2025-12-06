import { spawn } from 'node:child_process';
import { RunResult } from './types/runTypes';
import path from 'path';
import fs from 'fs';



export function runBinary(
  binPath: string,
  args: string[],
  opts?: { timeout?: number; signal?: AbortSignal }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // Normalize the binary path for Windows compatibility
    // On Windows, ensure the path uses proper separators and is absolute
    let normalizedPath = path.normalize(binPath)
    
    // On Windows, ensure we have an absolute path
    if (process.platform === 'win32' && !path.isAbsolute(normalizedPath)) {
      normalizedPath = path.resolve(normalizedPath)
    }
    
    // Verify the file exists before spawning (helps with better error messages)
    if (!fs.existsSync(normalizedPath)) {
      return reject(new Error(`Binary not found: ${normalizedPath}`))
    }
    
    const spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'] as const
    }
    
    const child = spawn(normalizedPath, args, spawnOptions)
    setupChildProcess(child, resolve, reject, opts)
  })
}

function setupChildProcess(
  child: ReturnType<typeof spawn>,
  resolve: (value: RunResult) => void,
  reject: (reason?: any) => void,
  opts?: { timeout?: number; signal?: AbortSignal }
): void {

    let killedByTimeout = false;
    let t: NodeJS.Timeout | undefined;

    if (opts?.timeout && opts.timeout > 0) {
      t = setTimeout(() => {
        killedByTimeout = true;
        child.kill('SIGKILL');
      }, opts.timeout);
    }

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    if (opts?.signal) {
      if (opts.signal.aborted) {
        child.kill('SIGKILL');
      } else {
        const onAbort = () => child.kill('SIGKILL');
        opts.signal.addEventListener('abort', onAbort, { once: true });
        child.on('exit', () => opts.signal?.removeEventListener('abort', onAbort));
      }
    }

    child.stdout.on('data', (c) => out.push(Buffer.from(c)));
    child.stderr.on('data', (c) => err.push(Buffer.from(c)));

    child.on('error', (e) => {
      if (t) clearTimeout(t);
      reject(e);
    });

    child.on('close', (code) => {
      if (t) clearTimeout(t);
      if (killedByTimeout) {
        return reject(new Error(`Request timed out after ${opts?.timeout} ms`));
      }
      resolve({
        exitCode: code,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err),
      });
    });
}
