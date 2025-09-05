import { spawn } from 'node:child_process';
import { RunResult } from './types/runTypes';



export function runBinary(
  binPath: string,
  args: string[],
  opts?: { timeout?: number; signal?: AbortSignal }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
  });
}
