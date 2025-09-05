import { describe, it, expect } from 'vitest'
import { validateDescriptor } from '../src/validations/descriptorValidation'
import { CuimpDescriptor } from '../src/types/cuimpTypes'

describe('Basic Tests', () => {
  describe('validateDescriptor', () => {
    it('should pass validation for valid descriptor', () => {
      const validDescriptor: CuimpDescriptor = {
        browser: 'chrome',
        version: '123',
        architecture: 'x64',
        platform: 'linux'
      }
      
      expect(() => validateDescriptor(validDescriptor)).not.toThrow()
    })

    it('should pass validation for empty descriptor', () => {
      const emptyDescriptor: CuimpDescriptor = {}
      
      expect(() => validateDescriptor(emptyDescriptor)).not.toThrow()
    })

    it('should throw error for invalid browser', () => {
      const invalidDescriptor: CuimpDescriptor = {
        browser: 'invalid-browser'
      }
      
      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Browser 'invalid-browser' is not supported. Supported browsers: chrome, firefox, edge, safari"
      )
    })

    it('should throw error for invalid architecture', () => {
      const invalidDescriptor: CuimpDescriptor = {
        architecture: 'invalid-arch'
      }
      
      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Architecture 'invalid-arch' is not supported. Supported architectures: x64, arm64"
      )
    })

    it('should throw error for invalid platform', () => {
      const invalidDescriptor: CuimpDescriptor = {
        platform: 'invalid-platform'
      }
      
      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Platform 'invalid-platform' is not supported. Supported platforms: linux, windows, macos"
      )
    })

    it('should throw error for invalid version format', () => {
      const invalidDescriptor: CuimpDescriptor = {
        version: '12'
      }
      
      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        'Version must be in the format of XYZ'
      )
    })

    it('should accept valid version format', () => {
      const validDescriptor: CuimpDescriptor = {
        version: '123'
      }
      
      expect(() => validateDescriptor(validDescriptor)).not.toThrow()
    })
  })

  describe('Type exports', () => {
    it('should export CuimpDescriptor type', () => {
      const descriptor: CuimpDescriptor = { browser: 'chrome' }
      expect(descriptor.browser).toBe('chrome')
    })

    it('should export Method type', () => {
      const method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' = 'GET'
      expect(method).toBe('GET')
    })
  })

  describe('Constants', () => {
    it('should have correct browser list', async () => {
      const { BROWSER_LIST } = await import('../src/constants/cuimpConstants')
      expect(BROWSER_LIST).toEqual(['chrome', 'firefox', 'edge', 'safari'])
    })

    it('should have correct architecture list', async () => {
      const { ARCHITECTURE_LIST } = await import('../src/constants/cuimpConstants')
      expect(ARCHITECTURE_LIST).toEqual(['x64', 'arm64'])
    })

    it('should have correct platform list', async () => {
      const { PLATFORM_LIST } = await import('../src/constants/cuimpConstants')
      expect(PLATFORM_LIST).toEqual(['linux', 'windows', 'macos'])
    })
  })
})
