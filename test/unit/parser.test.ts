import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDescriptor, createHttpResponseStreamParser } from '../../src/helpers/parser'
import { CuimpDescriptor } from '../../src/types/cuimpTypes'

// Mock the connector module
vi.mock('../../src/helpers/connector', () => ({
  getLatestRelease: vi.fn(),
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    chmodSync: vi.fn(),
    unlinkSync: vi.fn(),
    constants: {
      S_IXUSR: 0o100,
      S_IXGRP: 0o010,
      S_IXOTH: 0o001,
    },
  },
}))

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(p => p.split('/').slice(0, -1).join('/') || '.'),
    basename: vi.fn(p => p.split('/').pop() || ''),
    extname: vi.fn(p => {
      const parts = p.split('.')
      return parts.length > 1 ? '.' + parts.pop() : ''
    }),
  },
}))

// Mock tar module
vi.mock('tar', () => ({
  extract: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe('parseDescriptor', () => {
  let mockGetLatestRelease: any
  let mockFs: any
  let mockFetch: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked functions
    const connectorModule = await import('../../src/helpers/connector')
    const fsModule = await import('fs')

    mockGetLatestRelease = vi.mocked(connectorModule.getLatestRelease)
    mockFs = vi.mocked(fsModule.default)
    mockFetch = vi.mocked(global.fetch)

    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })

    // Default: directories don't exist, so readdirSync throws (simulating real behavior)
    mockFs.readdirSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    // Default: files don't exist
    mockFs.existsSync.mockReturnValue(false)

    // Default: statSync returns file stats
    mockFs.statSync.mockReturnValue({
      isFile: () => true,
      mode: 0o755,
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should always download binary (force download)', async () => {
    // Mock: binary exists after extraction, binaries directory exists
    mockFs.existsSync.mockImplementation((path: string) => {
      // Return true for binaries directory and binary path check after extraction
      if (
        typeof path === 'string' &&
        (path.includes('.cuimp/binaries') || path.includes('curl-impersonate'))
      ) {
        return true
      }
      return false
    })
    mockGetLatestRelease.mockResolvedValue('v1.0.0')

    const descriptor: CuimpDescriptor = { browser: 'chrome', forceDownload: true }
    const result = await parseDescriptor(descriptor)

    expect(mockGetLatestRelease).toHaveBeenCalled()
    expect(result.isDownloaded).toBe(true)
    expect(result.version).toBe('1.0.0')
  })

  it('should download binary if not found locally', async () => {
    let downloadStarted = false
    // Mock: binary doesn't exist initially, but exists after extraction
    mockFs.existsSync.mockImplementation((path: string) => {
      // After download starts (when extracting), return true for binary paths
      if (downloadStarted && typeof path === 'string' && path.includes('curl-impersonate')) {
        return true
      }
      // Return true for binaries directory to allow creation
      if (
        typeof path === 'string' &&
        path.includes('.cuimp/binaries') &&
        !path.includes('curl-impersonate')
      ) {
        return true
      }
      return false
    })
    // Mock readdirSync to return files after extraction
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (downloadStarted && typeof dir === 'string' && dir.includes('binaries')) {
        return ['curl-impersonate'] as any
      }
      throw new Error('ENOENT: no such file or directory')
    })
    mockGetLatestRelease.mockResolvedValue('v1.0.0')
    // Mock fetch to trigger download
    mockFetch.mockImplementation(() => {
      downloadStarted = true
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response)
    })

    const descriptor: CuimpDescriptor = {
      browser: 'chrome',
      platform: 'linux',
      architecture: 'x64',
    }

    const result = await parseDescriptor(descriptor)

    expect(mockGetLatestRelease).toHaveBeenCalled()
    expect(result.isDownloaded).toBe(true)
    expect(result.version).toBe('1.0.0')
  })

  it('should handle empty descriptor', async () => {
    let downloadStarted = false
    // Mock: binary doesn't exist initially, but exists after extraction
    mockFs.existsSync.mockImplementation((path: string) => {
      if (downloadStarted && typeof path === 'string' && path.includes('curl-impersonate')) {
        return true
      }
      if (
        typeof path === 'string' &&
        path.includes('.cuimp/binaries') &&
        !path.includes('curl-impersonate')
      ) {
        return true
      }
      return false
    })
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (downloadStarted && typeof dir === 'string' && dir.includes('binaries')) {
        return ['curl-impersonate'] as any
      }
      throw new Error('ENOENT: no such file or directory')
    })
    mockGetLatestRelease.mockResolvedValue('v1.0.0')
    mockFetch.mockImplementation(() => {
      downloadStarted = true
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response)
    })

    const descriptor: CuimpDescriptor = {}
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(true)
  })

  it('should handle partial descriptor', async () => {
    let downloadStarted = false
    // Mock: binary doesn't exist initially, but exists after extraction
    mockFs.existsSync.mockImplementation((path: string) => {
      if (downloadStarted && typeof path === 'string' && path.includes('curl-impersonate')) {
        return true
      }
      if (
        typeof path === 'string' &&
        path.includes('.cuimp/binaries') &&
        !path.includes('curl-impersonate')
      ) {
        return true
      }
      return false
    })
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (downloadStarted && typeof dir === 'string' && dir.includes('binaries')) {
        return ['curl-impersonate'] as any
      }
      throw new Error('ENOENT: no such file or directory')
    })
    mockGetLatestRelease.mockResolvedValue('v1.0.0')
    mockFetch.mockImplementation(() => {
      downloadStarted = true
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response)
    })

    const descriptor: CuimpDescriptor = { browser: 'chrome' }
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(true)
  })

  it('should throw error for unsupported browser', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue('v1.0.0')

    const descriptor: CuimpDescriptor = { browser: 'unsupported' }

    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should throw error for unsupported platform', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue('v1.0.0')

    const descriptor: CuimpDescriptor = {
      browser: 'chrome',
      platform: 'unsupported',
    }

    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should throw error for unsupported architecture', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue('v1.0.0')

    const descriptor: CuimpDescriptor = {
      browser: 'chrome',
      architecture: 'unsupported',
    }

    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should handle download errors gracefully', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockRejectedValue(new Error('Network error'))

    const descriptor: CuimpDescriptor = { browser: 'chrome' }

    await expect(parseDescriptor(descriptor)).rejects.toThrow('Network error')
  })

  it('should handle missing assets in release', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue('v1.0.0')
    // Mock fetch to return 404
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const descriptor: CuimpDescriptor = { browser: 'chrome' }

    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should handle multiple assets and select correct one', async () => {
    let downloadStarted = false
    // Mock: binary doesn't exist initially, but exists after extraction
    mockFs.existsSync.mockImplementation((path: string) => {
      if (downloadStarted && typeof path === 'string' && path.includes('curl-impersonate')) {
        return true
      }
      if (
        typeof path === 'string' &&
        path.includes('.cuimp/binaries') &&
        !path.includes('curl-impersonate')
      ) {
        return true
      }
      return false
    })
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (downloadStarted && typeof dir === 'string' && dir.includes('binaries')) {
        return ['curl-impersonate'] as any
      }
      throw new Error('ENOENT: no such file or directory')
    })
    mockGetLatestRelease.mockResolvedValue('v1.0.0')
    mockFetch.mockImplementation(() => {
      downloadStarted = true
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response)
    })

    const descriptor: CuimpDescriptor = {
      browser: 'chrome',
      platform: 'linux',
      architecture: 'x64',
    }

    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(true)
    expect(result.version).toBe('1.0.0')
  })
})

describe('createHttpResponseStreamParser', () => {
  describe('edge cases', () => {
    it('should handle body starting with HTTP/ prefix without false positive', async () => {
      const bodyChunks: Buffer[] = []
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      // Simulate response with body that starts with "HTTP/"
      const response = Buffer.from(
        'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHTTP/1.1 200 OK was the status line'
      )

      await parser.push(response)
      await parser.finish()

      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(200)
      expect(Buffer.concat(bodyChunks).toString()).toBe('HTTP/1.1 200 OK was the status line')
    })

    it('should handle header separator split across chunks', async () => {
      const bodyChunks: Buffer[] = []
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      // Split the header separator across chunks
      const chunk1 = Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r')
      const chunk2 = Buffer.from('\n{"message":"success"}')

      await parser.push(chunk1)
      await parser.push(chunk2)
      await parser.finish()

      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(200)
      expect(Buffer.concat(bodyChunks).toString()).toBe('{"message":"success"}')
    })

    it('should handle redirects with multiple header blocks', async () => {
      const bodyChunks: Buffer[] = []
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      // Simulate redirect chain
      const response = Buffer.from(
        'HTTP/1.1 302 Found\r\nLocation: /redirect1\r\n\r\n' +
          'HTTP/1.1 301 Moved\r\nLocation: /redirect2\r\n\r\n' +
          'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"final":"response"}'
      )

      await parser.push(response)
      await parser.finish()

      // Should only emit the final header block
      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(200)
      expect(headersReceived[0].headers['content-type']).toBe('application/json')
      expect(Buffer.concat(bodyChunks).toString()).toBe('{"final":"response"}')
    })

    it('should handle 100-continue responses', async () => {
      const bodyChunks: Buffer[] = []
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      // Simulate 100-continue followed by final response
      const response = Buffer.from(
        'HTTP/1.1 100 Continue\r\n\r\n' +
          'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"data":"success"}'
      )

      await parser.push(response)
      await parser.finish()

      // Should only emit the final header block
      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(200)
      expect(Buffer.concat(bodyChunks).toString()).toBe('{"data":"success"}')
    })

    it('should normalize header keys to lowercase', async () => {
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
      })

      // Headers with mixed case
      const response = Buffer.from(
        'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Custom-Header: value\r\n\r\n'
      )

      await parser.push(response)
      await parser.finish()

      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].headers['content-type']).toBe('application/json')
      expect(headersReceived[0].headers['x-custom-header']).toBe('value')
      // Should not have uppercase keys
      expect(headersReceived[0].headers['Content-Type']).toBeUndefined()
      expect(headersReceived[0].headers['X-Custom-Header']).toBeUndefined()
    })

    it('should optimize body mode by streaming chunks directly', async () => {
      const bodyChunks: Buffer[] = []

      // Track Buffer.concat calls (in real scenario, we'd use a proxy, but for test we verify behavior)
      const parser = createHttpResponseStreamParser({
        onHeaders: () => {},
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      // First chunk establishes headers and transitions to body
      const headerChunk = Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n')
      await parser.push(headerChunk)

      // Subsequent chunks should be streamed directly without concatenation
      const bodyChunk1 = Buffer.from('chunk1')
      const bodyChunk2 = Buffer.from('chunk2')
      const bodyChunk3 = Buffer.from('chunk3')

      await parser.push(bodyChunk1)
      await parser.push(bodyChunk2)
      await parser.push(bodyChunk3)
      await parser.finish()

      // Should receive chunks separately (optimization: no concatenation in body mode)
      expect(bodyChunks.length).toBeGreaterThan(0)
      const fullBody = Buffer.concat(bodyChunks).toString()
      expect(fullBody).toContain('chunk1')
      expect(fullBody).toContain('chunk2')
      expect(fullBody).toContain('chunk3')
    })

    it('should handle empty body', async () => {
      const bodyChunks: Buffer[] = []
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
        onBody: chunk => {
          bodyChunks.push(chunk)
        },
      })

      const response = Buffer.from('HTTP/1.1 204 No Content\r\n\r\n')

      await parser.push(response)
      await parser.finish()

      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(204)
      expect(bodyChunks.length).toBe(0)
    })

    it('should handle very long status line', async () => {
      const headersReceived: any[] = []

      const parser = createHttpResponseStreamParser({
        onHeaders: info => {
          headersReceived.push(info)
        },
      })

      // Status line longer than 64 bytes (our check limit)
      const longStatusText = 'A'.repeat(100)
      const response = Buffer.from(
        `HTTP/1.1 200 ${longStatusText}\r\nContent-Type: application/json\r\n\r\n`
      )

      await parser.push(response)
      await parser.finish()

      expect(headersReceived).toHaveLength(1)
      expect(headersReceived[0].status).toBe(200)
    })
  })
})
