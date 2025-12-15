import { Cuimp } from './cuimp'
import { runBinary } from './runner'
import type {
  CuimpInstance,
  CuimpRequestConfig,
  CuimpResponse,
  Method,
  CookieJarOption,
  QueryParams,
  RequestHeaders,
  ParsedBody,
  JSONValue,
} from './types/cuimpTypes'
import type { RunResult } from './types/runTypes'
import { CurlError, CurlExitCode } from './types/curlErrors'
import { CookieJar } from './helpers/cookieJar'
import { parseHttpResponse } from './helpers/parser'

function joinURL(base?: string, path?: string): string | undefined {
  if (!path) return base
  if (!base) return path
  return new URL(path, base).toString()
}

function encodeParams(params?: QueryParams): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    usp.append(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

function normalizeHeaders(h?: RequestHeaders): Record<string, string> {
  const out: Record<string, string> = {}
  if (!h) return out
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || v === null) continue
    out[k] = String(v)
  }
  return out
}

function tryParseBody(buf: Buffer, headers: Record<string, string>): ParsedBody {
  const ct = Object.keys(headers).find(h => h.toLowerCase() === 'content-type')
  const val = ct ? headers[ct] : ''
  if (val && val.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(buf.toString('utf8')) as JSONValue
    } catch {
      /* fallthrough */
    }
  }
  return buf.toString('utf8')
}

function normalizeProxyUrl(proxy: string): string {
  // If proxy already has a scheme, return as-is
  if (proxy.includes('://')) {
    return proxy
  }

  // Handle different proxy formats
  if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return proxy
  }

  // Default to HTTP proxy if no scheme specified
  // Handle cases like "proxy.example.com:8080" or "user:pass@proxy.example.com:8080"
  if (proxy.includes('@')) {
    // Has authentication: user:pass@host:port
    return `http://${proxy}`
  } else {
    // No authentication: host:port
    return `http://${proxy}`
  }
}

function getProxyFromEnvironment(): string | undefined {
  // Check common proxy environment variables
  const proxyVars = [
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
  ]

  for (const varName of proxyVars) {
    const value = process.env[varName]
    if (value) {
      return value
    }
  }

  return undefined
}

export class CuimpHttp implements CuimpInstance {
  private cookieJar: CookieJar | null = null

  constructor(
    private core: Cuimp,
    private defaults: Partial<CuimpRequestConfig> = {},
    cookieJarOption?: CookieJarOption
  ) {
    if (cookieJarOption) {
      this.cookieJar = new CookieJar(cookieJarOption)
    }
  }

  /**
   * Get the cookie jar instance (if enabled)
   */
  getCookieJar(): CookieJar | null {
    return this.cookieJar
  }

  /**
   * Clear all cookies in the jar
   */
  clearCookies(): void {
    if (this.cookieJar) {
      this.cookieJar.clear()
    }
  }

  /**
   * Destroy the client and clean up resources (including temporary cookie files)
   */
  destroy(): void {
    if (this.cookieJar) {
      this.cookieJar.destroy()
      this.cookieJar = null
    }
  }

  async request<T = JSONValue>(config: CuimpRequestConfig): Promise<CuimpResponse<T>> {
    const method: Method = (config.method || 'GET').toUpperCase() as Method

    const urlBase = config.baseURL ?? this.defaults.baseURL
    const rawUrl = config.url
    if (!rawUrl) throw new Error('URL is required')

    const qs = encodeParams(config.params ?? this.defaults.params)
    const url = joinURL(urlBase, rawUrl) + qs

    if (!url) throw new Error('URL is required')

    const bin = await this.core.ensurePath()

    const headers = {
      ...(this.defaults.headers ?? {}),
      ...(config.headers ?? {}),
    }
    const normHeaders = normalizeHeaders(headers)

    // Build args for curl-impersonate binary
    const args: string[] = []

    // Method
    if (method !== 'GET') {
      args.push('-X', method)
    }

    // Redirects
    const maxRedirects = config.maxRedirects ?? this.defaults.maxRedirects ?? 10
    if (maxRedirects > 0) args.push('--location', '--max-redirs', String(maxRedirects))

    // Proxy
    const proxy = config.proxy ?? this.defaults.proxy ?? getProxyFromEnvironment()
    if (proxy) {
      // Handle different proxy types and authentication
      const normalizedProxy = normalizeProxyUrl(proxy)
      args.push('--proxy', normalizedProxy)
    }

    // Insecure TLS
    const insecure = config.insecureTLS ?? this.defaults.insecureTLS
    if (insecure) args.push('-k')

    // Headers
    for (const [k, v] of Object.entries(normHeaders)) {
      args.push('-H', `${k}: ${v}`)
    }

    // Body - On Windows, use stdin to avoid command-line escaping issues with special characters
    const isWindows = process.platform === 'win32'
    let stdinData: string | Buffer | undefined

    if (config.data !== undefined && config.data !== null) {
      if (Buffer.isBuffer(config.data)) {
        if (isWindows) {
          stdinData = config.data
          args.push('--data-binary', '@-')
        } else {
          args.push('--data-binary', config.data.toString('utf8'))
        }
      } else if (config.data instanceof URLSearchParams) {
        const urlEncodedData = config.data.toString()
        if (isWindows) {
          stdinData = urlEncodedData
          args.push('--data-binary', '@-')
        } else {
          args.push('--data', urlEncodedData)
        }
        if (!Object.keys(normHeaders).some(h => h.toLowerCase() === 'content-type')) {
          args.push('-H', 'Content-Type: application/x-www-form-urlencoded')
        }
      } else if (typeof config.data === 'string') {
        if (isWindows) {
          stdinData = config.data
          args.push('--data-binary', '@-')
        } else {
          args.push('--data-binary', config.data)
        }
      } else {
        // JSON
        const body = JSON.stringify(config.data)
        if (isWindows) {
          stdinData = body
          args.push('--data-binary', '@-')
        } else {
          args.push('--data-binary', body)
        }
        if (!Object.keys(normHeaders).some(h => h.toLowerCase() === 'content-type')) {
          args.push('-H', 'Content-Type: application/json')
        }
      }
    }

    // Cookie jar arguments (if enabled)
    if (this.cookieJar) {
      args.push(...this.cookieJar.getCurlArgs())
    }

    // Extra curl arguments (from config or defaults)
    const extraArgs = config.extraCurlArgs ?? this.defaults.extraCurlArgs
    if (extraArgs && extraArgs.length > 0) {
      args.push(...extraArgs)
    }

    // Add --fail-with-body by default to get response body on 4xx/5xx
    // Only add if not already present and --fail is not present
    if (!args.includes('--fail-with-body') && !args.includes('--fail')) {
      args.push('--fail-with-body')
    }

    // Always capture headers: use -i to include headers in output, then split.
    args.push('-i')

    // URL at the end
    args.push(url)

    // Preview (for debugging/response.request.command)
    const command = [bin, ...args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ')

    // Execute
    const result: RunResult = await runBinary(bin, args, {
      timeout: config.timeout ?? this.defaults.timeout,
      signal: config.signal,
      stdin: stdinData,
    })

    // Check exit code - but for HTTP_RETURNED_ERROR (22), we may still have a valid response body
    const stdoutBuf = result.stdout
    const hasHttpResponse =
      stdoutBuf.length > 0 && stdoutBuf.subarray(0, 5).equals(Buffer.from('HTTP/'))

    // Check exit code
    const exitCode: CurlExitCode | null = result.exitCode
    if (exitCode !== null && exitCode !== CurlExitCode.OK) {
      // For HTTP_RETURNED_ERROR (22), if we have a valid HTTP response in stdout,
      // parse it and return it instead of throwing an error
      if (exitCode === CurlExitCode.HTTP_RETURNED_ERROR && hasHttpResponse) {
        // Continue to parse the response below - don't throw
      } else {
        // For other errors or when there's no valid HTTP response, throw
        const stderr = result.stderr.toString('utf8')
        throw new CurlError(exitCode as CurlExitCode, stderr)
      }
    }

    // Parse HTTP response
    const { status, statusText, headers: respHeaders, body: rawBody } = parseHttpResponse(stdoutBuf)
    const parsed = tryParseBody(rawBody, respHeaders) as T

    return {
      status,
      statusText,
      headers: respHeaders,
      data: parsed,
      rawBody,
      request: {
        url,
        method,
        headers: normHeaders,
        command,
      },
    }
  }

  // Shorthand methods
  get<T = JSONValue>(
    url: string,
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' })
  }
  delete<T = JSONValue>(
    url: string,
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' })
  }
  head<T = JSONValue>(
    url: string,
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'HEAD' })
  }
  options<T = JSONValue>(
    url: string,
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, method: 'OPTIONS' })
  }
  post<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, data, method: 'POST' })
  }
  put<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, data, method: 'PUT' })
  }
  patch<T = JSONValue>(
    url: string,
    data?: CuimpRequestConfig['data'],
    config: Omit<CuimpRequestConfig, 'url' | 'method' | 'data'> = {}
  ): Promise<CuimpResponse<T>> {
    return this.request<T>({ ...config, url, data, method: 'PATCH' })
  }
}
