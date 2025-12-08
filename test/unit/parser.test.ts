import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDescriptor } from '../../src/helpers/parser'
import { CuimpDescriptor } from '../../src/types/cuimpTypes'

// Mock the connector module
vi.mock('../../src/helpers/connector', () => ({
  getLatestRelease: vi.fn()
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
      S_IXOTH: 0o001
    }
  }
}))

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/') || '.'),
    basename: vi.fn((p) => p.split('/').pop() || ''),
    extname: vi.fn((p) => {
      const parts = p.split('.')
      return parts.length > 1 ? '.' + parts.pop() : ''
    })
  }
}))

// Mock tar module
vi.mock('tar', () => ({
  extract: vi.fn()
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
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
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
      mode: 0o755
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should always download binary (force download)', async () => {
    // Mock: binary exists after extraction, binaries directory exists
    mockFs.existsSync.mockImplementation((path: string) => {
      // Return true for binaries directory and binary path check after extraction
      if (typeof path === 'string' && (path.includes('.cuimp/binaries') || path.includes('curl-impersonate'))) {
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
      if (typeof path === 'string' && path.includes('.cuimp/binaries') && !path.includes('curl-impersonate')) {
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
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      } as Response)
    })

    const descriptor: CuimpDescriptor = { 
      browser: 'chrome', 
      platform: 'linux', 
      architecture: 'x64' 
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
      if (typeof path === 'string' && path.includes('.cuimp/binaries') && !path.includes('curl-impersonate')) {
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
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
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
      if (typeof path === 'string' && path.includes('.cuimp/binaries') && !path.includes('curl-impersonate')) {
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
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
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
      platform: 'unsupported' 
    }
    
    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should throw error for unsupported architecture', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue('v1.0.0')

    const descriptor: CuimpDescriptor = { 
      browser: 'chrome', 
      architecture: 'unsupported' 
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
      statusText: 'Not Found'
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
      if (typeof path === 'string' && path.includes('.cuimp/binaries') && !path.includes('curl-impersonate')) {
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
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      } as Response)
    })

    const descriptor: CuimpDescriptor = { 
      browser: 'chrome', 
      platform: 'linux', 
      architecture: 'x64' 
    }
    
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(true)
    expect(result.version).toBe('1.0.0')
  })
})
