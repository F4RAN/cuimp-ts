import { LIB_URL, BROWSER_LIST, ARCHITECTURE_LIST, PLATFORM_LIST } from "../constants/cuimpConstants"
import { CuimpDescriptor, BinaryInfo } from "../types/cuimpTypes"
import { getLatestRelease } from "./connector"
import fs from 'fs'
import path from 'path'
import { extract } from "tar"


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
    './binaries/',  // Fallback: dedicated folder for downloaded binaries
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
const BINARY_PATTERNS = [
    'curl-impersonate',
    'curl-impersonate.exe',
    'curl_chrome*',
    'curl_firefox*',
    'curl_edge*',
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
        throw new Error(`Unsupported browser: ${browser}. Supported browsers: ${BROWSER_LIST.join(', ')}`)
    }
    
    if (!ARCHITECTURE_LIST.includes(architecture)) {
        throw new Error(`Unsupported architecture: ${architecture}. Supported architectures: ${ARCHITECTURE_LIST.join(', ')}`)
    }
    
    if (!PLATFORM_LIST.includes(platform)) {
        throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${PLATFORM_LIST.join(', ')}`)
    }
}

/**
 * Searches for existing curl-impersonate binary in system paths
 */
const findExistingBinary = (browser: string = ''): string | null => {
    // Filter patterns based on browser if specified
    const patternsToSearch = browser 
        ? BINARY_PATTERNS.filter(pattern => {
            if (browser === 'chrome') return pattern.includes('chrome') || pattern === 'curl-impersonate'
            if (browser === 'firefox') return pattern.includes('firefox') || pattern === 'curl-impersonate'
            if (browser === 'edge') return pattern.includes('edge') || pattern === 'curl-impersonate'
            if (browser === 'safari') return pattern.includes('safari') || pattern === 'curl-impersonate'
            return pattern === 'curl-impersonate' // fallback to generic
        }).sort((a, b) => {
            // Prioritize browser-specific patterns over generic ones
            const aIsGeneric = a === 'curl-impersonate' || a === 'curl-impersonate.exe'
            const bIsGeneric = b === 'curl-impersonate' || b === 'curl-impersonate.exe'
            if (aIsGeneric && !bIsGeneric) return 1  // generic comes after specific
            if (!aIsGeneric && bIsGeneric) return -1 // specific comes before generic
            return 0
        })
        : BINARY_PATTERNS

    // Get the package binaries directory dynamically
    // In the compiled version, this file is in dist/helpers, so we go up to the package root
    const packageDir = path.resolve(__dirname, '../../')
    const packageBinariesDir = path.resolve(packageDir, 'binaries')

    // Create search paths including the package binaries directory
    const searchPaths = packageBinariesDir 
        ? [packageBinariesDir, ...BINARY_SEARCH_PATHS]
        : BINARY_SEARCH_PATHS

    for (const searchPath of searchPaths) {
        for (const pattern of patternsToSearch) {
            try {
                // Handle glob patterns
                if (pattern.includes('*')) {
                    const files = fs.readdirSync(searchPath)
                    const matchingFiles = files.filter(file => {
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
                            if (fs.statSync(fullPath).isFile()) {
                                return fullPath
                            }
                        } else {
                            // Single match
                            const fullPath = path.join(searchPath, matchingFiles[0])
                            if (fs.statSync(fullPath).isFile()) {
                                return fullPath
                            }
                        }
                    }
                } else {
                    const fullPath = path.join(searchPath, pattern)
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
    version: string
): Promise<DownloadResult> => {
    try {
        // Get latest release info
        const latestVersion = await getLatestRelease()
        const actualVersion = version === 'latest' ? latestVersion.replace(/^v/, '') : version.replace(/^v/, '')
        
        // Construct download URL with correct naming convention
        let assetName: string
        if (platform === 'linux') {
            // Linux uses specific naming: x86_64-linux-gnu, aarch64-linux-gnu, etc.
            const linuxArch = architecture === 'x64' ? 'x86_64' : 'aarch64'
            assetName = `curl-impersonate-${latestVersion}.${linuxArch}-linux-gnu.tar.gz`
        } else {
            // Other platforms use the original naming
            assetName = `curl-impersonate-${latestVersion}.${architecture}-${platform}.tar.gz`
        }
        const downloadUrl = `https://github.com/lexiforest/curl-impersonate/releases/download/${latestVersion}/${assetName}`
        
        // Download the binary
        console.log(`Downloading ${downloadUrl}...`)
        const response = await fetch(downloadUrl)
        
        if (!response.ok) {
            throw new Error(`Failed to download binary: ${response.status} ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Find the package directory (where this module is installed)
        // In the compiled version, this file is in dist/helpers, so we go up to the package root
        const packageDir = path.resolve(__dirname, '../../')
        
        // Save to temporary file in the package directory
        const tempFileName = path.resolve(packageDir, `${browser}-${architecture}-${platform}.tar.gz`)
        fs.writeFileSync(tempFileName, buffer)
        
        // Create binaries directory in node_modules if it doesn't exist
        const binariesDir = path.resolve(packageDir, 'binaries')
        if (!fs.existsSync(binariesDir)) {
            fs.mkdirSync(binariesDir, { recursive: true })
        }
        
        // Extract the binary to the binaries directory
        console.log(`Extracting ${tempFileName} to ${binariesDir}...`)
        await extract({
            file: tempFileName,
            cwd: binariesDir
        })
        
        // Clean up temporary file
        fs.unlinkSync(tempFileName)
        
        // Find the extracted binary file in the binaries directory
        // The main binary is usually named 'curl-impersonate'
        const mainBinaryName = 'curl-impersonate'
        const binaryPath = path.resolve(binariesDir, mainBinaryName)
        
        // Check if the main binary was extracted
        if (!fs.existsSync(binaryPath)) {
            // If main binary not found, look for browser-specific binaries
            const browserSpecificPattern = `curl_${browser}*`
            const files = fs.readdirSync(binariesDir)
            const matchingFiles = files.filter(file => {
                const regex = new RegExp(browserSpecificPattern.replace('*', '.*'))
                return regex.test(file)
            })
            
            if (matchingFiles.length > 0) {
                // Use the highest version browser-specific binary
                const sortedFiles = matchingFiles.sort((a, b) => {
                    const versionA = extractVersionNumber(a)
                    const versionB = extractVersionNumber(b)
                    return versionB - versionA // Sort in descending order (highest first)
                })
                const bestMatch = sortedFiles[0]
                const browserBinaryPath = path.resolve(binariesDir, bestMatch)
                
                // Set executable permissions on the browser-specific binary
                fs.chmodSync(browserBinaryPath, 0o755)
                
                return {
                    binaryPath: browserBinaryPath,
                    version: actualVersion
                }
            }
            
            throw new Error(`Binary not found after extraction. Expected: ${binaryPath}`)
        }
        
        // Set executable permissions on the main binary
        fs.chmodSync(binaryPath, 0o755)
        
        return {
            binaryPath: binaryPath,
            version: actualVersion
        }
        
    } catch (error) {
        throw new Error(`Failed to download and extract binary: ${error instanceof Error ? error.message : String(error)}`)
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
        'x64': 'x64',
        'x86_64': 'x64',
        'arm64': 'arm64',
        'aarch64': 'arm64'
    }
    
    const platformMap: Record<string, string> = {
        'linux': 'linux',
        'win32': 'windows',
        'darwin': 'macos'
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
        platform: mappedPlatform
    }
}

/**
 * Main function to parse descriptor and get binary information
 */
export const parseDescriptor = async (descriptor: CuimpDescriptor): Promise<BinaryInfo> => {
    try {
        // Force download - skip existing binary check
        const { architecture, platform } = getSystemInfo()
        const browser = descriptor.browser || 'chrome'
        const version = descriptor.version || 'latest'
        
        // Validate parameters
        validateParameters(browser, architecture, platform)
        
        console.log(`Downloading curl-impersonate for ${browser} on ${platform}-${architecture}...`)
        
        const downloadResult = await downloadAndExtractBinary(browser, architecture, platform, version)
        
        return {
            binaryPath: downloadResult.binaryPath,
            isDownloaded: true,
            version: downloadResult.version
        }
        
    } catch (error) {
        throw new Error(`Failed to parse descriptor: ${error instanceof Error ? error.message : String(error)}`)
    }
}

/**
 * Legacy function for backward compatibility
 */
export const getLink = async (
    browser: string, 
    version: string, 
    architecture: string, 
    platform: string
): Promise<string> => {
    try {
        validateParameters(browser, architecture, platform)
        const result = await downloadAndExtractBinary(browser, architecture, platform, version)
        return result.binaryPath
    } catch (error) {
        throw new Error(`Failed to get link: ${error instanceof Error ? error.message : String(error)}`)
    }
}