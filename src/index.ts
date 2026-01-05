// Main exports
export { Cuimp } from './cuimp'
export { CuimpHttp } from './client'
export { CookieJar } from './helpers/cookieJar'
import cuimp from './cuimp'

// Type exports
export type {
  CuimpDescriptor,
  BinaryInfo,
  Method,
  CuimpRequestConfig,
  CuimpResponse,
  CuimpStreamHeaders,
  CuimpStreamHandlers,
  CuimpStreamResponse,
  CuimpOptions,
  CuimpInstance,
  CookieJarOption,
} from './types/cuimpTypes'

export type { RunResult, RunStreamResult } from './types/runTypes'

// Error exports
export { CurlError, CurlExitCode } from './types/curlErrors'

// Utility exports
export { runBinary, runBinaryStream } from './runner'

// Import for internal use
import { Cuimp } from './cuimp'
import { CuimpHttp } from './client'
import type {
  CuimpOptions,
  CuimpRequestConfig,
  CuimpResponse,
  CuimpStreamHandlers,
  CuimpStreamResponse,
  JSONValue,
} from './types/cuimpTypes'

// Factory function for creating HTTP client instances
export function createCuimpHttp(options?: CuimpOptions) {
  const core = new Cuimp(options)
  const defaults: Partial<CuimpRequestConfig> = {}

  // Pass extraCurlArgs from options to defaults if provided
  if (options?.extraCurlArgs) {
    defaults.extraCurlArgs = options.extraCurlArgs
  }

  return new CuimpHttp(core, defaults, options?.cookieJar)
}

// Convenience function for quick HTTP requests
export async function request<T = JSONValue>(
  config: CuimpRequestConfig
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.request<T>(config)
}

export async function requestStream(
  config: CuimpRequestConfig,
  handlers?: CuimpStreamHandlers
): Promise<CuimpStreamResponse> {
  const client = createCuimpHttp()
  return client.requestStream(config, handlers)
}

// Convenience functions for common HTTP methods
export async function get<T = JSONValue>(
  url: string,
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.get<T>(url, config)
}

export async function post<T = JSONValue>(
  url: string,
  data?: CuimpRequestConfig['data'],
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.post<T>(url, data, config)
}

export async function put<T = JSONValue>(
  url: string,
  data?: CuimpRequestConfig['data'],
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.put<T>(url, data, config)
}

export async function patch<T = JSONValue>(
  url: string,
  data?: CuimpRequestConfig['data'],
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.patch<T>(url, data, config)
}

export async function del<T = JSONValue>(
  url: string,
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.delete<T>(url, config)
}

export async function head<T = JSONValue>(
  url: string,
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.head<T>(url, config)
}

export async function options<T = JSONValue>(
  url: string,
  config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
): Promise<CuimpResponse<T>> {
  const client = createCuimpHttp()
  return client.options<T>(url, config)
}

// Convenience function for downloading binaries
export async function downloadBinary(options?: CuimpOptions) {
  const cuimp = new Cuimp(options)
  return cuimp.download()
}

export async function __smoke() {
  const cu = new Cuimp()
  const info = await cu.verifyBinary()
  console.log('Binary:', info)
  const cmd = cu.buildCommandPreview('https://example.com', 'GET')
  console.log('Preview:', cmd)

  const res = await cuimp.get('https://example.com')
  console.log('Response:', res)
}
