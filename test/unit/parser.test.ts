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

describe('parseDescriptor', () => {
  const mockGetLatestRelease = vi.mocked(await import('../../src/helpers/connector')).getLatestRelease
  const mockFs = vi.mocked(await import('fs')).default

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return existing binary path if found', async () => {
    const existingPath = '/usr/bin/curl-impersonate'
    mockFs.existsSync.mockReturnValue(true)
    mockFs.statSync.mockReturnValue({
      isFile: () => true,
      mode: 0o755
    } as any)

    const descriptor: CuimpDescriptor = { browser: 'chrome' }
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBe(existingPath)
    expect(result.isDownloaded).toBe(false)
  })

  it('should download binary if not found locally', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: [
        {
          name: 'curl-impersonate-chrome-linux-x64.tar.gz',
          browser_download_url: 'https://github.com/example/releases/download/v1.0.0/curl-impersonate-chrome-linux-x64.tar.gz'
        }
      ]
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
    mockFs.existsSync.mockReturnValue(false)
    
    const descriptor: CuimpDescriptor = {}
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(false)
  })

  it('should handle partial descriptor', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: [
        {
          name: 'curl-impersonate-chrome-linux-x64.tar.gz',
          browser_download_url: 'https://github.com/example/releases/download/v1.0.0/curl-impersonate-chrome-linux-x64.tar.gz'
        }
      ]
    })

    const descriptor: CuimpDescriptor = { browser: 'chrome' }
    const result = await parseDescriptor(descriptor)

    expect(result.binaryPath).toBeDefined()
    expect(result.isDownloaded).toBe(true)
  })

  it('should throw error for unsupported browser', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: []
    })

    const descriptor: CuimpDescriptor = { browser: 'unsupported' }
    
    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should throw error for unsupported platform', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: []
    })

    const descriptor: CuimpDescriptor = { 
      browser: 'chrome', 
      platform: 'unsupported' 
    }
    
    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should throw error for unsupported architecture', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: []
    })

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
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: []
    })

    const descriptor: CuimpDescriptor = { browser: 'chrome' }
    
    await expect(parseDescriptor(descriptor)).rejects.toThrow()
  })

  it('should handle multiple assets and select correct one', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockGetLatestRelease.mockResolvedValue({
      tag_name: 'v1.0.0',
      assets: [
        {
          name: 'curl-impersonate-chrome-linux-x64.tar.gz',
          browser_download_url: 'https://github.com/example/releases/download/v1.0.0/curl-impersonate-chrome-linux-x64.tar.gz'
        },
        {
          name: 'curl-impersonate-firefox-linux-x64.tar.gz',
          browser_download_url: 'https://github.com/example/releases/download/v1.0.0/curl-impersonate-firefox-linux-x64.tar.gz'
        }
      ]
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
