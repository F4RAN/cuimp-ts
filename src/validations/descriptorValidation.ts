import { CuimpDescriptor } from '../types/cuimpTypes'
import { ARCHITECTURE_LIST, BROWSER_LIST, PLATFORM_LIST } from '../constants/cuimpConstants'
import {
  BROWSER_VERSION_PATTERN,
  normalizeDescriptor,
} from '../helpers/descriptorNormalize'

export const validateDescriptor = (descriptor: CuimpDescriptor) => {
  const normalized = normalizeDescriptor(descriptor)

  // Only validate browser if provided
  if (normalized.browser && !BROWSER_LIST.includes(normalized.browser)) {
    throw new Error(
      `Browser '${normalized.browser}' is not supported. Supported browsers: ${BROWSER_LIST.join(', ')}`
    )
  }

  // Only validate architecture if provided
  if (normalized.architecture && !ARCHITECTURE_LIST.includes(normalized.architecture)) {
    throw new Error(
      `Architecture '${normalized.architecture}' is not supported. Supported architectures: ${ARCHITECTURE_LIST.join(', ')}`
    )
  }

  // Only validate platform if provided
  if (normalized.platform && !PLATFORM_LIST.includes(normalized.platform)) {
    throw new Error(
      `Platform '${normalized.platform}' is not supported. Supported platforms: ${PLATFORM_LIST.join(', ')}`
    )
  }

  // Only validate version if provided
  if (normalized.version) {
    if (
      normalized.version !== 'latest' &&
      !BROWSER_VERSION_PATTERN.test(normalized.version)
    ) {
      throw new Error(
        'Version must be "latest" or a 3–4 digit browser version (optional trailing letter, e.g. "136" or "2601" or "133a")'
      )
    }
  }
}
