import { Logger } from '../types/cuimpTypes'

interface GitHubRelease {
  tag_name: string
  [key: string]: unknown
}

export const getLatestRelease = async (): Promise<string> => {
  const response = await fetch(
    `https://api.github.com/repos/lexiforest/curl-impersonate/releases/latest`
  )
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }
  const data = (await response.json()) as GitHubRelease
  return data.tag_name // e.g. "v1.2.2"
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
