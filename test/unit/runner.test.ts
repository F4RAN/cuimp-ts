import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runBinary } from '../../src/runner'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// Helper functions to safely mock process.platform
// In some Node/Vitest environments, process.platform is non-configurable
// These helpers handle that case gracefully
function mockPlatform(platform: string): boolean {
  try {
    // Check if the property descriptor exists and is configurable
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    if (descriptor && !descriptor.configurable) {
      // Property is non-configurable, we can't mock it
      return false
    }
    // Property is configurable or doesn't exist, safe to define
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true,
      writable: true,
      enumerable: true,
    })
    return true
  } catch (error) {
    // If process.platform is non-configurable, we can't mock it
    // This can happen in some Node/Vitest environments
    // Return false to indicate the mock failed
    return false
  }
}

function restorePlatform(originalPlatform: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    if (descriptor && !descriptor.configurable) {
      // Property is non-configurable, we can't restore it
      return false
    }
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
      writable: true,
      enumerable: true,
    })
    return true
  } catch (error) {
    return false
  }
}

describe('runBinary', () => {
  const mockSpawn = vi.mocked(spawn)
  let mockChildProcess: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a mock child process
    mockChildProcess = {
      kill: vi.fn(),
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
    vi.restoreAllMocks()
  })

  it('should resolve with successful result', async () => {
    const mockStdout = Buffer.from('output data')
    const mockStderr = Buffer.from('error data')

    // Mock successful execution
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        // Simulate successful close
        setTimeout(() => callback(0), 10)
      }
    })

    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        // Simulate stdout data
        setTimeout(() => callback(mockStdout), 5)
      }
    })

    mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        // Simulate stderr data
        setTimeout(() => callback(mockStderr), 5)
      }
    })

    const result = await runBinary('/usr/bin/curl-impersonate', [
      '-X',
      'GET',
      'https://example.com',
    ])

    expect(result).toEqual({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/bin/curl-impersonate',
      ['-X', 'GET', 'https://example.com'],
      expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    )
  })

  it('should handle process error', async () => {
    const error = new Error('Process failed to start')

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        setTimeout(() => callback(error), 10)
      }
    })

    await expect(
      runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])
    ).rejects.toThrow('Process failed to start')
  })

  it('should handle timeout', async () => {
    const timeout = 50
    let closeCallback: Function | undefined

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        closeCallback = callback
        // Don't call close immediately to trigger timeout
      }
    })

    mockChildProcess.stdout.on.mockImplementation(() => {})
    mockChildProcess.stderr.on.mockImplementation(() => {})

    const promise = runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], {
      timeout,
    })

    // Wait for timeout to fire
    await new Promise(resolve => setTimeout(resolve, timeout + 10))

    // After timeout kills the process, close event should fire
    if (closeCallback) {
      closeCallback(null) // null exit code after kill
    }

    await expect(promise).rejects.toThrow(`Request timed out after ${timeout} ms`)
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 1000)

  it('should handle abort signal', async () => {
    const abortController = new AbortController()
    let closeCallback: Function | undefined

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        closeCallback = callback
      }
    })

    mockChildProcess.stdout.on.mockImplementation(() => {})
    mockChildProcess.stderr.on.mockImplementation(() => {})

    // Start the request
    const promise = runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], {
      signal: abortController.signal,
    })

    // Abort the request
    abortController.abort()

    // After abort kills the process, close event should fire
    await new Promise(resolve => setTimeout(resolve, 10))
    if (closeCallback) {
      closeCallback(null) // null exit code after kill
    }

    await expect(promise).rejects.toThrow()
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 1000)

  it('should handle already aborted signal', async () => {
    const abortController = new AbortController()
    abortController.abort() // Abort before starting

    let closeCallback: Function | undefined
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        closeCallback = callback
      }
    })

    mockChildProcess.stdout.on.mockImplementation(() => {})
    mockChildProcess.stderr.on.mockImplementation(() => {})

    const promise = runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], {
      signal: abortController.signal,
    })

    // After abort kills the process, close event should fire
    await new Promise(resolve => setTimeout(resolve, 10))
    if (closeCallback) {
      closeCallback(null) // null exit code after kill
    }

    await expect(promise).rejects.toThrow()
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 1000)

  it('should handle multiple stdout chunks', async () => {
    const chunk1 = Buffer.from('chunk1')
    const chunk2 = Buffer.from('chunk2')
    const expectedStdout = Buffer.concat([chunk1, chunk2])
    const mockStderr = Buffer.from('')

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 20)
      }
    })

    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        // Simulate multiple chunks
        setTimeout(() => callback(chunk1), 5)
        setTimeout(() => callback(chunk2), 10)
      }
    })

    mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStderr), 5)
      }
    })

    const result = await runBinary('/usr/bin/curl-impersonate', [
      '-X',
      'GET',
      'https://example.com',
    ])

    expect(result.stdout).toEqual(expectedStdout)
  })

  it('should handle multiple stderr chunks', async () => {
    const mockStdout = Buffer.from('')
    const chunk1 = Buffer.from('error1')
    const chunk2 = Buffer.from('error2')
    const expectedStderr = Buffer.concat([chunk1, chunk2])

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 20)
      }
    })

    mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockStdout), 5)
      }
    })

    mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        // Simulate multiple chunks
        setTimeout(() => callback(chunk1), 5)
        setTimeout(() => callback(chunk2), 10)
      }
    })

    const result = await runBinary('/usr/bin/curl-impersonate', [
      '-X',
      'GET',
      'https://example.com',
    ])

    expect(result.stderr).toEqual(expectedStderr)
  })

  it('should handle non-zero exit code', async () => {
    const mockStdout = Buffer.from('output')
    const mockStderr = Buffer.from('error')

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(1), 10) // Non-zero exit code
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

    const result = await runBinary('/usr/bin/curl-impersonate', [
      '-X',
      'GET',
      'https://example.com',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toEqual(mockStdout)
    expect(result.stderr).toEqual(mockStderr)
  })

  it('should handle null exit code', async () => {
    const mockStdout = Buffer.from('output')
    const mockStderr = Buffer.from('error')

    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        setTimeout(() => callback(null), 10) // Null exit code
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

    const result = await runBinary('/usr/bin/curl-impersonate', [
      '-X',
      'GET',
      'https://example.com',
    ])

    expect(result.exitCode).toBe(null)
    expect(result.stdout).toEqual(mockStdout)
    expect(result.stderr).toEqual(mockStderr)
  })

  it('should not set timeout when timeout is 0', async () => {
    const mockStdout = Buffer.from('output')
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

    await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], {
      timeout: 0,
    })

    // Should not have called kill due to timeout
    expect(mockChildProcess.kill).not.toHaveBeenCalled()
  })

  it('should not set timeout when timeout is negative', async () => {
    const mockStdout = Buffer.from('output')
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

    await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], {
      timeout: -1,
    })

    // Should not have called kill due to timeout
    expect(mockChildProcess.kill).not.toHaveBeenCalled()
  })

  describe('Windows path quoting', () => {
    const originalPlatform = process.platform

    afterEach(() => {
      // Always try to restore, even if mocking failed
      // restorePlatform handles errors gracefully
      restorePlatform(originalPlatform)
    })

    it('should quote Windows .bat path with spaces when shell is needed', async () => {
      // Mock Windows platform
      if (!mockPlatform('win32')) {
        // Skip test if platform cannot be mocked (non-configurable in some environments)
        return
      }

      const mockStdout = Buffer.from('output')
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

      const pathWithSpaces = 'D:\\Users\\Active PC\\cuimp\\binaries\\curl_edge101.bat'
      await runBinary(pathWithSpaces, ['-X', 'GET', 'https://example.com'])

      // Verify spawn was called with quoted path and shell: true
      // Path should be normalized and quoted
      const normalizedPath = path.win32.normalize(pathWithSpaces)
      // Windows CMD uses "" to escape quotes inside double quotes
      const expectedQuotedPath = `"${normalizedPath.replace(/"/g, '""')}"`
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedQuotedPath,
        expect.any(Array),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        })
      )
    })

    it('should quote Windows .bat path with other shell metacharacters', async () => {
      if (!mockPlatform('win32')) {
        return
      }

      const mockStdout = Buffer.from('output')
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

      const pathWithAmpersand = 'D:\\Users\\Test&Dev\\cuimp\\binaries\\curl_edge101.bat'
      await runBinary(pathWithAmpersand, ['-X', 'GET', 'https://example.com'])

      // Verify path was normalized and quoted
      const normalizedPath = path.win32.normalize(pathWithAmpersand)
      // Windows CMD uses "" to escape quotes inside double quotes
      const expectedQuotedPath = `"${normalizedPath.replace(/"/g, '""')}"`
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedQuotedPath,
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        })
      )
    })

    it('should not quote Windows .bat path without spaces or metacharacters', async () => {
      if (!mockPlatform('win32')) {
        return
      }

      const mockStdout = Buffer.from('output')
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

      const pathWithoutSpaces = 'D:\\Users\\ActivePC\\cuimp\\binaries\\curl_edge101.bat'
      await runBinary(pathWithoutSpaces, ['-X', 'GET', 'https://example.com'])

      // Verify path was normalized but NOT quoted (no spaces/metacharacters)
      const normalizedPath = path.win32.normalize(pathWithoutSpaces)
      expect(mockSpawn).toHaveBeenCalledWith(
        normalizedPath,
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        })
      )
    })

    it('should escape existing quotes in Windows .bat path', async () => {
      if (!mockPlatform('win32')) {
        return
      }

      const mockStdout = Buffer.from('output')
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

      const pathWithQuotes = 'D:\\Users\\"Test"\\cuimp\\binaries\\curl_edge101.bat'
      await runBinary(pathWithQuotes, ['-X', 'GET', 'https://example.com'])

      // Verify quotes were removed, path normalized, then re-quoted if needed
      const unquotedPath = pathWithQuotes.replace(/^["']+/, '').replace(/["']+$/, '')
      const normalizedPath = path.win32.normalize(unquotedPath)
      // Path has quotes in the middle, so it will be quoted
      // Windows CMD uses "" to escape quotes inside double quotes
      const expectedQuotedPath = `"${normalizedPath.replace(/"/g, '""')}"`
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedQuotedPath,
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        })
      )
    })

    it('should not quote non-Windows paths even with spaces', async () => {
      // Mock non-Windows platform
      if (!mockPlatform('linux')) {
        return
      }

      const mockStdout = Buffer.from('output')
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

      const pathWithSpaces = '/usr/local/bin/Active PC/curl-impersonate'
      await runBinary(pathWithSpaces, ['-X', 'GET', 'https://example.com'])

      // Verify path was NOT quoted (not Windows, not .bat)
      expect(mockSpawn).toHaveBeenCalledWith(
        pathWithSpaces,
        expect.any(Array),
        expect.objectContaining({
          shell: false,
        })
      )
    })

    it('should not quote Windows .exe path (not .bat)', async () => {
      if (!mockPlatform('win32')) {
        return
      }

      const mockStdout = Buffer.from('output')
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

      const exePathWithSpaces = 'D:\\Users\\Active PC\\cuimp\\binaries\\curl_edge101.exe'
      await runBinary(exePathWithSpaces, ['-X', 'GET', 'https://example.com'])

      // Verify path was NOT quoted (not .bat, so shell: false)
      expect(mockSpawn).toHaveBeenCalledWith(
        exePathWithSpaces,
        expect.any(Array),
        expect.objectContaining({
          shell: false,
        })
      )
    })

    describe('path normalization', () => {
      it('should normalize Windows .bat path with forward slashes', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Path with forward slashes (Windows style but using /)
        const pathWithForwardSlashes = 'D:/Users/ActivePC/cuimp/binaries/curl_edge101.bat'
        await runBinary(pathWithForwardSlashes, ['-X', 'GET', 'https://example.com'])

        // Verify path was normalized (forward slashes converted to backslashes)
        const normalizedPath = path.win32.normalize(pathWithForwardSlashes)
        expect(mockSpawn).toHaveBeenCalledWith(
          normalizedPath,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })

      it('should resolve relative Windows .bat path to absolute', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Relative path
        const relativePath = './binaries/curl_edge101.bat'
        await runBinary(relativePath, ['-X', 'GET', 'https://example.com'])

        // Verify path was resolved to absolute
        const resolvedPath = path.resolve(relativePath)
        expect(mockSpawn).toHaveBeenCalledWith(
          resolvedPath,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })

      it('should remove existing quotes before normalizing', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Path with existing quotes (incorrectly added)
        const pathWithQuotes = '"D:\\Users\\ActivePC\\cuimp\\binaries\\curl_edge101.bat"'
        await runBinary(pathWithQuotes, ['-X', 'GET', 'https://example.com'])

        // Verify quotes were removed, path was normalized, and NOT re-quoted (no spaces)
        const unquotedPath = pathWithQuotes.replace(/^["']+/, '').replace(/["']+$/, '')
        const normalizedPath = path.win32.normalize(unquotedPath)
        // Path doesn't have spaces, so it shouldn't be quoted
        expect(mockSpawn).toHaveBeenCalledWith(
          normalizedPath,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })

      it('should normalize and quote path with spaces after normalization', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Path with forward slashes AND spaces
        const pathWithForwardSlashesAndSpaces = 'D:/Users/Active PC/cuimp/binaries/curl_edge101.bat'
        await runBinary(pathWithForwardSlashesAndSpaces, ['-X', 'GET', 'https://example.com'])

        // Verify path was normalized first, then quoted (because it has spaces)
        const normalizedPath = path.win32.normalize(pathWithForwardSlashesAndSpaces)
        // Windows CMD uses "" to escape quotes inside double quotes
        const expectedQuotedPath = `"${normalizedPath.replace(/"/g, '""')}"`
        expect(mockSpawn).toHaveBeenCalledWith(
          expectedQuotedPath,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })

      it('should normalize path without spaces (second scenario fix)', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Path without spaces but with forward slashes (common issue)
        const pathWithoutSpaces = 'D:/Users/ActivePC/cuimp/binaries/curl_edge101.bat'
        await runBinary(pathWithoutSpaces, ['-X', 'GET', 'https://example.com'])

        // Verify path was normalized (forward slashes to backslashes)
        // This fixes the "no URL specified" error in scenario 2
        const normalizedPath = path.win32.normalize(pathWithoutSpaces)
        expect(mockSpawn).toHaveBeenCalledWith(
          normalizedPath,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })

      it('should not resolve bare filename to allow PATH resolution', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        // Bare filename without any path separators
        const bareFilename = 'curl_edge101.bat'
        await runBinary(bareFilename, ['-X', 'GET', 'https://example.com'])

        // Verify path was NOT resolved (left as-is for PATH resolution)
        // The shell should be able to find it via PATH
        expect(mockSpawn).toHaveBeenCalledWith(
          bareFilename,
          expect.any(Array),
          expect.objectContaining({
            shell: true,
          })
        )
      })
    })

    describe('Windows argument escaping', () => {
      const originalPlatform = process.platform

      afterEach(() => {
        restorePlatform(originalPlatform)
      })

      it('should properly escape & character in arguments for Windows CMD', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        const argsWithAmpersand = ['--data-binary', 'pass@&sample', 'https://example.com']
        await runBinary(binPath, argsWithAmpersand)

        // Verify spawn was called with properly quoted arguments
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        // The argument with & should be quoted
        expect(spawnedArgs).toContain('"pass@&sample"')
        // Verify the & is inside quotes (not escaped with backslash)
        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        expect(spawnedArgs[dataBinaryIndex + 1]).toBe('"pass@&sample"')
      })

      it('should properly escape double quotes in arguments for Windows CMD', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        const argsWithQuote = ['--data-binary', 'P!ngpass123"test', 'https://example.com']
        await runBinary(binPath, argsWithQuote)

        // Verify spawn was called with properly escaped quotes
        // Windows CMD uses "" to escape quotes inside double quotes
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        // The argument with quote should be quoted and use "" escaping
        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]
        expect(escapedArg).toContain('""')
        // Should be: "P!ngpass123""test"
        expect(escapedArg).toBe('"P!ngpass123""test"')
      })

      it('should handle both & and " characters in same argument', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        const argsWithBoth = ['--data-binary', 'user&pass"test', 'https://example.com']
        await runBinary(binPath, argsWithBoth)

        // Verify spawn was called with properly escaped argument
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]
        // Should be quoted (because of &) and use "" for quote escaping
        expect(escapedArg).toMatch(/^".*"$/) // Starts and ends with quotes
        expect(escapedArg).toContain('""') // Uses "" for quote escaping
        expect(escapedArg).toContain('&') // Contains & inside quotes
      })

      it('should properly escape backslashes before quotes in JSON data', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        // Simulate kenmadev's exact example:
        // request.post('https://example.com/login', {
        //   username: "username123"
        //   password: `P!ngpass123"test`  // literal quote in password
        // })
        // JSON.stringify produces: {"username":"username123","password":"P!ngpass123\"test"}
        const jsonData = JSON.stringify({
          username: 'username123',
          password: 'P!ngpass123"test', // literal quote
        })
        const argsWithJsonQuote = ['--data-binary', jsonData, 'https://example.com']
        await runBinary(binPath, argsWithJsonQuote)

        // Verify spawn was called with properly escaped argument
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]

        // Should be quoted (because of quotes in JSON)
        expect(escapedArg).toMatch(/^".*"$/) // Starts and ends with quotes

        // Critical: The backslash before quote should be doubled: \" becomes \\"
        // Then quotes are escaped: " becomes ""
        // So \" becomes \\""
        // This is required for Windows CMD to correctly interpret JSON escape sequences
        expect(escapedArg).toContain('\\\\""') // Backslash before quote is doubled, then quote is escaped

        // Verify the exact escaping for kenmadev's issue:
        // Original JSON: {"password":"P!ngpass123\"test"}
        // After escaping: {""password"":""P!ngpass123\\""test""}
        // The \\"" sequence is critical - without it, Windows CMD would misinterpret the quote
        // Check the entire escaped argument contains the properly escaped sequence
        // The escapedArg is wrapped in quotes, so we check the inner content
        const innerContent = escapedArg.slice(1, -1) // Remove outer quotes

        // Verify critical parts exist
        expect(innerContent).toContain('password"":""P!ngpass123')
        expect(innerContent).toContain('\\\\""test""') // Must have double backslash + double quote before "test"

        // Verify the exact pattern: password"":""P!ngpass123\\""test""
        // Note: In the regex, we need to escape the backslashes properly
        // The string contains: password"":""P!ngpass123\\""test""
        // In regex: password"":""P!ngpass123\\\\""test""
        // (Each \ in the string needs to be \\ in the regex)
        const passwordPattern = /password"":""P!ngpass123\\\\""test""/
        expect(innerContent).toMatch(passwordPattern)

        // Should contain the JSON structure with proper escaping
        expect(escapedArg).toContain('username')
        expect(escapedArg).toContain('password')
        expect(escapedArg).toContain('username123')

        // Verify it's valid JSON when Windows CMD processes it
        // Windows CMD will interpret: "" as ", \\ as \, so \\"" becomes \"
        // This matches what JSON.stringify produced: \" (backslash + quote)
      })

      it('should quote arguments containing % character (variable expansion)', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        const argsWithPercent = ['--data-binary', 'discount50%off', 'https://example.com']
        await runBinary(binPath, argsWithPercent)

        // Verify spawn was called with quoted argument
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]
        // Should be quoted to prevent % from triggering variable expansion
        expect(escapedArg).toBe('"discount50%off"')
      })

      it('should quote arguments containing ! character (delayed expansion)', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        const argsWithExclamation = ['--data-binary', 'Hello, World!', 'https://example.com']
        await runBinary(binPath, argsWithExclamation)

        // Verify spawn was called with quoted argument
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]
        // Should be quoted to prevent ! from triggering delayed variable expansion
        expect(escapedArg).toBe('"Hello, World!"')
      })

      it('should handle multiple special characters together', async () => {
        if (!mockPlatform('win32')) {
          return
        }

        const mockStdout = Buffer.from('output')
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

        const binPath = 'D:\\binaries\\curl_edge101.bat'
        // Contains: &, ", %, !, and space
        const argsWithMultiple = ['--data-binary', 'user&pass"test50%off!', 'https://example.com']
        await runBinary(binPath, argsWithMultiple)

        // Verify spawn was called with properly escaped argument
        const spawnCall = mockSpawn.mock.calls[0]
        const spawnedArgs = spawnCall[1] as string[]

        const dataBinaryIndex = spawnedArgs.indexOf('--data-binary')
        const escapedArg = spawnedArgs[dataBinaryIndex + 1]
        // Should be quoted and use "" for quote escaping
        expect(escapedArg).toMatch(/^".*"$/) // Starts and ends with quotes
        expect(escapedArg).toContain('""') // Uses "" for quote escaping
        expect(escapedArg).toContain('&') // Contains & inside quotes
        expect(escapedArg).toContain('%') // Contains % inside quotes
        expect(escapedArg).toContain('!') // Contains ! inside quotes
      })
    })
  })
})
