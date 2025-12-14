import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runBinary } from '../../src/runner'
import { spawn } from 'node:child_process'

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

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
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('should quote Windows .bat path with spaces when shell is needed', async () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

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
      expect(mockSpawn).toHaveBeenCalledWith(
        `"${pathWithSpaces.replace(/"/g, '\\"')}"`,
        expect.any(Array),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        })
      )
    })

    it('should quote Windows .bat path with other shell metacharacters', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })

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

      // Verify path was quoted
      expect(mockSpawn).toHaveBeenCalledWith(
        `"${pathWithAmpersand.replace(/"/g, '\\"')}"`,
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        })
      )
    })

    it('should not quote Windows .bat path without spaces or metacharacters', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })

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

      // Verify path was NOT quoted (no spaces/metacharacters)
      expect(mockSpawn).toHaveBeenCalledWith(
        pathWithoutSpaces,
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        })
      )
    })

    it('should escape existing quotes in Windows .bat path', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })

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

      // Verify quotes were escaped
      const expectedQuotedPath = `"${pathWithQuotes.replace(/"/g, '\\"')}"`
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
      Object.defineProperty(process, 'platform', { value: 'linux' })

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
      Object.defineProperty(process, 'platform', { value: 'win32' })

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
  })
})
