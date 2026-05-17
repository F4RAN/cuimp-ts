import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getLatestRelease } from '../../src/helpers/connector'

describe('getLatestRelease', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('skips GitHub prerelease flag and alpha-tagged releases (#43)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { tag_name: 'v2.0.0a1', prerelease: true, draft: false },
          { tag_name: 'v2.0.0a1', prerelease: false, draft: false },
          { tag_name: 'v0.6.1', prerelease: false, draft: false },
          { tag_name: 'v0.6.0', prerelease: false, draft: true },
        ]),
    })

    await expect(getLatestRelease()).resolves.toBe('v0.6.1')
  })

  it('throws when no stable release exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { tag_name: 'v2.0.0a1', prerelease: true, draft: false },
          { tag_name: 'v3.0.0-beta.1', prerelease: false, draft: false },
        ]),
    })

    await expect(getLatestRelease()).rejects.toThrow('No stable release found')
  })

  it('throws on GitHub API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(getLatestRelease()).rejects.toThrow('GitHub API error: 500')
  })
})
