import { afterEach, describe, it, expect } from 'vitest'
import { validateDescriptor } from '../../src/validations/descriptorValidation'
import { resolveBinaryTarget } from '../../src/helpers/descriptorNormalize'
import { buildDownloadAssetName, getSystemInfo } from '../../src/helpers/parser'

/**
 * Purpose: Covers mobile platform descriptor and host-detection regressions.
 * Caller: Vitest mobile platform test script.
 * Dependencies: descriptor validation, descriptor normalization, parser helpers.
 * Main Functions: mobile platform and Termux Android assertions.
 * Side Effects: Temporarily mutates process.env for host detection tests.
 */

/**
 * Regression coverage for issue #40 (iOS platform + Safari 2601).
 */
const originalTermuxVersion = process.env.TERMUX_VERSION
const originalPrefix = process.env.PREFIX
const originalPlatform = process.platform

const restoreTermuxEnv = (): void => {
  if (originalTermuxVersion === undefined) {
    delete process.env.TERMUX_VERSION
  } else {
    process.env.TERMUX_VERSION = originalTermuxVersion
  }

  if (originalPrefix === undefined) {
    delete process.env.PREFIX
  } else {
    process.env.PREFIX = originalPrefix
  }

  Object.defineProperty(process, 'platform', { value: originalPlatform })
}

describe('mobile platforms (issue #40)', () => {
  afterEach(() => {
    restoreTermuxEnv()
  })

  it('accepts reporter config: safari 2601 on iOS', () => {
    expect(() =>
      validateDescriptor({ browser: 'safari', version: '2601', platform: 'iOS' })
    ).not.toThrow()
  })

  it('falls back to macos download when impersonating iOS Safari on macOS host', () => {
    const target = resolveBinaryTarget(
      { browser: 'safari', version: '2601', platform: 'ios' },
      { platform: 'macos', architecture: 'arm64' }
    )
    expect(target.downloadPlatform).toBe('macos')
    expect(target.requestedPlatform).toBe('ios')
    expect(target.architecture).toBe('arm64')
  })

  it('falls back to linux download when impersonating Android Chrome on linux host', () => {
    const target = resolveBinaryTarget(
      { browser: 'chrome', version: '136', platform: 'android' },
      { platform: 'linux', architecture: 'x64' }
    )
    expect(target.downloadPlatform).toBe('linux')
    expect(target.requestedPlatform).toBe('android')
  })

  it('uses native ios asset naming when host is ios', () => {
    const target = resolveBinaryTarget(
      { browser: 'safari', version: '2601', platform: 'ios' },
      { platform: 'ios', architecture: 'arm64' }
    )
    expect(target.downloadPlatform).toBe('ios')
    expect(buildDownloadAssetName('v1.0.0', 'arm64', 'ios')).toBe(
      'curl-impersonate-v1.0.0.arm64-apple-ios.tar.gz'
    )
  })

  it('uses native android asset naming when download target is android', () => {
    expect(buildDownloadAssetName('v1.0.0', 'arm64', 'android')).toBe(
      'curl-impersonate-v1.0.0.aarch64-linux-android.tar.gz'
    )
    expect(buildDownloadAssetName('v1.0.0', 'x64', 'android')).toBe(
      'curl-impersonate-v1.0.0.x86_64-linux-android.tar.gz'
    )
  })

  it('detects native Android Node platform', () => {
    Object.defineProperty(process, 'platform', { value: 'android' })
    delete process.env.TERMUX_VERSION
    delete process.env.PREFIX

    expect(getSystemInfo().platform).toBe('android')
  })

  it('detects Termux Android from TERMUX_VERSION', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    process.env.TERMUX_VERSION = '0.118.2'
    delete process.env.PREFIX

    expect(getSystemInfo().platform).toBe('android')
  })

  it('detects Termux Android from PREFIX', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    delete process.env.TERMUX_VERSION
    process.env.PREFIX = '/data/data/com.termux/files/usr'

    expect(getSystemInfo().platform).toBe('android')
  })
})
