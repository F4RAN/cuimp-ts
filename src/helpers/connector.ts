import { Logger } from '../types/cuimpTypes'

interface GitHubRelease {
  tag_name: string
  prerelease: boolean
  draft: boolean
  [key: string]: unknown
}

/** Matches semver pre-release segments and tags like v2.0.0a1 (issue #43). */
const PRERELEASE_TAG_PATTERN = /(?:[-._](?:alpha|beta|rc|pre|a\d|b\d)|\d+a\d+$)/i

export const getLatestRelease = async (): Promise<string> => {
  const response = await fetch(
    `https://api.github.com/repos/lexiforest/curl-impersonate/releases?per_page=20`
  )
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }
  const releases = (await response.json()) as GitHubRelease[]
  const stable = releases.find(
    r => !r.draft && !r.prerelease && !PRERELEASE_TAG_PATTERN.test(r.tag_name)
  )
  if (!stable) {
    throw new Error('No stable release found for curl-impersonate')
  }
  return stable.tag_name // e.g. "v1.2.2"
}

export const getVersion = async (
  browser: string,
  architecture: string,
  platform: string,
  logger: Logger = console
): Promise<string> => {
  const latestRelease = await getLatestRelease()
  logger.info(latestRelease)
  return latestRelease.replace(/^v/, '') // strip leading "v"
}
