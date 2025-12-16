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

// Mock fs for .bat file reading - use spyOn to ensure it works with already-imported modules

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

describe('runBinary - Windows .bat file header overwrite', () => {
  const mockSpawn = vi.mocked(spawn)
  let mockExistsSync: any
  let mockReadFileSync: any
  let mockReaddirSync: any
  let mockChildProcess: any
  const originalPlatform = process.platform

  beforeEach(() => {
    // Spy on fs methods directly - this works even if fs was already imported
    mockExistsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    mockReadFileSync = vi.spyOn(fs, 'readFileSync')
    mockReaddirSync = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('ENOENT')
    })

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

  it('should use curl.exe directly and filter duplicate Accept header from .bat file', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'
    const parentCurlExePath = 'C:\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256" ^
    -H "User-Agent: Mozilla/5.0" ^
    -H "Accept: text/html,application/xhtml+xml" ^
    --http2 ^
    %*`

    // Mock already returns true by default from beforeEach

    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
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

    const userArgs = ['-H', 'Accept: application/json', 'https://example.com']

    await runBinary(batPath, userArgs)

    expect(mockSpawn).toHaveBeenCalledWith(
      curlExePath,
      expect.arrayContaining([
        '--ciphers',
        'TLS_AES_128_GCM_SHA256',
        '-H',
        'User-Agent: Mozilla/5.0',
        '--http2',
        '-H',
        'Accept: application/json',
        'https://example.com',
      ]),
      expect.objectContaining({
        shell: false,
      })
    )

    const spawnCall = mockSpawn.mock.calls[0]
    const spawnedArgs = spawnCall[1] as string[]
    
    // Extract Accept headers - look for -H followed by header value
    const allAcceptHeaders: string[] = []
    for (let i = 0; i < spawnedArgs.length; i++) {
      if (spawnedArgs[i] === '-H' && i + 1 < spawnedArgs.length) {
        const headerValue = spawnedArgs[i + 1]
        // Check if this is an Accept header (case-insensitive)
        if (headerValue.toLowerCase().startsWith('accept:')) {
          allAcceptHeaders.push(headerValue)
        }
        i++ // Skip the header value on next iteration
      }
    }

    expect(allAcceptHeaders.length).toBe(1)
    expect(allAcceptHeaders[0]).toContain('application/json')
    expect(allAcceptHeaders[0]).not.toContain('text/html')
  })

  it('should filter multiple conflicting headers when user provides custom headers', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'
    const parentCurlExePath = 'C:\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    -H "User-Agent: Mozilla/5.0" ^
    -H "Accept: text/html" ^
    -H "Accept-Language: en-US" ^
    --http2 ^
    %*`

    // Mock already returns true by default from beforeEach

    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
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

    expect(spawnedArgs).not.toContain('User-Agent: Mozilla/5.0')
    expect(spawnedArgs).not.toContain('Accept: text/html')
    expect(spawnedArgs).toContain('Accept: application/json')
    expect(spawnedArgs).toContain('User-Agent: MyCustomAgent/1.0')
    expect(spawnedArgs).toContain('Accept-Language: en-US')
    expect(spawnedArgs).toContain('--http2')
  })

  it('should preserve TLS and HTTP2 settings while filtering headers', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'
    const parentCurlExePath = 'C:\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256" ^
    --curves X25519:P-256 ^
    -H "Accept: text/html" ^
    --http2 ^
    --http2-settings "1:65536" ^
    --tls-grease ^
    %*`

    // Mock already returns true by default from beforeEach

    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
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

    expect(spawnedArgs).toContain('--ciphers')
    expect(spawnedArgs).toContain('TLS_AES_128_GCM_SHA256')
    expect(spawnedArgs).toContain('--curves')
    expect(spawnedArgs).toContain('X25519:P-256')
    expect(spawnedArgs).toContain('--http2')
    expect(spawnedArgs).toContain('--http2-settings')
    expect(spawnedArgs).toContain('1:65536')
    expect(spawnedArgs).toContain('--tls-grease')
    expect(spawnedArgs).not.toContain('Accept: text/html')
    expect(spawnedArgs).toContain('Accept: application/json')
  })

  it('should fallback to .bat file if curl.exe not found', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'

    mockExistsSync.mockImplementation((p: string) => {
      return p === batPath
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

    expect(mockSpawn).toHaveBeenCalledWith(
      batPath,
      expect.any(Array),
      expect.objectContaining({
        shell: true,
      })
    )
  })

  it('should handle complex .bat file with long cipher strings', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'
    const parentCurlExePath = 'C:\\curl.exe'

    const batContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256" ^
    --curves X25519MLKEM768:X25519:P-256:P-384 ^
    -H "Accept: text/html,application/xhtml+xml" ^
    -H "User-Agent: Mozilla/5.0" ^
    --http2 ^
    %*`

    // Mock already returns true by default from beforeEach

    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
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

    expect(spawnedArgs).toContain('--ciphers')
    const ciphersIndex = spawnedArgs.indexOf('--ciphers')
    expect(spawnedArgs[ciphersIndex + 1]).toBe(
      'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
    )
    expect(spawnedArgs).toContain('Accept: application/json')
    expect(spawnedArgs).not.toContain('Accept: text/html,application/xhtml+xml')
  })

  it('should handle .bat file parsing errors gracefully', async () => {
    if (!mockPlatform('win32')) {
      return
    }

    const batPath = 'C:\\binaries\\curl_chrome136.bat'
    const curlExePath = 'C:\\binaries\\curl.exe'
    const parentCurlExePath = 'C:\\curl.exe'

    // Mock already returns true by default from beforeEach

    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

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

    await runBinary(batPath, userArgs)

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('.bat'),
      expect.any(Array),
      expect.objectContaining({
        shell: true,
      })
    )
  })
})

