// Test setup file
// This file can be used to configure global test settings

// Set up global test timeout
vi.setConfig({
  testTimeout: 10000, // 10 seconds
})

// Global test utilities can be added here
export const createMockResponse = (status: number, data: any, headers: Record<string, string> = {}) => {
  const responseBody = typeof data === 'string' ? data : JSON.stringify(data)
  const headerString = Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n')
  
  return Buffer.from(`HTTP/1.1 ${status} OK\r\n${headerString}\r\n\r\n${responseBody}`)
}

export const createMockBinaryInfo = (binaryPath: string, isDownloaded: boolean = false, version?: string) => ({
  binaryPath,
  isDownloaded,
  version
})

export const createMockRunResult = (exitCode: number, stdout: string | Buffer, stderr: string | Buffer = '') => ({
  exitCode,
  stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
  stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr)
})
