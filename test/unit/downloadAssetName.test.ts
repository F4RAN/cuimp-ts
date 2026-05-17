import { describe, it, expect } from 'vitest'
import { buildDownloadAssetName } from '../../src/helpers/parser'

describe('buildDownloadAssetName', () => {
  const tag = 'v2.0.0a1'

  it('builds ios device asset for arm64', () => {
    expect(buildDownloadAssetName(tag, 'arm64', 'ios')).toBe(
      'curl-impersonate-v2.0.0a1.arm64-apple-ios.tar.gz'
    )
  })

  it('builds ios simulator asset for x64', () => {
    expect(buildDownloadAssetName(tag, 'x64', 'ios')).toBe(
      'curl-impersonate-v2.0.0a1.x86_64-apple-ios-simulator.tar.gz'
    )
  })

  it('builds android assets', () => {
    expect(buildDownloadAssetName(tag, 'arm64', 'android')).toBe(
      'curl-impersonate-v2.0.0a1.aarch64-linux-android.tar.gz'
    )
    expect(buildDownloadAssetName(tag, 'x64', 'android')).toBe(
      'curl-impersonate-v2.0.0a1.x86_64-linux-android.tar.gz'
    )
  })

  it('builds macos asset', () => {
    expect(buildDownloadAssetName(tag, 'arm64', 'macos')).toBe(
      'curl-impersonate-v2.0.0a1.arm64-macos.tar.gz'
    )
  })
})
