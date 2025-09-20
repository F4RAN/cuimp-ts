import { CuimpDescriptor, BinaryInfo, CuimpOptions } from './types/cuimpTypes'
import { validateDescriptor } from './validations/descriptorValidation'
import { parseDescriptor } from './helpers/parser'
import fs from 'fs'


class Cuimp {
  private descriptor: CuimpDescriptor
  private path: string
  private binaryInfo?: BinaryInfo
  
  constructor(options?: CuimpOptions) {
    this.descriptor = options?.descriptor || {}
    this.path = options?.path || ''
  }
  
  /**
   * Verifies the binary is present and executable
   * Returns the binary path if found or downloads it
   */
  async verifyBinary(): Promise<string> {
    // If path is already set and valid, return it
    if (this.path && await this.isBinaryExecutable(this.path)) {
      return this.path
    }

    try {
      // Validate descriptor if provided
      if (Object.keys(this.descriptor).length > 0) {
        validateDescriptor(this.descriptor)
      }

      // Parse descriptor to get binary info
      this.binaryInfo = await parseDescriptor(this.descriptor)
      
      if (!this.binaryInfo.binaryPath) {
        throw new Error('Binary path not found after parsing descriptor')
      }

      // Verify the binary is executable
      if (!(await this.isBinaryExecutable(this.binaryInfo.binaryPath))) {
        throw new Error(`Binary is not executable: ${this.binaryInfo.binaryPath}`)
      }

      // Update the path
      this.path = this.binaryInfo.binaryPath

      console.log(`Binary verified: ${this.path}`)
      if (this.binaryInfo.isDownloaded) {
        console.log(`Binary downloaded successfully (version: ${this.binaryInfo.version})`)
      }

      return this.path

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to verify binary: ${errorMessage}`)
    }
  }

  /**
   * Checks if a binary file exists and is executable
   */
  private async isBinaryExecutable(binaryPath: string): Promise<boolean> {
    try {
      // Check if file exists
      if (!fs.existsSync(binaryPath)) {
        return false
      }

      // Check if it's a file
      const stats = fs.statSync(binaryPath)
      if (!stats.isFile()) {
        return false
      }

      // On Unix-like systems, check if it's executable
      if (process.platform !== 'win32') {
        const mode = stats.mode
        const isExecutable = (mode & fs.constants.S_IXUSR) !== 0 ||
                           (mode & fs.constants.S_IXGRP) !== 0 ||
                           (mode & fs.constants.S_IXOTH) !== 0
        return isExecutable
      }

      // On Windows, just check if it's a file
      return true

    } catch (error) {
      console.warn(`Error checking binary executable status: ${error}`)
      return false
    }
  }

  /**
   * Builds a command preview for the given URL and method
   */
  async buildCommandPreview(url: string, method: string = 'GET'): Promise<string> {
    try {
      // Ensure binary is verified first
      const binaryPath = await this.verifyBinary()
      
      // Validate inputs
      if (!url || typeof url !== 'string') {
        throw new Error('URL must be a non-empty string')
      }

      if (!method || typeof method !== 'string') {
        throw new Error('Method must be a non-empty string')
      }

      // Convert method to uppercase for consistency
      const upperMethod = method.toUpperCase()

      // Build the command preview
      const command = `${binaryPath} -X ${upperMethod} "${url}"`
      
      console.log(`Command preview: ${command}`)
      return command

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to build command preview: ${errorMessage}`)
    }
  }

  /**
   * Gets the current binary path
   */
  getBinaryPath(): string {
    return this.path
  }

  /**
   * Gets the current descriptor
   */
  getDescriptor(): CuimpDescriptor {
    return { ...this.descriptor }
  }

  /**
   * Gets binary information if available
   */
  getBinaryInfo(): BinaryInfo | undefined {
    return this.binaryInfo ? { ...this.binaryInfo } : undefined
  }

  /**
   * Updates the descriptor
   */
  setDescriptor(descriptor: CuimpDescriptor): void {
    this.descriptor = { ...descriptor }
    // Reset path and binary info when descriptor changes
    this.path = ''
    this.binaryInfo = undefined
  }

  /**
   * Sets a custom binary path
   */
  setBinaryPath(path: string): void {
    this.path = path
    this.binaryInfo = undefined
  }
   /** Convenience to ensure binary and return verified path */
   async ensurePath(): Promise<string> { return this.verifyBinary() }

  /**
   * Downloads the binary without verifying it
   * Useful for pre-downloading or explicit download control
   */
  async download(): Promise<BinaryInfo> {
    try {
      // Validate descriptor if provided
      if (Object.keys(this.descriptor).length > 0) {
        validateDescriptor(this.descriptor)
      }

      // Parse descriptor to get binary info and download
      this.binaryInfo = await parseDescriptor(this.descriptor)
      
      if (!this.binaryInfo.binaryPath) {
        throw new Error('Binary path not found after processing')
      }

      console.log(`Binary ready: ${this.binaryInfo.binaryPath}`)
      if (this.binaryInfo.isDownloaded) {
        console.log(`Download completed (version: ${this.binaryInfo.version})`)
      } else {
        console.log(`Using existing binary (version: ${this.binaryInfo.version})`)
      }

      return this.binaryInfo

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to download binary: ${errorMessage}`)
    }
  }
}

export { Cuimp }

// Default export with convenience functions
export default {
  get: async <T = any>(url: string, config?: any) => {
    const { get } = await import('./index')
    return get<T>(url, config)
  },
  post: async <T = any>(url: string, data?: any, config?: any) => {
    const { post } = await import('./index')
    return post<T>(url, data, config)
  },
  put: async <T = any>(url: string, data?: any, config?: any) => {
    const { put } = await import('./index')
    return put<T>(url, data, config)
  },
  patch: async <T = any>(url: string, data?: any, config?: any) => {
    const { patch } = await import('./index')
    return patch<T>(url, data, config)
  },
  delete: async <T = any>(url: string, config?: any) => {
    const { del } = await import('./index')
    return del<T>(url, config)
  },
  head: async <T = any>(url: string, config?: any) => {
    const { head } = await import('./index')
    return head<T>(url, config)
  },
  options: async <T = any>(url: string, config?: any) => {
    const { options } = await import('./index')
    return options<T>(url, config)
  },
  request: async <T = any>(config: any) => {
    const { request } = await import('./index')
    return request<T>(config)
  }
}