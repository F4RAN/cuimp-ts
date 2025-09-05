import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runBinary } from '../../src/runner'
import { spawn } from 'node:child_process'

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
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
        on: vi.fn()
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn()
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

    const result = await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])

    expect(result).toEqual({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr
    })
    
    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/bin/curl-impersonate',
      ['-X', 'GET', 'https://example.com'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
  })

  it('should handle process error', async () => {
    const error = new Error('Process failed to start')
    
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        setTimeout(() => callback(error), 10)
      }
    })

    await expect(runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com']))
      .rejects.toThrow('Process failed to start')
  })

  it('should handle timeout', async () => {
    const timeout = 50
    
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        // Don't call close immediately to trigger timeout
      }
    })
    
    mockChildProcess.stdout.on.mockImplementation(() => {})
    mockChildProcess.stderr.on.mockImplementation(() => {})

    await expect(runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], { timeout }))
      .rejects.toThrow(`Request timed out after ${timeout} ms`)
    
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 200)

  it('should handle abort signal', async () => {
    const abortController = new AbortController()
    
    mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        // Don't call close immediately
      }
    })
    
    mockChildProcess.stdout.on.mockImplementation(() => {})
    mockChildProcess.stderr.on.mockImplementation(() => {})

    // Start the request
    const promise = runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], { 
      signal: abortController.signal 
    })
    
    // Abort the request
    abortController.abort()
    
    await expect(promise).rejects.toThrow()
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 200)

  it('should handle already aborted signal', async () => {
    const abortController = new AbortController()
    abortController.abort() // Abort before starting
    
    await expect(runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], { 
      signal: abortController.signal 
    })).rejects.toThrow()
    
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
  }, 200)

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

    const result = await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])

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

    const result = await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])

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

    const result = await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])

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

    const result = await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'])

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

    await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], { timeout: 0 })

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

    await runBinary('/usr/bin/curl-impersonate', ['-X', 'GET', 'https://example.com'], { timeout: -1 })

    // Should not have called kill due to timeout
    expect(mockChildProcess.kill).not.toHaveBeenCalled()
  })
})
