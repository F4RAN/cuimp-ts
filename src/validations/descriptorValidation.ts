import { CuimpDescriptor } from '../types/cuimpTypes'
import { ARCHITECTURE_LIST, BROWSER_LIST, PLATFORM_LIST } from '../constants/cuimpConstants'

export const validateDescriptor = (descriptor: CuimpDescriptor) => {
  // Only validate browser if provided
  if (descriptor.browser && !BROWSER_LIST.includes(descriptor.browser)) {
    throw new Error(
      `Browser '${descriptor.browser}' is not supported. Supported browsers: ${BROWSER_LIST.join(', ')}`
    )
  }

  // Only validate architecture if provided
  if (descriptor.architecture && !ARCHITECTURE_LIST.includes(descriptor.architecture)) {
    throw new Error(
      `Architecture '${descriptor.architecture}' is not supported. Supported architectures: ${ARCHITECTURE_LIST.join(', ')}`
    )
  }

  // Only validate platform if provided
  if (descriptor.platform && !PLATFORM_LIST.includes(descriptor.platform)) {
    throw new Error(
      `Platform '${descriptor.platform}' is not supported. Supported platforms: ${PLATFORM_LIST.join(', ')}`
    )
  }

  // Only validate version if provided
  if (descriptor.version) {
    // Accept 'latest' as a special value
    if (descriptor.version !== 'latest' && descriptor.version.length !== 3) {
      throw new Error('Version must be in the format of XYZ or "latest"')
    }
  }
}
