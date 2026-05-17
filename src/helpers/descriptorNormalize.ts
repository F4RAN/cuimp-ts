import { CuimpDescriptor, CuimpDescriptorInput, Logger } from '../types/cuimpTypes'
import { ARCHITECTURE_LIST, PLATFORM_LIST } from '../constants/cuimpConstants'

const MOBILE_PLATFORMS = ['ios', 'android'] as const

export interface BinaryTarget {
  architecture: string
  downloadPlatform: string
  requestedPlatform: string
}

type Platform = NonNullable<CuimpDescriptor['platform']>
type Architecture = NonNullable<CuimpDescriptor['architecture']>
type Browser = NonNullable<CuimpDescriptor['browser']>

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

const isPlatform = (value: string): value is Platform =>
  (PLATFORM_LIST as readonly string[]).includes(value)

const isArchitecture = (value: string): value is Architecture =>
  (ARCHITECTURE_LIST as readonly string[]).includes(value)

const isBrowser = (value: string): value is Browser =>
  (['chrome', 'firefox', 'edge', 'safari'] as readonly string[]).includes(value)

/**
 * Normalizes a platform string to a supported lowercase value.
 */
export const normalizePlatform = (input?: string): Platform | undefined => {
  if (!input) return undefined
  const key = input.trim().toLowerCase()
  const mapped = PLATFORM_ALIASES[key] ?? key
  return isPlatform(mapped) ? mapped : undefined
}

/**
 * Platform string for validation error messages (includes unknown values).
 */
export const platformForValidation = (input: string): string =>
  normalizePlatform(input) ?? input.trim().toLowerCase()

/**
 * Normalizes architecture to supported lowercase values.
 */
export const normalizeArchitecture = (input?: string): Architecture | undefined => {
  if (!input) return undefined
  const key = input.trim().toLowerCase()
  const aliases: Record<string, string> = {
    x86_64: 'x64',
    x64: 'x64',
    aarch64: 'arm64',
    arm64: 'arm64',
    arm: 'arm',
  }
  const mapped = aliases[key] ?? key
  return isArchitecture(mapped) ? mapped : undefined
}

export const architectureForValidation = (input: string): string =>
  normalizeArchitecture(input) ?? input.trim().toLowerCase()

/**
 * Returns a copy of the descriptor with normalized platform and architecture.
 */
export const normalizeDescriptor = (descriptor: CuimpDescriptorInput): CuimpDescriptor => {
  const result: CuimpDescriptor = {}

  if (descriptor.browser && isBrowser(descriptor.browser)) {
    result.browser = descriptor.browser
  }
  if (descriptor.version !== undefined) {
    result.version = descriptor.version
  }
  if (descriptor.forceDownload !== undefined) {
    result.forceDownload = descriptor.forceDownload
  }

  const platform = descriptor.platform ? normalizePlatform(descriptor.platform) : undefined
  if (platform) {
    result.platform = platform
  }

  const architecture = descriptor.architecture
    ? normalizeArchitecture(descriptor.architecture)
    : undefined
  if (architecture) {
    result.architecture = architecture
  }

  return result
}

/**
 * Resolves which platform/architecture to use for binary download on this host.
 * Mobile platforms fall back to the host OS when the mobile binary cannot run locally.
 */
export const resolveBinaryTarget = (
  descriptor: CuimpDescriptorInput,
  host: { architecture: string; platform: string },
  logger?: Logger
): BinaryTarget => {
  const normalized = normalizeDescriptor(descriptor)
  const requestedPlatform =
    normalized.platform ??
    (descriptor.platform ? platformForValidation(descriptor.platform) : host.platform)
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
