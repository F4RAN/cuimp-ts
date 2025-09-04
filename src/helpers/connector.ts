import { LIB_URL } from "../constants/cuimpConstants"

export const getLatestRelease = async () => {
    const response = await fetch(`https://api.github.com/repos/lexiforest/curl-impersonate/releases/latest`)
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
    }
    const data = await response.json()
    return data.tag_name // e.g. "v1.2.2"
}

export const getVersion = async (browser: string, architecture: string, platform: string) => {
    const latestRelease = await getLatestRelease()
    console.log(latestRelease)
    return latestRelease.replace(/^v/, "") // strip leading "v"
}
