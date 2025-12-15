import { spawn } from 'node:child_process'
import { RunResult } from './types/runTypes'
import { CurlExitCode } from './types/curlErrors'
import path from 'node:path'
import fs from 'node:fs'

export function runBinary(
  binPath: string,
  args: string[],
  opts?: { timeout?: number; signal?: AbortSignal; stdin?: string | Buffer }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // On Windows, .bat files need shell: true to execute properly
    const isWindows = process.platform === 'win32'

    // Remove any existing quotes first to properly detect .bat files
    // This handles cases where paths are incorrectly quoted before being passed in
    // Use two separate replacements to ensure all leading and trailing quotes are removed
    const cleanPath = binPath.replace(/^["']+/, '').replace(/["']+$/, '')
    const isBatFile = cleanPath.toLowerCase().endsWith('.bat')
    const needsShell = isWindows && isBatFile

    // On Windows, add --cacert argument if CA bundle exists and not already specified
    // This fixes SSL certificate verification issues
    let finalArgs = args
    if (isWindows && !args.includes('--cacert') && !args.includes('-k')) {
      const binDir = path.dirname(cleanPath)
      const caBundlePath = path.join(binDir, 'curl-ca-bundle.crt')
      if (fs.existsSync(caBundlePath)) {
        // Prepend --cacert to args so it's processed before the URL
        finalArgs = ['--cacert', caBundlePath, ...args]
      }
    }

    // When using shell: true on Windows, normalize the path first
    // This handles forward slashes, relative paths, and ensures proper formatting
    if (needsShell) {
      // Normalize the path: resolve relative paths and normalize separators
      let normalizedPath = cleanPath

      // Check if it's a Windows absolute path (drive letter like D:\ or D:/)
      // This check works even when running on non-Windows systems
      const isWindowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(normalizedPath)

      // Only resolve relative paths that contain directory separators
      // Bare filenames (like "curl_edge101.bat") should be left for PATH resolution
      const hasPathSeparator = /[\\/]/.test(normalizedPath)

      if (!isWindowsAbsolutePath && !path.isAbsolute(normalizedPath) && hasPathSeparator) {
        // This is a relative path with directory separators (e.g., "./binaries/curl_edge101.bat")
        // Resolve it to an absolute path
        normalizedPath = path.resolve(normalizedPath)
      } else if (isWindowsAbsolutePath || path.isAbsolute(normalizedPath)) {
        // Normalize absolute paths (handles forward/back slashes on Windows)
        // Use path.win32.normalize for Windows paths to ensure proper handling
        if (isWindowsAbsolutePath) {
          normalizedPath = path.win32.normalize(normalizedPath)
        } else {
          normalizedPath = path.normalize(normalizedPath)
        }
      }
      // If it's a bare filename (no path separators), leave it as-is for PATH resolution

      binPath = normalizedPath
    }

    // - & | < > ^ : command operators and redirection
    // - " : quotes (escaped as "" inside quotes)
    // - % ! : variable expansion (even inside quotes if enabled)
    // - \s : whitespace (path/argument separators)
    if (needsShell) {
      finalArgs = finalArgs.map(arg => {
        if (/[&|<>^"%!\s]/.test(arg)) {
          const escaped = arg.replace(/"/g, '""')
          return `"${escaped}"`
        }
        return arg
      })
    }

    if (needsShell && /[&|<>^"%!\s]/.test(binPath)) {
      binPath = binPath.replace(/"/g, '""')
      binPath = `"${binPath}"`
    }

    const child = spawn(binPath, finalArgs, {
      stdio: [opts?.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: needsShell,
    })

    // If stdin data is provided, write it to the process
    if (opts?.stdin && child.stdin) {
      const stdinData = typeof opts.stdin === 'string' ? Buffer.from(opts.stdin) : opts.stdin
      child.stdin.write(stdinData)
      child.stdin.end()
    }

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

    child.stdout?.on('data', (c: Uint8Array) => out.push(Buffer.from(c)))
    child.stderr?.on('data', (c: Uint8Array) => err.push(Buffer.from(c)))

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
