import { spawn } from 'node:child_process'
import { RunResult } from './types/runTypes'
import { CurlExitCode } from './types/curlErrors'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Parses a .bat file to extract curl arguments
 * Handles line continuations (^) and extracts all arguments after curl.exe
 * @param batFilePath Path to the .bat file
 * @returns Array of curl arguments
 */
function parseBatFile(batFilePath: string): string[] {
  const content = fs.readFileSync(batFilePath, 'utf8')
  const lines = content.split(/\r?\n/)

  const args: string[] = []
  let inCurlCommand = false
  let accumulated = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      continue
    }

    // Skip comments (::) but allow @-prefixed curl commands
    if (trimmed.startsWith('::')) {
      continue
    }

    // Skip @echo and other @ commands, but allow @-prefixed curl commands
    if (
      trimmed.startsWith('@') &&
      !trimmed.includes('curl.exe') &&
      !trimmed.includes('"%~dp0curl.exe"')
    ) {
      continue
    }

    // Check if this line starts the curl.exe command (may be prefixed with @)
    if (trimmed.includes('curl.exe') || trimmed.includes('"%~dp0curl.exe"')) {
      inCurlCommand = true
      // Extract everything after curl.exe (handle @ prefix)
      const match = line.match(/(?:.*?"%~dp0curl\.exe"|.*?curl\.exe)\s*(.*)$/)
      if (match && match[1]) {
        accumulated = match[1].replace(/\s*\^\s*$/, '')
      } else {
        accumulated = ''
      }
      continue
    }

    if (inCurlCommand) {
      // Check for %*
      if (trimmed.includes('%*')) {
        if (accumulated.trim()) {
          const parsed = parseBatArguments(accumulated.trim())
          args.push(...parsed)
        }
        break
      }

      // Check for line continuation
      const hasContinuation = line.trimEnd().endsWith('^')
      let lineContent = line.replace(/^\s+/, '') // Remove leading spaces

      if (hasContinuation) {
        lineContent = lineContent.replace(/\s*\^\s*$/, '')
      } else {
        lineContent = lineContent.trim()
      }

      if (lineContent) {
        const quoteCount = (accumulated.match(/"/g) || []).length
        const inQuotes = quoteCount % 2 === 1

        if (accumulated) {
          if (inQuotes) {
            accumulated += lineContent
          } else {
            accumulated += ' ' + lineContent
          }
        } else {
          accumulated = lineContent
        }
      }

      if (!hasContinuation) {
        if (accumulated.trim()) {
          const parsed = parseBatArguments(accumulated.trim())
          args.push(...parsed)
          accumulated = ''
        }
      }
    }
  }

  // Process remaining
  if (accumulated.trim()) {
    const parsed = parseBatArguments(accumulated.trim())
    args.push(...parsed)
  }

  return args
}

/**
 * Parses a line of bat file arguments into individual curl arguments
 * Handles quoted strings and argument pairs like -H "value"
 */
function parseBatArguments(line: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
      } else if (char === quoteChar) {
        inQuotes = false
        quoteChar = ''
      } else {
        current += char
      }
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current)
        current = ''
      }
      while (i + 1 < line.length && line[i + 1] === ' ') {
        i++
      }
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

/**
 * Extracts header names from curl arguments
 * Looks for -H flags and extracts the header name from the value
 * @param args Array of curl arguments
 * @returns Set of header names (lowercase)
 */
function extractHeaderNamesFromArgs(args: string[]): Set<string> {
  const headerNames = new Set<string>()
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    // Check for -H or --header flag with separate value
    if ((arg === '-H' || arg === '--header') && i + 1 < args.length) {
      const headerValue = args[i + 1]
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
      i += 2
      continue
    }

    // Check for combined format: -HAccept: value or --headerAccept: value
    if (arg.startsWith('-H') && arg.length > 2) {
      // Combined format: extract everything after -H
      const afterH = arg.substring(2) // Remove -H prefix
      const headerMatch = afterH.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
    } else if (arg.startsWith('--header') && arg.length > 8) {
      // Combined format with --header: extract everything after --header
      const afterHeader = arg.substring(8) // Remove --header prefix
      const headerMatch = afterHeader.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
    }

    i++
  }

  return headerNames
}

/**
 * Filters out headers from batArgs that match user-provided headers
 * @param batArgs Arguments extracted from .bat file
 * @param userHeaderNames Set of header names provided by the user (lowercase)
 * @returns Filtered arguments without conflicting headers
 */
function filterConflictingHeaders(batArgs: string[], userHeaderNames: Set<string>): string[] {
  const filtered: string[] = []
  let i = 0

  while (i < batArgs.length) {
    const arg = batArgs[i]

    // Check for -H or --header flag with separate value
    if ((arg === '-H' || arg === '--header') && i + 1 < batArgs.length) {
      const headerValue = batArgs[i + 1]
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)

      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()

        if (userHeaderNames.has(headerName)) {
          i += 2
          continue
        }
      }

      filtered.push(arg)
      i++
      continue
    }

    // Check for combined format: -HAccept: value or --headerAccept: value
    if (arg.startsWith('-H') && arg.length > 2) {
      // Combined format: extract everything after -H
      const afterH = arg.substring(2) // Remove -H prefix
      const headerMatch = afterH.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        if (userHeaderNames.has(headerName)) {
          i++
          continue
        }
      }
    } else if (arg.startsWith('--header') && arg.length > 8) {
      // Combined format with --header: extract everything after --header
      const afterHeader = arg.substring(8) // Remove --header prefix
      const headerMatch = afterHeader.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        if (userHeaderNames.has(headerName)) {
          i++
          continue
        }
      }
    }

    filtered.push(arg)
    i++
  }

  return filtered
}

export function runBinary(
  binPath: string,
  args: string[],
  opts?: { timeout?: number; signal?: AbortSignal; stdin?: string | Buffer }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const cleanPath = binPath.replace(/^["']+/, '').replace(/["']+$/, '')
    const isBatFile = cleanPath.toLowerCase().endsWith('.bat')

    let actualBinPath = cleanPath
    let finalArgs = args
    let needsShell = false

    if (isWindows && isBatFile) {
      try {
        const batDir = path.win32.dirname(cleanPath)
        const searchedPaths: string[] = []
        let curlExePath: string | null = null

        let candidatePath = path.win32.join(batDir, 'curl.exe')
        searchedPaths.push(candidatePath)
        if (fs.existsSync(candidatePath)) {
          curlExePath = candidatePath
        }

        if (!curlExePath) {
          const parentDir = path.win32.dirname(batDir)
          candidatePath = path.win32.join(parentDir, 'curl.exe')
          searchedPaths.push(candidatePath)
          if (fs.existsSync(candidatePath)) {
            curlExePath = candidatePath
          }
        }

        if (!curlExePath) {
          try {
            const files = fs.readdirSync(batDir)
            const curlExe = files.find(f => f.toLowerCase() === 'curl.exe')
            if (curlExe) {
              curlExePath = path.win32.join(batDir, curlExe)
            }
          } catch {
            // Directory read failed
          }
        }

        if (curlExePath && fs.existsSync(curlExePath)) {
          const userHeaderNames = extractHeaderNamesFromArgs(args)
          const batArgs = parseBatFile(cleanPath)
          const filteredBatArgs = filterConflictingHeaders(batArgs, userHeaderNames)
          finalArgs = [...filteredBatArgs, ...args]
          actualBinPath = curlExePath
          needsShell = false
        } else {
          console.warn(
            `[cuimp] curl.exe not found. Searched in: ${searchedPaths.join(', ')}. Falling back to .bat file. This may cause duplicate headers.`
          )
          needsShell = true
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`[cuimp] Failed to parse .bat file, using fallback: ${errorMsg}`)
        needsShell = true
      }
    }

    if (isWindows && !finalArgs.includes('--cacert') && !finalArgs.includes('-k')) {
      const binDir = path.dirname(actualBinPath)
      const caBundlePath = path.join(binDir, 'curl-ca-bundle.crt')
      if (fs.existsSync(caBundlePath)) {
        finalArgs = ['--cacert', caBundlePath, ...finalArgs]
      }
    }

    if (needsShell) {
      let normalizedPath = actualBinPath
      const isWindowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(normalizedPath)
      const hasPathSeparator = /[\\/]/.test(normalizedPath)

      if (!isWindowsAbsolutePath && !path.isAbsolute(normalizedPath) && hasPathSeparator) {
        normalizedPath = path.resolve(normalizedPath)
      } else if (isWindowsAbsolutePath || path.isAbsolute(normalizedPath)) {
        if (isWindowsAbsolutePath) {
          normalizedPath = path.win32.normalize(normalizedPath)
        } else {
          normalizedPath = path.normalize(normalizedPath)
        }
      }

      actualBinPath = normalizedPath
    }
    if (needsShell) {
      finalArgs = finalArgs.map(arg => {
        if (/[&|<>^"%!\s]/.test(arg)) {
          const escaped = arg.replace(/"/g, '""')
          return `"${escaped}"`
        }
        return arg
      })
    }

    if (needsShell && /[&|<>^"%!\s]/.test(actualBinPath)) {
      actualBinPath = actualBinPath.replace(/"/g, '""')
      actualBinPath = `"${actualBinPath}"`
    }

    const child = spawn(actualBinPath, finalArgs, {
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
