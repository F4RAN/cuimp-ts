import { CuimpDescriptorInput } from '../types/cuimpTypes'
import { ARCHITECTURE_LIST, BROWSER_LIST, PLATFORM_LIST } from '../constants/cuimpConstants'
import {
  architectureForValidation,
  BROWSER_VERSION_PATTERN,
  normalizeDescriptor,
  platformForValidation,
} from '../helpers/descriptorNormalize'

export const validateDescriptor = (descriptor: CuimpDescriptorInput) => {
  const normalized = normalizeDescriptor(descriptor)

  if (descriptor.browser && !BROWSER_LIST.includes(descriptor.browser)) {
    throw new Error(
      `Browser '${descriptor.browser}' is not supported. Supported browsers: ${BROWSER_LIST.join(', ')}`
    )
  }

  if (descriptor.architecture) {
    const architecture = architectureForValidation(descriptor.architecture)
    if (!ARCHITECTURE_LIST.includes(architecture)) {
      throw new Error(
        `Architecture '${architecture}' is not supported. Supported architectures: ${ARCHITECTURE_LIST.join(', ')}`
      )
    }
  }

  if (descriptor.platform) {
    const platform = platformForValidation(descriptor.platform)
    if (!PLATFORM_LIST.includes(platform)) {
      throw new Error(
        `Platform '${platform}' is not supported. Supported platforms: ${PLATFORM_LIST.join(', ')}`
      )
    }
  }

  if (normalized.version) {
    if (normalized.version !== 'latest' && !BROWSER_VERSION_PATTERN.test(normalized.version)) {
      throw new Error(
        'Version must be "latest" or a 3–4 digit browser version (optional trailing letter, e.g. "136" or "2601" or "133a")'
      )
    }
  }
}
