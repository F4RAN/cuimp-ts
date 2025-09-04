// src/cuimp.ts
import { execSync } from 'node:child_process'
import * as path from 'node:path'

/** ---- Types (we'll extend later) ---- */
export type HttpMethod =
  | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface CurlRequestOptions {
  url: string
  method?: HttpMethod
  headers?: Record<string, string>
  body?: string | Buffer | Record<string, unknown>
  followRedirects?: boolean
  http2?: boolean         // ⚠️ can change fingerprint; off by default
  compressed?: boolean
  proxy?: string
  insecure?: boolean
  timeoutMs?: number
  maxRedirects?: number
  cookie?: string         // file path (we’ll wire this in Step 2)
  userAgent?: string      // ⚠️ may break fingerprint
  referer?: string
  resolve?: string[]
  binaryPath?: string     // explicit wrapper path
}

export interface CurlResponse {
  // Placeholder for Step 2 (spawn + parse)
  status: number
  headers: Record<string, string | string[]>
  rawHeaders: string
  body: Buffer
  url: string
  command: string
  text: string
  data: any
  fingerprint: 'impersonated' | 'fallback'
}

/** ---- Binary detection ---- */
function detectAvailableChromeBinaries(): string[] {
  try {
    const cmd = process.platform === 'win32'
      ? 'where curl_chrome* 2>NUL || echo'
      : 'ls /usr/local/bin/curl_chrome* 2>/dev/null || which -a curl_chrome* 2>/dev/null || echo ""'
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (!out) return []
    return out.split(/\r?\n/)
      .filter(Boolean)
      .map(p => path.basename(p))
      .filter(n => n.startsWith('curl_chrome'))
      .sort((a, b) => {
        const anum = parseInt(a.replace('curl_chrome', '').replace(/[a-z]/gi, '')) || 0
        const bnum = parseInt(b.replace('curl_chrome', '').replace(/[a-z]/gi, '')) || 0
        return bnum - anum
      })
  } catch {
    return []
  }
}

/** Resolves a wrapper path + whether it’s real impersonation or fallback. */
function getBinaryPath(descriptor?: string, explicit?: string): { bin: string, fingerprint: 'impersonated' | 'fallback' } {
  if (explicit?.trim()) return { bin: explicit, fingerprint: 'impersonated' }

  // try env override (e.g., CURL_CHROME136_PATH) when descriptor provided
  if (descriptor?.trim()) {
    const envVar = `CURL_${descriptor.toUpperCase()}_PATH`
    const envVal = process.env[envVar]
    if (envVal?.trim()) return { bin: envVal, fingerprint: 'impersonated' }
  }

  // auto-detect installed wrappers
  const detected = detectAvailableChromeBinaries()
  if (detected.length) return { bin: detected[0], fingerprint: 'impersonated' }

  // fallbacks by name
  const suffix = process.platform === 'win32' ? '.exe' : ''
  const list = ['curl_chrome136', 'curl_chrome133', 'curl_chrome124']
  for (const name of list) {
    try {
      const whichCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`
      execSync(whichCmd, { stdio: 'ignore' })
      return { bin: name + (name.endsWith('.exe') ? '' : ''), fingerprint: 'impersonated' }
    } catch { /* continue */ }
  }

  // final fallback: stock curl (NOT authentic fingerprint)
  return { bin: process.platform === 'win32' ? 'curl.exe' : 'curl', fingerprint: 'fallback' }
}

/** ---- Command preview (no spawn yet) ---- */
export function buildCurlCommandPreview(options: CurlRequestOptions, descriptor = 'chrome136'): string {
  const { bin } = getBinaryPath(descriptor, options.binaryPath)
  const args: string[] = [bin]

  if (options.followRedirects) args.push('--location')
  if (typeof options.maxRedirects === 'number') args.push('--max-redirs', String(options.maxRedirects))
  if (options.http2) args.push('--http2')           // ⚠️ only if caller insists
  if (options.compressed) args.push('--compressed')
  if (options.insecure) args.push('-k')
  if (options.proxy) args.push('--proxy', JSON.stringify(options.proxy))
  if (options.timeoutMs) args.push('--max-time', String(Math.ceil(options.timeoutMs / 1000)))
  if (options.cookie) args.push('--cookie', JSON.stringify(options.cookie), '--cookie-jar', JSON.stringify(options.cookie))
  if (options.userAgent) args.push('-A', JSON.stringify(options.userAgent))
  if (options.referer) args.push('-e', JSON.stringify(options.referer))
  if (options.resolve) for (const r of options.resolve) args.push('--resolve', JSON.stringify(r))

  const method = (options.method || 'GET').toUpperCase()
  args.push('-X', method)

  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) args.push('-H', JSON.stringify(`${k}: ${v}`))
  }

  if (options.body && method !== 'GET' && method !== 'HEAD') {
    args.push('--data-binary', '@-')
  }

  args.push(JSON.stringify(options.url))
  return args.join(' ')
}

/** ---- Small class wrapper (no network yet) ---- */
export interface CurlClientOptions {
  binaryPath?: string
  followRedirects?: boolean
  maxRedirects?: number
  http2?: boolean
  compressed?: boolean
  insecure?: boolean
  proxy?: string
  timeoutMs?: number
  headers?: Record<string, string>
  cookie?: string
  userAgent?: string
  referer?: string
  resolve?: string[]
}

export class Cuimp {
  constructor(
    private readonly descriptor: string = 'chrome136',
    private readonly defaults: CurlClientOptions = {}
  ) {}

  /** Resolve the binary path we will use */
  resolveBinaryPath(): string {
    const { bin } = getBinaryPath(this.descriptor, this.defaults.binaryPath)
    return bin
  }

  /** Just preview what we would run (Step 2 will actually run it) */
  buildCommandPreview(options: CurlRequestOptions): string {
    const merged: CurlRequestOptions = {
      ...options,
      headers: { ...(this.defaults.headers || {}), ...(options.headers || {}) },
      followRedirects: options.followRedirects ?? this.defaults.followRedirects,
      maxRedirects: options.maxRedirects ?? this.defaults.maxRedirects,
      http2: options.http2 ?? this.defaults.http2,
      compressed: options.compressed ?? this.defaults.compressed,
      insecure: options.insecure ?? this.defaults.insecure,
      proxy: options.proxy ?? this.defaults.proxy,
      timeoutMs: options.timeoutMs ?? this.defaults.timeoutMs,
      cookie: options.cookie ?? this.defaults.cookie,
      userAgent: options.userAgent ?? this.defaults.userAgent,
      referer: options.referer ?? this.defaults.referer,
      resolve: options.resolve ?? this.defaults.resolve,
      binaryPath: options.binaryPath ?? this.defaults.binaryPath
    }
    return buildCurlCommandPreview(merged, this.descriptor)
  }

  /** Quick sanity check the wrapper is installed (no HTTP yet) */
  verifyBinary(): { bin: string, fingerprint: 'impersonated' | 'fallback', version?: string } {
    const { bin, fingerprint } = getBinaryPath(this.descriptor, this.defaults.binaryPath)
    try {
      const out = execSync(`${bin} --version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return { bin, fingerprint, version: out.split(/\r?\n/)[0] }
    } catch {
      return { bin, fingerprint }
    }
  }
}
