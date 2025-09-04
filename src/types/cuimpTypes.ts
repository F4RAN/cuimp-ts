
interface CuimpDescriptor {
  browser?: string
  version?: string
  architecture?: string
  platform?: string
}

export interface BinaryInfo {
    binaryPath: string
    isDownloaded: boolean
    version?: string
}

export { CuimpDescriptor }