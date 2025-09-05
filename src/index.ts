// Main exports
export { Cuimp } from './cuimp'
export { CuimpHttp } from './client'
import cuimp from './cuimp'

// Type exports
export type {
  CuimpDescriptor,
  BinaryInfo,
  Method,
  CuimpRequestConfig,
  CuimpResponse,
  CuimpOptions,
  CuimpInstance
} from './types/cuimpTypes'

export type { RunResult } from './types/runTypes'

// Utility exports
export { runBinary } from './runner'

// Import for internal use
import { Cuimp } from './cuimp'
import { CuimpHttp } from './client'
import type { CuimpOptions, CuimpRequestConfig } from './types/cuimpTypes'

// Factory function for creating HTTP client instances
export function createCuimpHttp(options?: CuimpOptions) {
  const core = new Cuimp(options)
  return new CuimpHttp(core)
}

// Convenience function for quick HTTP requests
export async function request<T = any>(config: CuimpRequestConfig) {
  const client = createCuimpHttp()
  return client.request<T>(config)
}

// Convenience functions for common HTTP methods
export async function get<T = any>(url: string, config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.get<T>(url, config)
}

export async function post<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.post<T>(url, data, config)
}

export async function put<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.put<T>(url, data, config)
}

export async function patch<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.patch<T>(url, data, config)
}

export async function del<T = any>(url: string, config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.delete<T>(url, config)
}

export async function head<T = any>(url: string, config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.head<T>(url, config)
}

export async function options<T = any>(url: string, config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>) {
  const client = createCuimpHttp()
  return client.options<T>(url, config)
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