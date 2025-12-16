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
  let currentLine = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith('::') || trimmed.startsWith('@') || !trimmed) {
      continue
    }

    // Check if this line starts the curl.exe command
    if (trimmed.includes('curl.exe') || trimmed.includes('"%~dp0curl.exe"')) {
      inCurlCommand = true
      // Extract everything after curl.exe, removing line continuation if present
      let afterCurl = trimmed.replace(/.*?"%~dp0curl\.exe"|.*?curl\.exe/, '').trim()
      // Remove line continuation character if present
      if (afterCurl.endsWith('^')) {
        afterCurl = afterCurl.slice(0, -1).trim()
      }
      if (afterCurl) {
        currentLine = afterCurl
      }
      continue
    }

    // If we're in the curl command section
    if (inCurlCommand) {
      // Check if we hit %* (end of bat arguments) - process before breaking
      if (trimmed.includes('%*')) {
        // Process any accumulated line before breaking
        if (currentLine) {
          const extractedArgs = parseBatArguments(currentLine)
          args.push(...extractedArgs)
          currentLine = ''
        }
        break
      }

      // Check for line continuation (^ at end of line)
      const hasContinuation = trimmed.endsWith('^')
      const lineContent = hasContinuation ? trimmed.slice(0, -1).trim() : trimmed

      if (lineContent) {
        currentLine += (currentLine ? ' ' : '') + lineContent
      }

      // If no continuation, process the accumulated line
      if (!hasContinuation) {
        if (currentLine) {
          const extractedArgs = parseBatArguments(currentLine)
          args.push(...extractedArgs)
          currentLine = ''
        }
      }
    }
  }

  return args
}

/**
 * Parses a line of bat file arguments into individual curl arguments
 * Handles quoted strings and argument pairs like -H "value"
 */
function parseBatArguments(line: string): string[] {
  const args: string[] = []
  let i = 0
  let currentArg = ''
  let inQuotes = false
  let quoteChar = ''

  while (i < line.length) {
    const char = line[i]

    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
        currentArg += char
      } else if (char === quoteChar) {
        inQuotes = false
        currentArg += char
        quoteChar = ''
      } else {
        currentArg += char
      }
    } else if (char === ' ' && !inQuotes) {
      if (currentArg.trim()) {
        args.push(currentArg.trim())
        currentArg = ''
      }
    } else {
      currentArg += char
    }
    i++
  }

  if (currentArg.trim()) {
    args.push(currentArg.trim())
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

    // Check if this is a header flag
    if (arg === '-H' && i + 1 < args.length) {
      const headerValue = args[i + 1]
      // Extract header name (case-insensitive)
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
      i += 2
      continue
    }

    // Check if it's a combined -H "Header: value" format
    if (arg.startsWith('-H')) {
      const headerMatch = arg.match(/^["']?([^:]+):/i)
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
function filterConflictingHeaders(
  batArgs: string[],
  userHeaderNames: Set<string>
): string[] {
  const filtered: string[] = []
  let i = 0

  while (i < batArgs.length) {
    const arg = batArgs[i]

    // Check if this is a header flag
    if (arg === '-H' && i + 1 < batArgs.length) {
      const headerValue = batArgs[i + 1]
      // Extract header name (case-insensitive)
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)

      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()

        // If user provided this header, skip it (remove from .bat)
        if (userHeaderNames.has(headerName)) {
          i += 2 // Skip both -H and the header value
          continue
        }
      }

      // Keep this header
      filtered.push(arg)
      i++
      continue
    }

    // Check if it's a combined -H "Header: value" format
    if (arg.startsWith('-H')) {
      const headerMatch = arg.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        // If user provided this header, skip it
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
    // On Windows, .bat files need shell: true to execute properly
    const isWindows = process.platform === 'win32'

    // Remove any existing quotes first to properly detect .bat files
    // This handles cases where paths are incorrectly quoted before being passed in
    // Use two separate replacements to ensure all leading and trailing quotes are removed
    const cleanPath = binPath.replace(/^["']+/, '').replace(/["']+$/, '')
    const isBatFile = cleanPath.toLowerCase().endsWith('.bat')

    let actualBinPath = cleanPath
    let finalArgs = args
    let needsShell = false

    // Handle .bat files by extracting arguments and using curl.exe directly
    if (isWindows && isBatFile) {
      try {
        // Use Windows path handling for proper path resolution
        const batDir = path.win32.dirname(cleanPath)
        const searchedPaths: string[] = []
        let curlExePath: string | null = null

        // Try 1: Same directory as .bat file
        let candidatePath = path.win32.join(batDir, 'curl.exe')
        searchedPaths.push(candidatePath)
        if (fs.existsSync(candidatePath)) {
          curlExePath = candidatePath
        }

        // Try 2: Parent directory (for bin/ subdirectory structure)
        if (!curlExePath) {
          const parentDir = path.win32.dirname(batDir)
          candidatePath = path.win32.join(parentDir, 'curl.exe')
          searchedPaths.push(candidatePath)
          if (fs.existsSync(candidatePath)) {
            curlExePath = candidatePath
          }
        }

        // Try 3: Case-insensitive search in the same directory
        if (!curlExePath) {
          try {
            const files = fs.readdirSync(batDir)
            const curlExe = files.find(f => f.toLowerCase() === 'curl.exe')
            if (curlExe) {
              curlExePath = path.win32.join(batDir, curlExe)
            }
          } catch (dirError) {
            // Directory read failed, continue
          }
        }

        if (curlExePath && fs.existsSync(curlExePath)) {
          // Extract user-provided headers from args
          const userHeaderNames = extractHeaderNamesFromArgs(args)

          // Parse .bat file to extract arguments
          const batArgs = parseBatFile(cleanPath)

          // Filter out headers from .bat that conflict with user headers
          const filteredBatArgs = filterConflictingHeaders(batArgs, userHeaderNames)

          // Combine: bat args first, then user args (user args override bat defaults)
          finalArgs = [...filteredBatArgs, ...args]

          // Use curl.exe directly instead of .bat file
          actualBinPath = curlExePath
          needsShell = false // .exe files don't need shell
        } else {
          // Fallback: curl.exe not found, use .bat file (with potential duplicate header issue)
          console.warn(
            `[cuimp] curl.exe not found. Searched in: ${searchedPaths.join(', ')}. Falling back to .bat file. This may cause duplicate headers.`
          )
          needsShell = true
        }
      } catch (error) {
        // If parsing fails, fallback to using .bat file
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`[cuimp] Failed to parse .bat file, using fallback: ${errorMsg}`)
        needsShell = true
      }
    }

    // On Windows, add --cacert argument if CA bundle exists and not already specified
    // This fixes SSL certificate verification issues
    if (isWindows && !finalArgs.includes('--cacert') && !finalArgs.includes('-k')) {
      const binDir = path.dirname(actualBinPath)
      const caBundlePath = path.join(binDir, 'curl-ca-bundle.crt')
      if (fs.existsSync(caBundlePath)) {
        // Prepend --cacert to args so it's processed before the URL
        finalArgs = ['--cacert', caBundlePath, ...finalArgs]
      }
    }

    // When using shell: true on Windows, normalize the path first
    // This handles forward slashes, relative paths, and ensures proper formatting
    if (needsShell) {
      // Normalize the path: resolve relative paths and normalize separators
      let normalizedPath = actualBinPath

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

      actualBinPath = normalizedPath
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
