import { Cuimp } from './cuimp';
import { runBinary } from './runner';
import type { CuimpInstance, CuimpRequestConfig, CuimpResponse, Method } from './types/cuimpTypes';

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
  constructor(private core: Cuimp, private defaults: Partial<CuimpRequestConfig> = {}) {}

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

    // Always capture headers: use -D - (dump headers to stdout) won't work nicely;
    // Instead use: -i to include headers in output, then split.
    args.push('-i');

    // URL at the end
    args.push(url);

    // Preview (for debugging/response.request.command)
    const command = [bin, ...args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ');

    // Execute
    const result = await runBinary(bin, args, { timeout: config.timeout ?? this.defaults.timeout, signal: config.signal });

    // curl outputs:
    // [HTTP/1.1 200 OK\r\nHeaders...\r\n\r\n]...body...
    // There can be multiple header blocks with redirects; pick the last.
    
    // Find all header/body separators in the raw Buffer
    // Look for \r\n\r\n or \n\n that separates headers from body
    const stdoutBuf = result.stdout;
    const separator1 = Buffer.from('\r\n\r\n');
    const separator2 = Buffer.from('\n\n');
    
    // Find all occurrences of separators
    const separatorPositions: Array<{index: number, length: number}> = [];
    
    for (let i = 0; i < stdoutBuf.length; i++) {
      if (stdoutBuf.slice(i, i + 4).equals(separator1)) {
        separatorPositions.push({index: i, length: 4});
        i += 3; // Skip past this separator
      } else if (stdoutBuf.slice(i, i + 2).equals(separator2)) {
        separatorPositions.push({index: i, length: 2});
        i += 1; // Skip past this separator
      }
    }
    
    if (separatorPositions.length === 0) {
      const previewText = stdoutBuf.toString('utf8', 0, Math.min(500, stdoutBuf.length));
      throw new Error(`Unexpected response format:\n${previewText}`);
    }

    // Use the last separator to split headers and body
    const lastSeparator = separatorPositions[separatorPositions.length - 1];
    const headerBuf = stdoutBuf.slice(0, lastSeparator.index);
    const rawBody = stdoutBuf.slice(lastSeparator.index + lastSeparator.length);
    
    // Decode headers only (safe as HTTP headers are ASCII/UTF-8)
    const headerText = headerBuf.toString('utf8');
    
    // Handle multiple header blocks (redirects)
    // Split by double newline and find blocks that start with HTTP/
    const headerBlocks = headerText.split(/\r?\n\r?\n/).filter(block => 
      block.trim() && /^HTTP\/\d\.\d \d{3}/.test(block)
    );
    const lastHeader = headerBlocks.length ? headerBlocks[headerBlocks.length - 1] : headerText;

    // Parse status + headers
    const headerLines = lastHeader.split(/\r?\n/);
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
