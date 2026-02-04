import { BROWSER_LIST, ARCHITECTURE_LIST, PLATFORM_LIST } from '../constants/cuimpConstants'
import { HTTP_STATUS_MAP } from '../constants/httpConstants'
import { CuimpDescriptor, BinaryInfo, Logger } from '../types/cuimpTypes'
import { getLatestRelease } from './connector'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { extract } from 'tar'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

/**
 * Detects if the system uses musl libc (Alpine Linux, etc.) instead of glibc
 * This is important for downloading the correct binary
 */
function isMuslLibc(): boolean {
  if (process.platform !== 'linux') {
    return false
  }

  try {
    // Method 1: Check /etc/os-release for Alpine
    if (fs.existsSync('/etc/os-release')) {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8')
      if (osRelease.toLowerCase().includes('alpine')) {
        return true
      }
    }

    // Method 2: Check if /lib/ld-musl-* exists (musl's dynamic linker)
    const libDir = fs.existsSync('/lib') ? fs.readdirSync('/lib') : []
    if (libDir.some(file => file.startsWith('ld-musl'))) {
      return true
    }

    // Method 3: Check ldd version output
    try {
      const lddOutput = execSync('ldd --version 2>&1', { encoding: 'utf8', timeout: 5000 })
      if (lddOutput.toLowerCase().includes('musl')) {
        return true
      }
    } catch {
      // ldd might not be available or might fail, continue with other checks
    }

    // Method 4: Check if /etc/alpine-release exists
    if (fs.existsSync('/etc/alpine-release')) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Get the package directory path that works in both CommonJS and ES modules
 */
function getPackageDir(): string {
  try {
    // ES modules: use import.meta.url
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      // In ES modules, this file is in dist/helpers, so go up to package root
      return path.resolve(__dirname, '../../')
    }
  } catch (error) {
    // Fallback for CommonJS
  }

  // CommonJS: use __dirname
  if (typeof __dirname !== 'undefined') {
    // In CommonJS, this file is in dist/helpers, so go up to package root
    return path.resolve(__dirname, '../../')
  }

  // Ultimate fallback: try to resolve package.json
  try {
    const packageJsonPath = require.resolve('../../package.json')
    return path.dirname(packageJsonPath)
  } catch (error) {
    // Last resort: assume current working directory
    return process.cwd()
  }
}

// Binary search paths in order of preference
const BINARY_SEARCH_PATHS = [
  '/usr/local/bin/',
  '/usr/bin/',
  '/bin/',
  '/sbin/',
  '/usr/sbin/',
  '/usr/local/sbin/',
  // Package binaries directory (in node_modules) - will be set dynamically
  // This will be resolved at runtime using require.resolve
  './binaries/', // Fallback: dedicated folder for downloaded binaries
  './',
  '../',
  '../../',
  '../../../',
  '../../../../',
  '../../../../../',
  '../../../../../../',
  '../../../../../../../',
  '../../../../../../../../',
  '../../../../../../../../../',
]

// Binary name patterns to search for
// Windows binaries can be .exe or .bat files
const BINARY_PATTERNS = [
  'curl-impersonate',
  'curl-impersonate.exe',
  'curl-impersonate.bat',
  'curl_chrome*.exe',
  'curl_chrome*.bat',
  'curl_chrome*',
  'curl_firefox*.exe',
  'curl_firefox*.bat',
  'curl_firefox*',
  'curl_edge*.exe',
  'curl_edge*.bat',
  'curl_edge*',
  'curl_safari*.exe',
  'curl_safari*.bat',
  'curl_safari*',
]

interface DownloadResult {
  binaryPath: string
  version: string
}

/**
 * Extracts version number from filename
 * Examples: "curl_chrome136" -> 136, "curl_firefox120" -> 120
 */
const extractVersionNumber = (filename: string): number => {
  const match = filename.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Validates browser, architecture, and platform parameters
 */
const validateParameters = (browser: string, architecture: string, platform: string): void => {
  if (!BROWSER_LIST.includes(browser)) {
    throw new Error(
      `Unsupported browser: ${browser}. Supported browsers: ${BROWSER_LIST.join(', ')}`
    )
  }

  if (!ARCHITECTURE_LIST.includes(architecture)) {
    throw new Error(
      `Unsupported architecture: ${architecture}. Supported architectures: ${ARCHITECTURE_LIST.join(', ')}`
    )
  }

  if (!PLATFORM_LIST.includes(platform)) {
    throw new Error(
      `Unsupported platform: ${platform}. Supported platforms: ${PLATFORM_LIST.join(', ')}`
    )
  }
}

/**
 * Searches for existing curl-impersonate binary with a specific version
 */
const findBinaryWithVersion = (browser: string, version: string): string | null => {
  // Get the user's home directory for binaries (primary location)
  const homeDir = os.homedir()
  const homeBinariesDir = path.resolve(homeDir, '.cuimp', 'binaries')

  // Get the package binaries directory dynamically (fallback)
  const packageDir = getPackageDir()
  const packageBinariesDir = path.resolve(packageDir, 'cuimp/binaries')

  // On Windows, binaries are extracted to a 'bin' subdirectory
  const isWindows = process.platform === 'win32'
  const searchPaths = [
    homeBinariesDir,
    ...(isWindows ? [path.resolve(homeBinariesDir, 'bin')] : []),
    packageBinariesDir,
    ...(isWindows ? [path.resolve(packageBinariesDir, 'bin')] : []),
    ...BINARY_SEARCH_PATHS,
  ]

  // Look for browser-specific binary with version (e.g., curl_chrome136)
  const versionPattern = `curl_${browser}${version}`
  const versionPatterns = isWindows
    ? [`${versionPattern}.exe`, `${versionPattern}.bat`, versionPattern]
    : [versionPattern]

  for (const searchPath of searchPaths) {
    for (const pattern of versionPatterns) {
      try {
        const fullPath = path.join(searchPath, pattern)
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return fullPath
        }
      } catch (error) {
        // Continue searching if directory doesn't exist or is not accessible
        continue
      }
    }
  }

  return null
}

/**
 * Searches for existing curl-impersonate binary in system paths
 */
const findExistingBinary = (browser: string = ''): string | null => {
  // Filter patterns based on browser if specified
  // Also filter out Windows-specific patterns (.bat, .exe) on non-Windows systems
  const isWindows = process.platform === 'win32'
  const patternsToSearch = (
    browser
      ? BINARY_PATTERNS.filter(pattern => {
          if (browser === 'chrome')
            return pattern.includes('chrome') || pattern === 'curl-impersonate'
          if (browser === 'firefox')
            return pattern.includes('firefox') || pattern === 'curl-impersonate'
          if (browser === 'edge') return pattern.includes('edge') || pattern === 'curl-impersonate'
          if (browser === 'safari')
            return pattern.includes('safari') || pattern === 'curl-impersonate'
          return pattern === 'curl-impersonate' // fallback to generic
        }).sort((a, b) => {
          // Prioritize browser-specific patterns over generic ones
          const aIsGeneric = a === 'curl-impersonate' || a === 'curl-impersonate.exe'
          const bIsGeneric = b === 'curl-impersonate' || b === 'curl-impersonate.exe'
          if (aIsGeneric && !bIsGeneric) return 1 // generic comes after specific
          if (!aIsGeneric && bIsGeneric) return -1 // specific comes before generic
          return 0
        })
      : BINARY_PATTERNS
  ).filter(pattern => {
    // On non-Windows systems, exclude .bat and .exe patterns
    if (!isWindows) {
      return !pattern.endsWith('.bat') && !pattern.endsWith('.exe')
    }
    return true
  })

  // Get the user's home directory for binaries (primary location)
  const homeDir = os.homedir()
  const homeBinariesDir = path.resolve(homeDir, '.cuimp', 'binaries')

  // Get the package binaries directory dynamically (fallback)
  const packageDir = getPackageDir()
  const packageBinariesDir = path.resolve(packageDir, 'cuimp/binaries')

  // On Windows, binaries are extracted to a 'bin' subdirectory
  // Create search paths including both directories and Windows-specific bin subdirectory
  const searchPaths = [
    homeBinariesDir,
    ...(isWindows ? [path.resolve(homeBinariesDir, 'bin')] : []),
    packageBinariesDir,
    ...(isWindows ? [path.resolve(packageBinariesDir, 'bin')] : []),
    ...BINARY_SEARCH_PATHS,
  ]

  for (const searchPath of searchPaths) {
    for (const pattern of patternsToSearch) {
      try {
        // Handle glob patterns
        if (pattern.includes('*')) {
          const files = fs.readdirSync(searchPath)
          const matchingFiles = files.filter(file => {
            // Skip .bat files on non-Windows systems
            if (!isWindows && file.toLowerCase().endsWith('.bat')) {
              return false
            }
            const regex = new RegExp(pattern.replace('*', '.*'))
            return regex.test(file)
          })

          if (matchingFiles.length > 0) {
            // If multiple matches, find the highest version
            if (matchingFiles.length > 1) {
              const sortedFiles = matchingFiles.sort((a, b) => {
                // Extract version numbers from filenames
                const versionA = extractVersionNumber(a)
                const versionB = extractVersionNumber(b)
                return versionB - versionA // Sort in descending order (highest first)
              })
              const bestMatch = sortedFiles[0]
              const fullPath = path.join(searchPath, bestMatch)
              // Skip .bat files on non-Windows systems
              if (!isWindows && fullPath.toLowerCase().endsWith('.bat')) {
                continue
              }
              if (fs.statSync(fullPath).isFile()) {
                return fullPath
              }
            } else {
              // Single match
              const fullPath = path.join(searchPath, matchingFiles[0])
              // Skip .bat files on non-Windows systems
              if (!isWindows && fullPath.toLowerCase().endsWith('.bat')) {
                continue
              }
              if (fs.statSync(fullPath).isFile()) {
                return fullPath
              }
            }
          }
        } else {
          const fullPath = path.join(searchPath, pattern)
          // Skip .bat files on non-Windows systems
          if (!isWindows && fullPath.toLowerCase().endsWith('.bat')) {
            continue
          }
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return fullPath
          }
        }
      } catch (error) {
        // Continue searching if directory doesn't exist or is not accessible
        continue
      }
    }
  }
  return null
}

/**
 * Downloads and extracts curl-impersonate binary
 */
const downloadAndExtractBinary = async (
  browser: string,
  architecture: string,
  platform: string,
  version: string,
  logger: Logger
): Promise<DownloadResult> => {
  try {
    // Get latest release info
    const latestVersion: string = await getLatestRelease()
    const actualVersion: string =
      version === 'latest' ? latestVersion.replace(/^v/, '') : version.replace(/^v/, '')

    // Construct download URL with correct naming convention
    let assetName: string
    if (platform === 'linux') {
      // Detect if running on musl (Alpine) or glibc
      const isMusl = isMuslLibc()

      // Linux uses specific naming: x86_64-linux-gnu, aarch64-linux-musl, arm-linux-gnueabihf, etc.
      let specification: string
      let linuxArch: string

      if (isMusl) {
        // musl builds are available for x64 and arm64
        specification = 'musl'
        linuxArch = architecture === 'x64' ? 'x86_64' : 'aarch64'
      } else if (architecture === 'arm') {
        specification = 'gnueabihf'
        linuxArch = 'arm'
      } else {
        specification = 'gnu'
        linuxArch = architecture === 'x64' ? 'x86_64' : 'aarch64'
      }

      assetName = `curl-impersonate-${latestVersion}.${linuxArch}-linux-${specification}.tar.gz`
    } else if (platform === 'macos') {
      // macos uses specific naming: x86_64-macos, arm64-macos, etc.
      const macosArch = architecture === 'x64' ? 'x86_64' : 'arm64'
      assetName = `curl-impersonate-${latestVersion}.${macosArch}-macos.tar.gz`
    } else if (platform === 'windows') {
      // Windows uses libcurl-impersonate prefix and win32 suffix: x86_64-win32, arm64-win32, etc.
      const windowsArch = architecture === 'x64' ? 'x86_64' : 'arm64'
      assetName = `libcurl-impersonate-${latestVersion}.${windowsArch}-win32.tar.gz`
    } else {
      // Other platforms use the original naming
      assetName = `curl-impersonate-${latestVersion}.${architecture}-${platform}.tar.gz`
    }
    const downloadUrl = `https://github.com/lexiforest/curl-impersonate/releases/download/${latestVersion}/${assetName}`

    // Download the binary
    logger.info(`Downloading ${downloadUrl}...`)
    const response = await fetch(downloadUrl)

    if (!response.ok) {
      throw new Error(`Failed to download binary: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Use user's home directory for binaries to avoid permission issues
    const homeDir = os.homedir()
    const binariesDir = path.resolve(homeDir, '.cuimp', 'binaries')

    // Create binaries directory if it doesn't exist
    if (!fs.existsSync(binariesDir)) {
      fs.mkdirSync(binariesDir, { recursive: true })
    }

    // Save to temporary file in the binaries directory
    const tempFileName = path.resolve(binariesDir, `${browser}-${architecture}-${platform}.tar.gz`)
    fs.writeFileSync(tempFileName, buffer)

    // Extract the binary to the binaries directory
    logger.info(`Extracting ${tempFileName} to ${binariesDir}...`)
    await extract({
      file: tempFileName,
      cwd: binariesDir,
    })

    // Clean up temporary file
    fs.unlinkSync(tempFileName)

    // On Windows, binaries are extracted to a 'bin' subdirectory
    // On other platforms, they're extracted directly to binariesDir
    const searchDirs =
      platform === 'windows' ? [path.resolve(binariesDir, 'bin'), binariesDir] : [binariesDir]

    // Binary name patterns to search for (Windows uses .exe or .bat extension)
    const binaryExtensions = platform === 'windows' ? ['.exe', '.bat', ''] : ['']
    const mainBinaryNames = binaryExtensions.map(ext => `curl-impersonate${ext}`)
    const browserSpecificPattern = `curl_${browser}*`

    let binaryPath: string | null = null

    // First, try to find the main binary (curl-impersonate)
    for (const searchDir of searchDirs) {
      if (!fs.existsSync(searchDir)) continue

      for (const mainBinaryName of mainBinaryNames) {
        const candidatePath = path.resolve(searchDir, mainBinaryName)
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          binaryPath = candidatePath
          break
        }
      }
      if (binaryPath) break
    }

    // If main binary not found, look for browser-specific binaries
    if (!binaryPath) {
      for (const searchDir of searchDirs) {
        if (!fs.existsSync(searchDir)) continue

        const files = fs.readdirSync(searchDir)
        const matchingFiles = files.filter(file => {
          const regex = new RegExp(browserSpecificPattern.replace('*', '.*'))
          return regex.test(file) && fs.statSync(path.resolve(searchDir, file)).isFile()
        })

        if (matchingFiles.length > 0) {
          // Use the highest version browser-specific binary
          const sortedFiles = matchingFiles.sort((a, b) => {
            const versionA = extractVersionNumber(a)
            const versionB = extractVersionNumber(b)
            return versionB - versionA // Sort in descending order (highest first)
          })
          const bestMatch = sortedFiles[0]
          binaryPath = path.resolve(searchDir, bestMatch)
          break
        }
      }
    }

    if (!binaryPath) {
      throw new Error(
        `Binary not found after extraction. Searched in: ${searchDirs.join(', ')}. ` +
          `Expected: curl-impersonate${platform === 'windows' ? '.exe' : ''} or curl_${browser}*`
      )
    }

    // Set executable permissions on the binary (chmod may not work on Windows, but it's safe to try)
    try {
      fs.chmodSync(binaryPath, 0o755)
    } catch (error) {
      // On Windows, chmod might fail, but that's okay - the file is still executable
      if (platform !== 'windows') {
        throw error
      }
    }

    // On Windows, download CA bundle if not present (required for SSL verification)
    if (platform === 'windows') {
      const binDir = path.dirname(binaryPath)
      const caBundlePath = path.join(binDir, 'curl-ca-bundle.crt')
      if (!fs.existsSync(caBundlePath)) {
        logger.info('Downloading CA certificate bundle for Windows...')
        try {
          const caResponse = await fetch('https://curl.se/ca/cacert.pem')
          if (caResponse.ok) {
            const caBundle = await caResponse.text()
            fs.writeFileSync(caBundlePath, caBundle)
            logger.info(`CA bundle saved to ${caBundlePath}`)
          } else {
            logger.warn('Failed to download CA bundle - SSL verification may fail')
          }
        } catch (caError) {
          logger.warn(
            `Failed to download CA bundle: ${caError instanceof Error ? caError.message : String(caError)}`
          )
        }
      }
    }

    return {
      binaryPath: binaryPath,
      version: actualVersion,
    }
  } catch (error) {
    throw new Error(
      `Failed to download and extract binary: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Determines the appropriate architecture and platform for the current system
 */
const getSystemInfo = (): { architecture: string; platform: string } => {
  const arch = process.arch
  const platform = process.platform

  // Map Node.js arch/platform to supported values
  const archMap: Record<string, string> = {
    x64: 'x64',
    x86_64: 'x64',
    arm: 'arm',
    arm64: 'arm64',
    aarch64: 'arm64',
  }

  const platformMap: Record<string, string> = {
    linux: 'linux',
    win32: 'windows',
    darwin: 'macos',
  }

  const mappedArch = archMap[arch]
  const mappedPlatform = platformMap[platform]

  if (!mappedArch) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }

  if (!mappedPlatform) {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  return {
    architecture: mappedArch,
    platform: mappedPlatform,
  }
}

/**
 * Main function to parse descriptor and get binary information
 */
export const parseDescriptor = async (
  descriptor: CuimpDescriptor,
  logger: Logger = console,
  autoDownload: boolean = true
): Promise<BinaryInfo> => {
  try {
    const { architecture, platform } = getSystemInfo()
    const browser = descriptor.browser || 'chrome'
    const version = descriptor.version || 'latest'
    const forceDownload = descriptor.forceDownload || false

    // Validate parameters
    validateParameters(browser, architecture, platform)

    // Check for existing binary unless forceDownload is enabled
    if (!forceDownload) {
      const existingBinary = findExistingBinary(browser)
      if (existingBinary) {
        // Extract browser version from filename (e.g., curl_chrome136 -> 136)
        // Note: This is the browser version, not the curl-impersonate release version
        const browserVersion = extractVersionNumber(path.basename(existingBinary)).toString()

        // Check if the existing binary version matches the requested version
        // If version is specified and doesn't match, check if correct version exists first
        if (version && version !== 'latest') {
          const requestedVersion = version.toString()
          if (browserVersion !== requestedVersion) {
            // First, check if the requested version binary already exists
            const requestedBinary = findBinaryWithVersion(browser, requestedVersion)
            if (requestedBinary) {
              logger.debug?.(
                `Found existing binary ${existingBinary} (version ${browserVersion}), but requested version ${requestedVersion}. Using existing ${requestedVersion} binary.`
              )
              const requestedBrowserVersion = extractVersionNumber(
                path.basename(requestedBinary)
              ).toString()
              return {
                binaryPath: requestedBinary,
                isDownloaded: false,
                version: requestedBrowserVersion || 'unknown',
              }
            }
            // Requested version doesn't exist, need to download
            logger.debug?.(
              `Found existing binary ${existingBinary} (version ${browserVersion}), but requested version ${requestedVersion} not found. Downloading correct version...`
            )
            // Continue to download section below - don't return here
          } else {
            // Version matches, use existing binary
            logger.debug?.(`Found existing binary: ${existingBinary} (version ${browserVersion})`)
            return {
              binaryPath: existingBinary,
              isDownloaded: false,
              version: browserVersion || 'unknown',
            }
          }
        } else {
          // No version specified or 'latest', accept any existing binary
          logger.debug?.(`Found existing binary: ${existingBinary} (version ${browserVersion})`)
          return {
            binaryPath: existingBinary,
            isDownloaded: false,
            version: browserVersion || 'unknown',
          }
        }
      }
    } else {
      logger.info('forceDownload enabled, skipping cache...')
    }

    // If autoDownload is disabled and binary not found, throw error
    // But allow download if forceDownload is explicitly set (user wants to force re-download)
    if (!autoDownload && !forceDownload) {
      throw new Error(
        `Binary not found for ${browser}${version && version !== 'latest' ? ` (version ${version})` : ''} on ${platform}-${architecture}. ` +
          `Set autoDownload: true in options to enable automatic download, or use the download() method to explicitly download.`
      )
    }

    // Download binary if not found, version mismatch, or forceDownload enabled
    logger.info(`Downloading curl-impersonate for ${browser} on ${platform}-${architecture}...`)

    const downloadResult = await downloadAndExtractBinary(
      browser,
      architecture,
      platform,
      version,
      logger
    )

    return {
      binaryPath: downloadResult.binaryPath,
      isDownloaded: true,
      version: downloadResult.version,
    }
  } catch (error) {
    throw new Error(
      `Failed to parse descriptor: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Legacy function for backward compatibility
 */
export const getLink = async (
  browser: string,
  version: string,
  architecture: string,
  platform: string,
  logger: Logger = console
): Promise<string> => {
  try {
    validateParameters(browser, architecture, platform)
    const result = await downloadAndExtractBinary(browser, architecture, platform, version, logger)
    return result.binaryPath
  } catch (error) {
    throw new Error(`Failed to get link: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Gets HTTP status text from status code, with fallback to provided text or status map
 */
export function getStatusText(status: number, providedText?: string): string {
  return providedText || HTTP_STATUS_MAP[status] || ''
}

export interface ParsedHttpHeaders {
  status: number
  statusText: string
  headers: Record<string, string>
}

export interface HttpResponseStreamParser {
  push(chunk: Buffer): Promise<void>
  finish(): Promise<void>
  response: ParsedHttpHeaders | null
}

/**
 * Parses a single HTTP header block (status line + headers).
 */
export function parseHttpHeaderBlock(headerText: string): ParsedHttpHeaders {
  const headerLines = headerText.split(/\r?\n/)
  const statusLine = headerLines.shift() || 'HTTP/1.1 200 OK'
  const m = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/)
  const status = m ? parseInt(m[1], 10) : 200
  const statusText = getStatusText(status, m?.[2])

  const headers: Record<string, string> = {}
  for (const line of headerLines) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const k = line.slice(0, idx).trim().toLowerCase()
      const v = line.slice(idx + 1).trim()
      headers[k] = v
    }
  }

  return { status, statusText, headers }
}

function findHeaderSeparator(buf: Buffer): {
  index: number
  length: number
} | null {
  const sep1 = buf.indexOf('\r\n\r\n')
  const sep2 = buf.indexOf('\n\n')

  if (sep1 === -1 && sep2 === -1) return null
  if (sep1 !== -1 && (sep2 === -1 || sep1 <= sep2)) {
    return { index: sep1, length: 4 }
  }
  return { index: sep2, length: 2 }
}

/**
 * Incrementally parses curl stdout (with -i) into headers and body chunks.
 */
/**
 * Checks if buffer starts with a valid HTTP status line pattern.
 * Requires: HTTP/ followed by version, space, and 3-digit status code.
 * Limits check to first 64 bytes to avoid false positives from body content.
 */
function isHttpStatusLine(buffer: Buffer): boolean {
  if (buffer.length < 13) return false // Minimum: "HTTP/1.1 200" = 13 bytes
  const checkLimit = Math.min(64, buffer.length)
  const preview = buffer.subarray(0, checkLimit).toString('utf8')
  // Match HTTP/version space 3digits (e.g., "HTTP/1.1 200", "HTTP/2 404")
  return /^HTTP\/\d(?:\.\d)?\s+\d{3}/.test(preview)
}

export function createHttpResponseStreamParser(
  handlers: {
    onHeaders?: (info: ParsedHttpHeaders) => void | Promise<void>
    onBody?: (chunk: Buffer) => void | Promise<void>
  } = {}
): HttpResponseStreamParser {
  let buffer = Buffer.alloc(0)
  let response: ParsedHttpHeaders | null = null
  let state: 'headers' | 'maybe-headers' | 'body' = 'headers'
  let headersEmitted = false

  const emitHeaders = async () => {
    if (!headersEmitted && response) {
      headersEmitted = true
      if (handlers.onHeaders) {
        await handlers.onHeaders(response)
      }
    }
  }

  const push = async (chunk: Buffer) => {
    if (chunk.length === 0) return

    // Optimize: In body mode, stream chunks directly without concatenating
    if (state === 'body') {
      if (handlers.onBody) {
        await handlers.onBody(chunk)
      }
      return
    }

    // For headers/maybe-headers states, we need to buffer to detect boundaries
    buffer = Buffer.concat([buffer, chunk])

    let processing = true
    while (processing) {
      if (state === 'maybe-headers') {
        // Need at least 13 bytes to check for HTTP status line (minimum: "HTTP/1.1 200")
        if (buffer.length < 13) {
          processing = false
          return
        }
        // Use stricter detection: require full status line pattern, not just "HTTP/"
        if (isHttpStatusLine(buffer)) {
          state = 'headers'
          continue
        }
        // Not a new header block, transition to body mode
        state = 'body'
        await emitHeaders()
        if (buffer.length > 0 && handlers.onBody) {
          await handlers.onBody(buffer)
        }
        buffer = Buffer.alloc(0)
        processing = false
        return
      }

      const sep = findHeaderSeparator(buffer)
      if (!sep) {
        processing = false
        return
      }

      const headerBuf = buffer.slice(0, sep.index)
      response = parseHttpHeaderBlock(headerBuf.toString('utf8'))
      buffer = buffer.slice(sep.index + sep.length)
      state = 'maybe-headers'
    }
  }

  const finish = async () => {
    if (!headersEmitted && response) {
      await emitHeaders()
    }

    if (response && buffer.length > 0) {
      if (state !== 'body') {
        state = 'body'
        await emitHeaders()
      }
      if (handlers.onBody) {
        await handlers.onBody(buffer)
      }
      buffer = Buffer.alloc(0)
    }
  }

  return {
    push,
    finish,
    get response() {
      return response
    },
  }
}

/**
 * Parses HTTP response from curl stdout buffer
 * Handles HTTP/1.1 and HTTP/2 formats, including redirects
 */
export function parseHttpResponse(stdoutBuf: Buffer): {
  status: number
  statusText: string
  headers: Record<string, string>
  body: Buffer
} {
  const httpMarker = Buffer.from('HTTP/')

  // Find all positions where HTTP responses start
  const httpStarts: number[] = []
  for (let i = 0; i <= stdoutBuf.length - 5; i++) {
    if (stdoutBuf.slice(i, i + 5).equals(httpMarker)) {
      httpStarts.push(i)
    }
  }

  if (httpStarts.length === 0) {
    const previewText = stdoutBuf.toString('utf8', 0, Math.min(500, stdoutBuf.length))
    throw new Error(`No HTTP response found:\n${previewText}`)
  }

  // Find header/body separator
  const separator1 = Buffer.from('\r\n\r\n')
  const separator2 = Buffer.from('\n\n')

  let lastHeaderEnd = 0
  let lastHeaderEndLength = 0

  for (const httpStart of httpStarts) {
    let found = false
    for (let i = httpStart; i < stdoutBuf.length; i++) {
      if (i + 4 <= stdoutBuf.length && stdoutBuf.slice(i, i + 4).equals(separator1)) {
        lastHeaderEnd = i
        lastHeaderEndLength = 4
        found = true
        break
      } else if (i + 2 <= stdoutBuf.length && stdoutBuf.slice(i, i + 2).equals(separator2)) {
        lastHeaderEnd = i
        lastHeaderEndLength = 2
        found = true
        break
      }
    }
    if (!found) {
      lastHeaderEnd = stdoutBuf.length
      lastHeaderEndLength = 0
    }
  }

  // Extract headers and body
  const headerBuf = stdoutBuf.slice(0, lastHeaderEnd)
  const rawBody = stdoutBuf.slice(lastHeaderEnd + lastHeaderEndLength)
  const headerText = headerBuf.toString('utf8')

  // Handle multiple header blocks (redirects)
  const httpBlocks = headerText.split(/(?=HTTP\/)/)
  const validBlocks = httpBlocks.filter(
    block => block.trim() && /^HTTP\/[1-3](?:\.\d)? \d{3}/.test(block.trim())
  )

  const lastBlock = validBlocks.length ? validBlocks[validBlocks.length - 1] : headerText
  const cleanBlock = lastBlock.replace(/\r?\n\r?\n$/, '')

  // Parse status + headers
  const headerLines = cleanBlock.split(/\r?\n/)
  const statusLine = headerLines.shift() || 'HTTP/1.1 200 OK'
  const m = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/)
  const status = m ? parseInt(m[1], 10) : 200
  const statusText = getStatusText(status, m?.[2])

  const headers: Record<string, string> = {}
  for (const line of headerLines) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const k = line.slice(0, idx).trim().toLowerCase()
      const v = line.slice(idx + 1).trim()
      headers[k] = v
    }
  }

  return { status, statusText, headers, body: rawBody }
}
