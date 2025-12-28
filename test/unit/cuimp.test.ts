import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Cuimp } from '../../src/cuimp'
import { CuimpDescriptor, CuimpOptions } from '../../src/types/cuimpTypes'

// Mock the parser module - use importOriginal to get real parseHttpResponse and getStatusText
vi.mock('../../src/helpers/parser', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/helpers/parser')>()
  return {
    ...actual,
    parseDescriptor: vi.fn(),
  }
})

// Mock the validation module
vi.mock('../../src/validations/descriptorValidation', () => ({
  validateDescriptor: vi.fn(),
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    constants: {
      S_IXUSR: 0o100,
      S_IXGRP: 0o010,
      S_IXOTH: 0o001,
    },
  },
}))

describe('Cuimp', () => {
  let cuimp: Cuimp
  let mockParseDescriptor: any
  let mockValidateDescriptor: any
  let mockFs: any

  beforeEach(async () => {
    vi.clearAllMocks()
    cuimp = new Cuimp()

    // Get mocked functions
    const parserModule = await import('../../src/helpers/parser')
    const validationModule = await import('../../src/validations/descriptorValidation')
    const fsModule = await import('fs')

    mockParseDescriptor = vi.mocked(parserModule.parseDescriptor)
    mockValidateDescriptor = vi.mocked(validationModule.validateDescriptor)
    mockFs = vi.mocked(fsModule.default)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const instance = new Cuimp()
      expect(instance.getDescriptor()).toEqual({})
      expect(instance.getBinaryPath()).toBe('')
    })

    it('should create instance with custom options', () => {
      const options: CuimpOptions = {
        descriptor: { browser: 'chrome', version: '123' },
        path: '/custom/path',
      }
      const instance = new Cuimp(options)
      expect(instance.getDescriptor()).toEqual(options.descriptor)
      expect(instance.getBinaryPath()).toBe(options.path)
    })
  })

  describe('getDescriptor', () => {
    it('should return a copy of the descriptor', () => {
      const descriptor: CuimpDescriptor = { browser: 'chrome' }
      cuimp.setDescriptor(descriptor)

      const returned = cuimp.getDescriptor()
      expect(returned).toEqual(descriptor)
      expect(returned).not.toBe(descriptor) // Should be a copy
    })
  })

  describe('getBinaryPath', () => {
    it('should return the current binary path', () => {
      const path = '/usr/bin/curl-impersonate'
      cuimp.setBinaryPath(path)
      expect(cuimp.getBinaryPath()).toBe(path)
    })
  })

  describe('getBinaryInfo', () => {
    it('should return undefined when no binary info is available', () => {
      expect(cuimp.getBinaryInfo()).toBeUndefined()
    })
  })

  describe('setDescriptor', () => {
    it('should update descriptor and reset path and binary info', () => {
      const descriptor: CuimpDescriptor = { browser: 'firefox' }
      cuimp.setBinaryPath('/some/path')

      cuimp.setDescriptor(descriptor)

      expect(cuimp.getDescriptor()).toEqual(descriptor)
      expect(cuimp.getBinaryPath()).toBe('')
      expect(cuimp.getBinaryInfo()).toBeUndefined()
    })

    it('should create a copy of the descriptor', () => {
      const descriptor: CuimpDescriptor = { browser: 'chrome' }
      cuimp.setDescriptor(descriptor)

      descriptor.browser = 'firefox' // Modify original
      expect(cuimp.getDescriptor().browser).toBe('chrome') // Should not be affected
    })
  })

  describe('setBinaryPath', () => {
    it('should update binary path and reset binary info', () => {
      const path = '/usr/bin/curl-impersonate'
      cuimp.setBinaryPath(path)

      expect(cuimp.getBinaryPath()).toBe(path)
      expect(cuimp.getBinaryInfo()).toBeUndefined()
    })
  })

  describe('isBinaryExecutable', () => {
    it('should return false if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false)

      const result = await (cuimp as any).isBinaryExecutable('/nonexistent/path')
      expect(result).toBe(false)
    })

    it('should return false if path is not a file', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ isFile: () => false } as any)

      const result = await (cuimp as any).isBinaryExecutable('/some/directory')
      expect(result).toBe(false)
    })

    it('should return true for executable file on Unix', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755, // Executable permissions
      } as any)

      // Mock process.platform to be non-Windows
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux' })

      const result = await (cuimp as any).isBinaryExecutable('/usr/bin/curl-impersonate')
      expect(result).toBe(true)

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('should return true for any file on Windows', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o644, // Non-executable permissions
      } as any)

      // Mock process.platform to be Windows
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

      const result = await (cuimp as any).isBinaryExecutable('/usr/bin/curl-impersonate')
      expect(result).toBe(true)

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('buildCommandPreview', () => {
    it('should build correct command for GET request', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      const result = await cuimp.buildCommandPreview('https://example.com', 'GET')
      expect(result).toBe(`${mockBinaryPath} -X GET "https://example.com"`)
    })

    it('should build correct command for POST request', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      const result = await cuimp.buildCommandPreview('https://example.com', 'POST')
      expect(result).toBe(`${mockBinaryPath} -X POST "https://example.com"`)
    })

    it('should convert method to uppercase', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      const result = await cuimp.buildCommandPreview('https://example.com', 'get')
      expect(result).toBe(`${mockBinaryPath} -X GET "https://example.com"`)
    })

    it('should throw error for invalid URL', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      await expect(cuimp.buildCommandPreview('', 'GET')).rejects.toThrow(
        'Failed to build command preview: URL must be a non-empty string'
      )
    })

    it('should throw error for invalid method', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      await expect(cuimp.buildCommandPreview('https://example.com', '')).rejects.toThrow(
        'Failed to build command preview: Method must be a non-empty string'
      )
    })
  })

  describe('verifyBinary', () => {
    it('should return existing path if binary is already executable', async () => {
      const existingPath = '/usr/bin/curl-impersonate'
      cuimp.setBinaryPath(existingPath)

      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      const result = await cuimp.verifyBinary()
      expect(result).toBe(existingPath)
    })

    it('should validate descriptor when provided', async () => {
      const descriptor: CuimpDescriptor = { browser: 'chrome' }
      cuimp.setDescriptor(descriptor)

      mockParseDescriptor.mockResolvedValue({
        binaryPath: '/usr/bin/curl-impersonate',
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      await cuimp.verifyBinary()

      expect(mockValidateDescriptor).toHaveBeenCalledWith(descriptor)
    })

    it('should throw error if binary is not executable after parsing', async () => {
      mockParseDescriptor.mockResolvedValue({
        binaryPath: '/usr/bin/curl-impersonate',
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(false)

      await expect(cuimp.verifyBinary()).rejects.toThrow(
        'Failed to verify binary: Binary is not executable: /usr/bin/curl-impersonate'
      )
    })
  })

  describe('ensurePath', () => {
    it('should be an alias for verifyBinary', async () => {
      const mockBinaryPath = '/usr/bin/curl-impersonate'
      mockParseDescriptor.mockResolvedValue({
        binaryPath: mockBinaryPath,
        isDownloaded: false,
      })
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as any)

      const result = await cuimp.ensurePath()
      expect(result).toBe(mockBinaryPath)
    })
  })

  describe('download', () => {
    it('should download binary without verification', async () => {
      const mockBinaryInfo = {
        binaryPath: '/usr/bin/curl-impersonate',
        isDownloaded: true,
        version: '1.0.0',
      }
      mockParseDescriptor.mockResolvedValue(mockBinaryInfo)

      const result = await cuimp.download()

      expect(result).toEqual(mockBinaryInfo)
      expect(mockParseDescriptor).toHaveBeenCalledWith({}, expect.any(Object), true)
    })

    it('should download binary with descriptor', async () => {
      const mockBinaryInfo = {
        binaryPath: '/usr/bin/curl-impersonate',
        isDownloaded: true,
        version: '1.0.0',
      }
      mockParseDescriptor.mockResolvedValue(mockBinaryInfo)

      cuimp.setDescriptor({ browser: 'chrome', version: '123' })
      const result = await cuimp.download()

      expect(result).toEqual(mockBinaryInfo)
      expect(mockValidateDescriptor).toHaveBeenCalledWith({ browser: 'chrome', version: '123' })
    })

    it('should throw error if download fails', async () => {
      mockParseDescriptor.mockRejectedValue(new Error('Download failed'))

      await expect(cuimp.download()).rejects.toThrow('Failed to download binary: Download failed')
    })
  })
})
