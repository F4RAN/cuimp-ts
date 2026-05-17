import { describe, it, expect } from 'vitest'
import { validateDescriptor } from '../../src/validations/descriptorValidation'
import { resolveBinaryTarget } from '../../src/helpers/descriptorNormalize'
import { buildDownloadAssetName } from '../../src/helpers/parser'

/**
 * Regression coverage for issue #40 (iOS platform + Safari 2601).
 */
describe('mobile platforms (issue #40)', () => {
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
})
