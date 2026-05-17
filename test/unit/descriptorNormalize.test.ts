import { describe, it, expect, vi } from 'vitest'
import {
  normalizePlatform,
  normalizeArchitecture,
  normalizeDescriptor,
  resolveBinaryTarget,
} from '../../src/helpers/descriptorNormalize'

describe('normalizePlatform', () => {
  it('normalizes casing and aliases', () => {
    expect(normalizePlatform('iOS')).toBe('ios')
    expect(normalizePlatform('macOS')).toBe('macos')
    expect(normalizePlatform('Android')).toBe('android')
    expect(normalizePlatform('darwin')).toBe('macos')
  })
})

describe('normalizeArchitecture', () => {
  it('normalizes common arch names', () => {
    expect(normalizeArchitecture('x86_64')).toBe('x64')
    expect(normalizeArchitecture('aarch64')).toBe('arm64')
  })
})

describe('normalizeDescriptor', () => {
  it('normalizes platform and architecture fields', () => {
    expect(
      normalizeDescriptor({ platform: 'iOS', architecture: 'ARM64', browser: 'safari' })
    ).toEqual({
      platform: 'ios',
      architecture: 'arm64',
      browser: 'safari',
    })
  })
})

describe('resolveBinaryTarget', () => {
  it('falls back ios to macos on macos host', () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const result = resolveBinaryTarget(
      { platform: 'ios', architecture: 'arm64' },
      { platform: 'macos', architecture: 'arm64' },
      logger
    )
    expect(result.downloadPlatform).toBe('macos')
    expect(result.requestedPlatform).toBe('ios')
    expect(result.architecture).toBe('arm64')
    expect(logger.debug).toHaveBeenCalled()
  })

  it('falls back android to linux on linux host', () => {
    const result = resolveBinaryTarget(
      { platform: 'android', architecture: 'x64' },
      { platform: 'linux', architecture: 'x64' }
    )
    expect(result.downloadPlatform).toBe('linux')
    expect(result.requestedPlatform).toBe('android')
  })

  it('uses host platform when descriptor platform is omitted', () => {
    const result = resolveBinaryTarget({}, { platform: 'linux', architecture: 'x64' })
    expect(result.downloadPlatform).toBe('linux')
    expect(result.requestedPlatform).toBe('linux')
  })

  it('keeps ios when host is ios', () => {
    const result = resolveBinaryTarget(
      { platform: 'ios' },
      { platform: 'ios', architecture: 'arm64' }
    )
    expect(result.downloadPlatform).toBe('ios')
  })

  it('falls back ios to windows on windows host', () => {
    const result = resolveBinaryTarget(
      { platform: 'ios' },
      { platform: 'windows', architecture: 'x64' }
    )
    expect(result.downloadPlatform).toBe('windows')
  })
})
