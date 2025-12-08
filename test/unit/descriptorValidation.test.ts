import { describe, it, expect } from 'vitest'
import { validateDescriptor } from '../../src/validations/descriptorValidation'
import { CuimpDescriptor } from '../../src/types/cuimpTypes'

describe('validateDescriptor', () => {
  it('should pass validation for valid descriptor', () => {
    const validDescriptor: CuimpDescriptor = {
      browser: 'chrome',
      version: '123',
      architecture: 'x64',
      platform: 'linux',
    }

    expect(() => validateDescriptor(validDescriptor)).not.toThrow()
  })

  it('should pass validation for empty descriptor', () => {
    const emptyDescriptor: CuimpDescriptor = {}

    expect(() => validateDescriptor(emptyDescriptor)).not.toThrow()
  })

  it('should pass validation for partial descriptor', () => {
    const partialDescriptor: CuimpDescriptor = {
      browser: 'firefox',
    }

    expect(() => validateDescriptor(partialDescriptor)).not.toThrow()
  })

  describe('browser validation', () => {
    it('should throw error for invalid browser', () => {
      const invalidDescriptor: CuimpDescriptor = {
        browser: 'invalid-browser',
      }

      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Browser 'invalid-browser' is not supported. Supported browsers: chrome, firefox, edge, safari"
      )
    })

    it('should accept valid browsers', () => {
      const validBrowsers = ['chrome', 'firefox', 'edge', 'safari']

      validBrowsers.forEach(browser => {
        const descriptor: CuimpDescriptor = { browser }
        expect(() => validateDescriptor(descriptor)).not.toThrow()
      })
    })
  })

  describe('architecture validation', () => {
    it('should throw error for invalid architecture', () => {
      const invalidDescriptor: CuimpDescriptor = {
        architecture: 'invalid-arch',
      }

      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Architecture 'invalid-arch' is not supported. Supported architectures: x64, arm64"
      )
    })

    it('should accept valid architectures', () => {
      const validArchitectures = ['x64', 'arm64']

      validArchitectures.forEach(architecture => {
        const descriptor: CuimpDescriptor = { architecture }
        expect(() => validateDescriptor(descriptor)).not.toThrow()
      })
    })
  })

  describe('platform validation', () => {
    it('should throw error for invalid platform', () => {
      const invalidDescriptor: CuimpDescriptor = {
        platform: 'invalid-platform',
      }

      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Platform 'invalid-platform' is not supported. Supported platforms: linux, windows, macos"
      )
    })

    it('should accept valid platforms', () => {
      const validPlatforms = ['linux', 'windows', 'macos']

      validPlatforms.forEach(platform => {
        const descriptor: CuimpDescriptor = { platform }
        expect(() => validateDescriptor(descriptor)).not.toThrow()
      })
    })
  })

  describe('version validation', () => {
    it('should throw error for invalid version format', () => {
      const invalidVersions = ['12', '1234', '12.3', '12-3']

      invalidVersions.forEach(version => {
        const descriptor: CuimpDescriptor = { version }
        expect(() => validateDescriptor(descriptor)).toThrow(
          'Version must be in the format of XYZ or "latest"'
        )
      })
    })

    it('should accept valid version format', () => {
      const validVersions = ['123', '456', '789', '000', '999']

      validVersions.forEach(version => {
        const descriptor: CuimpDescriptor = { version }
        expect(() => validateDescriptor(descriptor)).not.toThrow()
      })
    })
  })

  describe('multiple validation errors', () => {
    it('should throw error for first invalid field encountered', () => {
      const invalidDescriptor: CuimpDescriptor = {
        browser: 'invalid-browser',
        architecture: 'invalid-arch',
        platform: 'invalid-platform',
        version: 'invalid-version',
      }

      expect(() => validateDescriptor(invalidDescriptor)).toThrow(
        "Browser 'invalid-browser' is not supported"
      )
    })
  })
})
