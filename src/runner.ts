import { spawn } from 'node:child_process'
import { RunResult } from './types/runTypes'
import { CurlExitCode } from './types/curlErrors'
import path from 'node:path'
import fs from 'node:fs'

export function runBinary(
  binPath: string,
  args: string[],
  opts?: { timeout?: number; signal?: AbortSignal }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // On Windows, .bat files need shell: true to execute properly
    const isWindows = process.platform === 'win32'
    const isBatFile = binPath.toLowerCase().endsWith('.bat')
    const needsShell = isWindows && isBatFile

    // On Windows, add --cacert argument if CA bundle exists and not already specified
    // This fixes SSL certificate verification issues
    let finalArgs = args
    if (isWindows && !args.includes('--cacert') && !args.includes('-k')) {
      const binDir = path.dirname(binPath)
      const caBundlePath = path.join(binDir, 'curl-ca-bundle.crt')
      if (fs.existsSync(caBundlePath)) {
        // Prepend --cacert to args so it's processed before the URL
        finalArgs = ['--cacert', caBundlePath, ...args]
      }
    }

    // When using shell: true on Windows, we need to properly quote arguments
    // to prevent & and other shell metacharacters from being interpreted
    if (needsShell) {
      finalArgs = finalArgs.map(arg => {
        // If arg contains shell metacharacters, wrap in double quotes
        // and escape any existing double quotes
        if (/[&|<>^"\s]/.test(arg)) {
          return `"${arg.replace(/"/g, '\\"')}"`
        }
        return arg
      })
    }

    if (needsShell && /[&|<>^"\s]/.test(binPath)){
      binPath = binPath.replace(/"/g, '\\"')
      binPath = `"${binPath}"`
    }

    const child = spawn(binPath, finalArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: needsShell,
    })

    let killedByTimeout = false
    let killedByAbort = false
    let t: NodeJS.Timeout | undefined

    if (opts?.timeout && opts.timeout > 0) {
      t = setTimeout(() => {
        killedByTimeout = true
        child.kill('SIGKILL')
      }, opts.timeout)
    }

    const out: Buffer[] = []
    const err: Buffer[] = []

    if (opts?.signal) {
      if (opts.signal.aborted) {
        killedByAbort = true
        child.kill('SIGKILL')
      } else {
        const onAbort = () => {
          killedByAbort = true
          child.kill('SIGKILL')
        }
        opts.signal.addEventListener('abort', onAbort, { once: true })
        child.on('exit', () => opts.signal?.removeEventListener('abort', onAbort))
      }
    }

    child.stdout.on('data', (c: Uint8Array) => out.push(Buffer.from(c)))
    child.stderr.on('data', (c: Uint8Array) => err.push(Buffer.from(c)))

    child.on('error', e => {
      if (t) clearTimeout(t)
      reject(e)
    })

    child.on('close', code => {
      if (t) clearTimeout(t)
      if (killedByTimeout) {
        return reject(new Error(`Request timed out after ${opts?.timeout} ms`))
      }
      if (killedByAbort) {
        return reject(new Error('Request aborted'))
      }
      resolve({
        exitCode: code as CurlExitCode | null,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err),
      })
    })
  })
}
