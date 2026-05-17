import { CuimpDescriptor, Logger } from '../types/cuimpTypes'
import { PLATFORM_LIST } from '../constants/cuimpConstants'

const MOBILE_PLATFORMS = ['ios', 'android'] as const

export interface BinaryTarget {
  architecture: string
  downloadPlatform: string
  requestedPlatform: string
}

const DESKTOP_FALLBACK: Record<string, Record<string, string>> = {
  ios: {
    macos: 'macos',
    linux: 'linux',
    windows: 'windows',
  },
  android: {
    linux: 'linux',
    macos: 'macos',
    windows: 'windows',
  },
}

const PLATFORM_ALIASES: Record<string, string> = {
  'mac os': 'macos',
  macos: 'macos',
  darwin: 'macos',
  'iphone os': 'ios',
  ios: 'ios',
  android: 'android',
  linux: 'linux',
  windows: 'windows',
  win32: 'windows',
}

/**
 * Normalizes a platform string to a supported lowercase value.
 */
export const normalizePlatform = (input?: string): string | undefined => {
  if (!input) return undefined
  const key = input.trim().toLowerCase()
  return PLATFORM_ALIASES[key] ?? key
}

/**
 * Normalizes architecture to supported lowercase values.
 */
export const normalizeArchitecture = (input?: string): string | undefined => {
  if (!input) return undefined
  const key = input.trim().toLowerCase()
  const aliases: Record<string, string> = {
    x86_64: 'x64',
    x64: 'x64',
    aarch64: 'arm64',
    arm64: 'arm64',
    arm: 'arm',
  }
  return aliases[key] ?? key
}

/**
 * Returns a copy of the descriptor with normalized platform and architecture.
 */
export const normalizeDescriptor = (descriptor: CuimpDescriptor): CuimpDescriptor => {
  const platform = normalizePlatform(descriptor.platform)
  const architecture = normalizeArchitecture(descriptor.architecture)
  return {
    ...descriptor,
    ...(platform !== undefined ? { platform } : {}),
    ...(architecture !== undefined ? { architecture } : {}),
  }
}

/**
 * Resolves which platform/architecture to use for binary download on this host.
 * Mobile platforms fall back to the host OS when the mobile binary cannot run locally.
 */
export const resolveBinaryTarget = (
  descriptor: CuimpDescriptor,
  host: { architecture: string; platform: string },
  logger?: Logger
): BinaryTarget => {
  const normalized = normalizeDescriptor(descriptor)
  const requestedPlatform = normalized.platform ?? host.platform
  const architecture = normalized.architecture ?? host.architecture

  if (!PLATFORM_LIST.includes(requestedPlatform)) {
    throw new Error(
      `Unsupported platform: ${requestedPlatform}. Supported platforms: ${PLATFORM_LIST.join(', ')}`
    )
  }

  let downloadPlatform = requestedPlatform

  if (
    MOBILE_PLATFORMS.includes(requestedPlatform as (typeof MOBILE_PLATFORMS)[number]) &&
    requestedPlatform !== host.platform
  ) {
    const fallback = DESKTOP_FALLBACK[requestedPlatform]?.[host.platform]
    if (fallback) {
      downloadPlatform = fallback
      logger?.debug?.(
        `Platform '${requestedPlatform}' requested; using host platform '${downloadPlatform}' for binary download`
      )
    } else {
      throw new Error(
        `Cannot download '${requestedPlatform}' binaries on host platform '${host.platform}'. ` +
          `Run on ${requestedPlatform} or set platform to a supported host OS.`
      )
    }
  }

  return {
    architecture,
    downloadPlatform,
    requestedPlatform,
  }
}

export const BROWSER_VERSION_PATTERN = /^\d{3,4}[a-z]?$/
