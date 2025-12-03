import { Cuimp } from './cuimp';
import { runBinary } from './runner';
import type { CuimpInstance, CuimpRequestConfig, CuimpResponse, Method, CookieJarOption } from './types/cuimpTypes';
import { CurlError, CurlExitCode } from './types/curlErrors';
import { CookieJar } from './helpers/cookieJar';

function joinURL(base?: string, path?: string): string | undefined {
  if (!path) return base;
  if (!base) return path;
  return new URL(path, base).toString();
}

function encodeParams(params?: Record<string, any>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

function normalizeHeaders(h?: Record<string, any>): Record<string,string> {
  const out: Record<string,string> = {};
  if (!h) return out;
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

function tryParseBody(buf: Buffer, headers: Record<string, string>) {
  const ct = Object.keys(headers).find(h => h.toLowerCase() === 'content-type');
  const val = ct ? headers[ct] : '';
  if (val && val.toLowerCase().includes('application/json')) {
    try { return JSON.parse(buf.toString('utf8')); } catch { /* fallthrough */ }
  }
  return buf.toString('utf8');
}

function normalizeProxyUrl(proxy: string): string {
  // If proxy already has a scheme, return as-is
  if (proxy.includes('://')) {
    return proxy;
  }
  
  // Handle different proxy formats
  if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return proxy;
  }
  
  // Default to HTTP proxy if no scheme specified
  // Handle cases like "proxy.example.com:8080" or "user:pass@proxy.example.com:8080"
  if (proxy.includes('@')) {
    // Has authentication: user:pass@host:port
    return `http://${proxy}`;
  } else {
    // No authentication: host:port
    return `http://${proxy}`;
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
    'all_proxy'
  ];
  
  for (const varName of proxyVars) {
    const value = process.env[varName];
    if (value) {
      return value;
    }
  }
  
  return undefined;
}

export class CuimpHttp implements CuimpInstance {
  private cookieJar: CookieJar | null = null;

  constructor(
    private core: Cuimp, 
    private defaults: Partial<CuimpRequestConfig> = {},
    cookieJarOption?: CookieJarOption
  ) {
    if (cookieJarOption) {
      this.cookieJar = new CookieJar(cookieJarOption);
    }
  }

  /**
   * Get the cookie jar instance (if enabled)
   */
  getCookieJar(): CookieJar | null {
    return this.cookieJar;
  }

  /**
   * Clear all cookies in the jar
   */
  clearCookies(): void {
    if (this.cookieJar) {
      this.cookieJar.clear();
    }
  }

  /**
   * Destroy the client and clean up resources (including temporary cookie files)
   */
  destroy(): void {
    if (this.cookieJar) {
      this.cookieJar.destroy();
      this.cookieJar = null;
    }
  }

  async request<T = any>(config: CuimpRequestConfig): Promise<CuimpResponse<T>> {
    const method: Method = (config.method || 'GET').toUpperCase() as Method;

    const urlBase = config.baseURL ?? this.defaults.baseURL;
    const rawUrl = config.url!;
    const qs = encodeParams(config.params ?? this.defaults.params);
    const url = joinURL(urlBase, rawUrl) + qs;

    if (!url) throw new Error('URL is required');

    const bin = await this.core.ensurePath();

    const headers = {
      ...(this.defaults.headers ?? {}),
      ...(config.headers ?? {}),
    };
    const normHeaders = normalizeHeaders(headers);

    // Build args for curl-impersonate binary
    const args: string[] = [];

    // Method
    if (method !== 'GET') {
      args.push('-X', method);
    }

    // Redirects
    const maxRedirects = config.maxRedirects ?? this.defaults.maxRedirects ?? 10;
    if (maxRedirects > 0) args.push('--location', '--max-redirs', String(maxRedirects));

    // Proxy
    const proxy = config.proxy ?? this.defaults.proxy ?? getProxyFromEnvironment();
    if (proxy) {
      // Handle different proxy types and authentication
      const normalizedProxy = normalizeProxyUrl(proxy);
      args.push('--proxy', normalizedProxy);
    }

    // Insecure TLS
    const insecure = config.insecureTLS ?? this.defaults.insecureTLS;
    if (insecure) args.push('-k');

    // Headers
    for (const [k, v] of Object.entries(normHeaders)) {
      args.push('-H', `${k}: ${v}`);
    }

    // Body
    let hasBody = false;
    if (config.data !== undefined && config.data !== null) {
      hasBody = true;
      if (Buffer.isBuffer(config.data)) {
        // We'll pass via --data-binary @- and write to stdin (but we spawned with no stdin piping).
        // Simpler: stringify here for common types. For binary, recommend user pass string/base64.
        args.push('--data-binary', config.data.toString('utf8'));
      } else if (config.data instanceof URLSearchParams) {
        args.push('--data', config.data.toString());
        if (!Object.keys(normHeaders).some(h => h.toLowerCase() === 'content-type')) {
          args.push('-H', 'Content-Type: application/x-www-form-urlencoded');
        }
      } else if (typeof config.data === 'string') {
        args.push('--data-binary', config.data);
      } else {
        // JSON
        const body = JSON.stringify(config.data);
        args.push('--data-binary', body);
        if (!Object.keys(normHeaders).some(h => h.toLowerCase() === 'content-type')) {
          args.push('-H', 'Content-Type: application/json');
        }
      }
    }

    // Cookie jar arguments (if enabled)
    if (this.cookieJar) {
      args.push(...this.cookieJar.getCurlArgs());
    }

    // Extra curl arguments (from config or defaults)
    const extraArgs = config.extraCurlArgs ?? this.defaults.extraCurlArgs;
    if (extraArgs && extraArgs.length > 0) {
      args.push(...extraArgs);
    }

    // Always capture headers: use -D - (dump headers to stdout) won't work nicely;
    // Instead use: -i to include headers in output, then split.
    args.push('-i');

    // URL at the end
    args.push(url);

    // Preview (for debugging/response.request.command)
    const command = [bin, ...args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ');

    // Execute
    const result = await runBinary(bin, args, { timeout: config.timeout ?? this.defaults.timeout, signal: config.signal });

    // Check exit code
    if (result.exitCode !== null && result.exitCode !== CurlExitCode.OK) {
      const stderr = result.stderr.toString('utf8');
      throw new CurlError(result.exitCode as CurlExitCode, stderr);
    }

    // curl outputs with -i flag:
    // [HTTP/1.1 200 OK\r\nHeaders...\r\n\r\n]...body...
    // With redirects: HTTP/1.1 302...\r\n\r\nHTTP/1.1 200...\r\n\r\nbody
    
    const stdoutBuf = result.stdout;
    const httpMarker = Buffer.from('HTTP/');
    
    // Find all positions where HTTP responses start
    const httpStarts: number[] = [];
    for (let i = 0; i <= stdoutBuf.length - 5; i++) {
      if (stdoutBuf.slice(i, i + 5).equals(httpMarker)) {
        httpStarts.push(i);
      }
    }
    
    if (httpStarts.length === 0) {
      const previewText = stdoutBuf.toString('utf8', 0, Math.min(500, stdoutBuf.length));
      throw new Error(`No HTTP response found:\n${previewText}`);
    }
    
    // For each HTTP response block, find its end (first \r\n\r\n or \n\n after HTTP/)
    const separator1 = Buffer.from('\r\n\r\n');
    const separator2 = Buffer.from('\n\n');
    
    let lastHeaderEnd = 0;
    let lastHeaderEndLength = 0;
    
    for (const httpStart of httpStarts) {
      // Search for separator starting from this HTTP block
      let found = false;
      for (let i = httpStart; i < stdoutBuf.length; i++) {
        if (i + 4 <= stdoutBuf.length && stdoutBuf.slice(i, i + 4).equals(separator1)) {
          lastHeaderEnd = i;
          lastHeaderEndLength = 4;
          found = true;
          break;
        } else if (i + 2 <= stdoutBuf.length && stdoutBuf.slice(i, i + 2).equals(separator2)) {
          lastHeaderEnd = i;
          lastHeaderEndLength = 2;
          found = true;
          break;
        }
      }
      if (!found) {
        // This HTTP block has no proper ending, might be malformed
        lastHeaderEnd = stdoutBuf.length;
        lastHeaderEndLength = 0;
      }
    }
    
    // Everything before lastHeaderEnd is headers, everything after is body
    const headerBuf = stdoutBuf.slice(0, lastHeaderEnd);
    const rawBody = stdoutBuf.slice(lastHeaderEnd + lastHeaderEndLength);
    
    // Decode headers only (safe as HTTP headers are ASCII/UTF-8)
    const headerText = headerBuf.toString('utf8');
    
    // Handle multiple header blocks (redirects)
    // Split by HTTP/ and process each block
    const httpBlocks = headerText.split(/(?=HTTP\/)/);
    const validBlocks = httpBlocks.filter(block => 
      block.trim() && /^HTTP\/[1-3](?:\.\d)? \d{3}/.test(block.trim())
    );
    
    // Use the last valid HTTP response block
    const lastBlock = validBlocks.length ? validBlocks[validBlocks.length - 1] : headerText;
    
    // Remove the trailing separator from lastBlock if present
    const cleanBlock = lastBlock.replace(/\r?\n\r?\n$/, '');

    // Parse status + headers
    const headerLines = cleanBlock.split(/\r?\n/);
    const statusLine = headerLines.shift() || 'HTTP/1.1 200 OK';
    const m = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s+(.*)$/);
    const status = m ? parseInt(m[1], 10) : 200;
    const statusText = m ? m[2] : 'OK';

    const respHeaders: Record<string,string> = {};
    for (const line of headerLines) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        respHeaders[k] = v;
      }
    }

    const parsed = tryParseBody(rawBody, respHeaders) as T;

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
    };
  }

  // Shorthand methods
  get<T = any>(url: string, config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, method: 'GET' });
  }
  delete<T = any>(url: string, config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }
  head<T = any>(url: string, config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, method: 'HEAD' });
  }
  options<T = any>(url: string, config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, method: 'OPTIONS' });
  }
  post<T = any>(url: string, data?: CuimpRequestConfig['data'], config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, data, method: 'POST' });
  }
  put<T = any>(url: string, data?: CuimpRequestConfig['data'], config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, data, method: 'PUT' });
  }
  patch<T = any>(url: string, data?: CuimpRequestConfig['data'], config: Omit<CuimpRequestConfig,'url'|'method'|'data'> = {}) {
    return this.request<T>({ ...config, url, data, method: 'PATCH' });
  }
}
