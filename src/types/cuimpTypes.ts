export interface CuimpDescriptor {
  browser?: string
  version?: string
  architecture?: string
  platform?: string
  forceDownload?: boolean // Force re-download even if binary exists
}

/**
 * Cookie jar configuration options
 * - true: Use automatic in-memory cookie management with temp file
 * - string: Path to a custom cookie file (Netscape format)
 * - false/undefined: No automatic cookie management (default)
 */
export type CookieJarOption = boolean | string

export interface BinaryInfo {
  binaryPath: string
  isDownloaded: boolean
  version?: string
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface CuimpRequestConfig {
  url?: string
  method?: Method
  baseURL?: string
  headers?: Record<string, string | number | boolean>
  params?: Record<string, string | number | boolean | undefined>
  data?: string | Buffer | JSONValue | URLSearchParams
  timeout?: number
  maxRedirects?: number
  proxy?: string
  insecureTLS?: boolean
  signal?: AbortSignal
  extraCurlArgs?: string[] // Additional curl arguments like --cookie, --cookie-jar, etc.
}

export interface CuimpResponse<T = JSONValue> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
  rawBody: Buffer
  request: {
    url: string
    method: Method
    headers: Record<string, string | number | boolean>
    command: string // full command preview
  }
}

export interface Logger {
  info(...args: (string | number | boolean | object | null | undefined)[]): void
  warn(...args: (string | number | boolean | object | null | undefined)[]): void
  error(...args: (string | number | boolean | object | null | undefined)[]): void
  debug(...args: (string | number | boolean | object | null | undefined)[]): void
}

export interface CuimpOptions {
  descriptor?: CuimpDescriptor
  path?: string
  extraCurlArgs?: string[] // Global curl arguments applied to all requests
  logger?: Logger
  cookieJar?: CookieJarOption // Enable automatic cookie management
  autoDownload?: boolean // If false, throw error instead of auto-downloading binaries (default: true)
}

// Type for JSON-serializable values
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

// Type for query parameters
export type QueryParams = Record<string, string | number | boolean | undefined>

// Type for request headers (before normalization)
export type RequestHeaders = Record<string, string | number | boolean>

// Type for parsed response body (JSON or string)
export type ParsedBody = JSONValue | string

export interface CuimpInstance {
  request<T = JSONValue>(config: CuimpRequestConfig): Promise<CuimpResponse<T>>
  get<T = JSONValue>(
    url: string,
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  delete<T = JSONValue>(
    url: string,
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  head<T = JSONValue>(
    url: string,
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  options<T = JSONValue>(
    url: string,
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  post<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  put<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
  patch<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config?: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'>
  ): Promise<CuimpResponse<T>>
}
