import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runBinary } from '../../src/runner'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// Mock fs for .bat file reading
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

// Helper to mock platform
function mockPlatform(platform: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    if (descriptor && !descriptor.configurable) {
      return false
    }
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true,
      writable: true,
      enumerable: true,
    })
    return true
  } catch {
    return false
  }
}

function restorePlatform(originalPlatform: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    if (descriptor && !descriptor.configurable) {
      return false
    }
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
      writable: true,
      enumerable: true,
    })
    return true
  } catch {
    return false
  }
}

describe('runBinary - .bat file handling', () => {
  const mockSpawn = vi.mocked(spawn)
  const mockExistsSync = vi.mocked(fs.existsSync)
  const mockReadFileSync = vi.mocked(fs.readFileSync)
  let mockChildProcess: any
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()

    mockChildProcess = {
      kill: vi.fn(),
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn(),
    }

    mockSpawn.mockReturnValue(mockChildProcess)
  })

  afterEach(() => {
    restorePlatform(originalPlatform)
    vi.restoreAllMocks()
  })

  it('should parse .bat file and use curl.exe directly when user provides Accept header', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    // Mock .bat file content
    const batContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256" ^
    -H "User-Agent: Mozilla/5.0" ^
    -H "Accept: text/html,application/xhtml+xml" ^
    --http2 ^
    %*`

    mockExistsSync.mockImplementation((path: string) => {
      if (path === batPath || path === curlExePath) return true
      return false
    })

    mockReadFileSync.mockReturnValue(batContent)

    const mockStdout = Buffer.from('HTTP/1.1 200 OK\r\n\r\nOK')
    const mockStderr = Buffer.from('')

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10)
      }
    })

    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })

    mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStderr), 5)
      }
    })

    // User provides custom Accept header
    const userArgs = ['-H', 'Accept: application/json', 'https://example.com']

    await runBinary(batPath, userArgs)

    // Verify curl.exe was used (not .bat file)
    expect(mockSpawn).toHaveBeenCalledWith(
      curlExePath,
      expect.arrayContaining([
        '--ciphers',
        'TLS_AES_128_GCM_SHA256',
        '-H',
        'User-Agent: Mozilla/5.0',
        '--http2',
        '-H',
        'Accept: application/json', // User's header should be present
        'https://example.com',
      ]),
      expect.objectContaining({
        shell: false, // .exe doesn't need shell
      })
    )

    // Verify Accept header from .bat was removed (not duplicated)
    const spawnCall = mockSpawn.mock.calls[0]
    const spawnedArgs = spawnCall[1] as string[]
    const acceptHeaders = spawnedArgs.filter((arg, i) => {
      return (
        (arg === '-H' && spawnedArgs[i + 1]?.includes('Accept:')) ||
        arg.includes('Accept:')
      )
    })
    // Should only have one Accept header (user's)
    expect(acceptHeaders.length).toBeGreaterThan(0)
    const allAcceptHeaders = spawnedArgs
      .map((arg, i) => {
        if (arg === '-H' && spawnedArgs[i + 1]) {
          return spawnedArgs[i + 1]
        }
        if (arg.includes('Accept:')) {
          return arg
        }
        return null
      })
      .filter(Boolean)
      .filter((h: string | null) => h?.includes('Accept:'))

    expect(allAcceptHeaders.length).toBe(1)
    expect(allAcceptHeaders[0]).toContain('application/json')
  })

  it('should filter multiple conflicting headers from .bat file', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    -H "User-Agent: Mozilla/5.0" ^
    -H "Accept: text/html" ^
    -H "Accept-Language: en-US" ^
    --http2 ^
    %*`

    mockExistsSync.mockImplementation((path: string) => {
      if (path === batPath || path === curlExePath) return true
      return false
    })

    mockReadFileSync.mockReturnValue(batContent)

    const mockStdout = Buffer.from('HTTP/1.1 200 OK\r\n\r\nOK')
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10)
      }
    })
    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })
    mockChildProcess.stderr.on.mockImplementation(() => {})

    // User provides multiple custom headers
    const userArgs = [
      '-H',
      'Accept: application/json',
      '-H',
      'User-Agent: MyCustomAgent/1.0',
      'https://example.com',
    ]

    await runBinary(batPath, userArgs)

    const spawnCall = mockSpawn.mock.calls[0]
    const spawnedArgs = spawnCall[1] as string[]

    // Verify .bat headers were filtered out
    expect(spawnedArgs).not.toContain('User-Agent: Mozilla/5.0')
    expect(spawnedArgs).not.toContain('Accept: text/html')

    // Verify user headers are present
    expect(spawnedArgs).toContain('Accept: application/json')
    expect(spawnedArgs).toContain('User-Agent: MyCustomAgent/1.0')

    // Verify non-conflicting .bat headers are preserved
    expect(spawnedArgs).toContain('Accept-Language: en-US')
    expect(spawnedArgs).toContain('--http2')
  })

  it('should preserve all non-header arguments from .bat file', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256" ^
    --curves X25519:P-256 ^
    -H "Accept: text/html" ^
    --http2 ^
    --http2-settings "1:65536" ^
    --tls-grease ^
    %*`

    mockExistsSync.mockImplementation((path: string) => {
      if (path === batPath || path === curlExePath) return true
      return false
    })

    mockReadFileSync.mockReturnValue(batContent)

    const mockStdout = Buffer.from('HTTP/1.1 200 OK\r\n\r\nOK')
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10)
      }
    })
    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })
    mockChildProcess.stderr.on.mockImplementation(() => {})

    const userArgs = ['-H', 'Accept: application/json', 'https://example.com']

    await runBinary(batPath, userArgs)

    const spawnCall = mockSpawn.mock.calls[0]
    const spawnedArgs = spawnCall[1] as string[]

    // Verify TLS/HTTP2 settings are preserved
    expect(spawnedArgs).toContain('--ciphers')
    expect(spawnedArgs).toContain('TLS_AES_128_GCM_SHA256')
    expect(spawnedArgs).toContain('--curves')
    expect(spawnedArgs).toContain('X25519:P-256')
    expect(spawnedArgs).toContain('--http2')
    expect(spawnedArgs).toContain('--http2-settings')
    expect(spawnedArgs).toContain('1:65536')
    expect(spawnedArgs).toContain('--tls-grease')

    // Verify Accept header was filtered
    expect(spawnedArgs).not.toContain('Accept: text/html')
    // But user's Accept is present
    expect(spawnedArgs).toContain('Accept: application/json')
  })

  it('should fallback to .bat file if curl.exe not found', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    mockExistsSync.mockImplementation((path: string) => {
      if (path === batPath) return true
      if (path === curlExePath) return false // curl.exe not found
      return false
    })

    const mockStdout = Buffer.from('HTTP/1.1 200 OK\r\n\r\nOK')
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10)
      }
    })
    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })
    mockChildProcess.stderr.on.mockImplementation(() => {})

    const userArgs = ['-H', 'Accept: application/json', 'https://example.com']

    await runBinary(batPath, userArgs)

    // Should use .bat file with shell: true (fallback)
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('.bat'),
      userArgs,
      expect.objectContaining({
        shell: true,
      })
    )
  })

  it('should handle .bat file parsing errors gracefully', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    mockExistsSync.mockImplementation((path: string) => {
      if (path === batPath || path === curlExePath) return true
      return false
    })

    // Simulate read error
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File read error')
    })

    const mockStdout = Buffer.from('HTTP/1.1 200 OK\r\n\r\nOK')
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10)
      }
    })
    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })
    mockChildProcess.stderr.on.mockImplementation(() => {})

    const userArgs = ['-H', 'Accept: application/json', 'https://example.com']

    // Should not throw, should fallback to .bat
    await runBinary(batPath, userArgs)

    // Should use .bat file with shell: true (fallback)
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('.bat'),
      expect.any(Array),
      expect.objectContaining({
        shell: true,
      })
    )
  })
})

