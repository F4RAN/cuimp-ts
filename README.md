<div align="center">

# Cuimp

**A powerful Node.js wrapper for curl-impersonate**

[![npm version](https://img.shields.io/npm/v/cuimp.svg?style=flat-square)](https://www.npmjs.com/package/cuimp)
[![npm downloads](https://img.shields.io/npm/dm/cuimp.svg?style=flat-square)](https://www.npmjs.com/package/cuimp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![GitHub Release](https://img.shields.io/github/v/release/F4RAN/cuimp-ts?style=flat-square)](https://github.com/F4RAN/cuimp-ts/releases)
[![GitHub Stars](https://img.shields.io/github/stars/F4RAN/cuimp-ts?style=flat-square)](https://github.com/F4RAN/cuimp-ts/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/F4RAN/cuimp-ts?style=flat-square)](https://github.com/F4RAN/cuimp-ts/issues)

Make HTTP requests that mimic real browser behavior and bypass anti-bot protections with ease.

[Features](#features) •
[Installation](#installation) •
[Quick Start](#quick-start) •
[Documentation](#api-reference) •
[Examples](#examples)

</div>

---

## ✨ Features

- 🚀 **Browser Impersonation**: Mimic Chrome, Firefox, Safari, and Edge browsers
- 🔧 **Easy to Use**: Simple API similar to axios/fetch
- 📦 **Zero Dependencies**: Only requires `tar` for binary extraction
- 🎯 **TypeScript Support**: Full type definitions included
- 🔄 **Auto Binary Management**: Automatically downloads and manages curl-impersonate binaries
- 🌐 **Cross-Platform**: Works on Linux, macOS, and Windows
- 🔒 **Proxy Support**: Built-in support for HTTP, HTTPS, and SOCKS proxies with authentication
- 📁 **Clean Installation**: Binaries stored in package directory, not your project root
- 🍪 **Cookie Management**: Automatic cookie storage and sending across requests
- ✅ **Error Response Bodies**: Returns full HTTP response body on 4xx/5xx errors (like axios/Postman)

## 📑 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Project Usage Examples](#project-usage-examples)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Supported Browsers](#supported-browsers)
- [Response Format](#response-format)
- [Binary Management](#binary-management)
- [Troubleshooting](#troubleshooting)
- [Requirements](#requirements)
- [Contributing](#-contributing)
- [License](#-license)
- [Contributors](#-contributors)

## 📦 Installation

```bash
npm install cuimp
```

## 🚀 Quick Start

```javascript
import { get, post, createCuimpHttp } from 'cuimp'

// Simple GET request
const response = await get('https://httpbin.org/headers')
console.log(response.data)

// POST with data
const result = await post('https://httpbin.org/post', {
  name: 'John Doe',
  email: 'john@example.com',
})

// Using HTTP client instance
const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
})

const data = await client.get('https://api.example.com/users')
```

## Project Usage Examples

### Web Scraping with Browser Impersonation

```javascript
import { get, createCuimpHttp } from 'cuimp'

// Create a client that mimics Chrome 123
const scraper = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
})

// Scrape a website that blocks regular requests
const response = await scraper.get('https://example.com/protected-content', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
})

console.log('Scraped content:', response.data)
```

### API Testing with Different Browsers

```javascript
import { createCuimpHttp } from 'cuimp'

// Test your API with different browser signatures
const browsers = ['chrome', 'firefox', 'safari', 'edge']

for (const browser of browsers) {
  const client = createCuimpHttp({
    descriptor: { browser, version: 'latest' },
  })

  const response = await client.get('https://your-api.com/test')
  console.log(`${browser}: ${response.status}`)
}
```

### Automatic Cookie Management

```javascript
import { createCuimpHttp } from 'cuimp'

// Enable automatic cookie management
const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
  cookieJar: true, // Cookies are automatically stored and sent
})

// First request - server sets cookies
await client.get('https://httpbin.org/cookies/set/session_id/abc123')

// Second request - cookies are automatically included
const response = await client.get('https://httpbin.org/cookies')
console.log(response.data.cookies) // { session_id: 'abc123' }

// Access cookies programmatically
const cookieJar = client.getCookieJar()
const cookies = cookieJar.getCookies()

// Clear cookies
client.clearCookies()

// Clean up when done (removes temp cookie file)
client.destroy()
```

### Using with Proxies

```javascript
import { request } from 'cuimp'

// HTTP proxy
const response1 = await request({
  url: 'https://httpbin.org/ip',
  proxy: 'http://proxy.example.com:8080',
})

// SOCKS5 proxy with authentication
const response2 = await request({
  url: 'https://httpbin.org/ip',
  proxy: 'socks5://user:pass@proxy.example.com:1080',
})

// Automatic proxy detection from environment variables
// HTTP_PROXY, HTTPS_PROXY, ALL_PROXY
const response3 = await request({
  url: 'https://httpbin.org/ip',
  // Will automatically use HTTP_PROXY if set
})
```

### Pre-downloading Binaries

```javascript
import { Cuimp, downloadBinary } from 'cuimp'

// Method 1: Using Cuimp class
const cuimp = new Cuimp({ descriptor: { browser: 'chrome' } })
const binaryInfo = await cuimp.download()
console.log('Downloaded:', binaryInfo.binaryPath)

// Method 2: Using convenience function
const info = await downloadBinary({
  descriptor: { browser: 'firefox', version: '133' },
})

// Pre-download multiple browsers for offline use
const browsers = ['chrome', 'firefox', 'safari', 'edge']
for (const browser of browsers) {
  await downloadBinary({ descriptor: { browser } })
  console.log(`${browser} binary ready`)
}
```

### Custom Logging

```javascript
import { createCuimpHttp } from 'cuimp'

// Suppress all logs
const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

const client = createCuimpHttp({
  descriptor: { browser: 'chrome' },
  logger: silentLogger,
})

// Or use a structured logger (Winston, Pino, etc.)
const client = createCuimpHttp({
  descriptor: { browser: 'chrome' },
  logger: myStructuredLogger,
})
```

## API Reference

### Convenience Functions

#### `get(url, config?)`

Make a GET request.

```javascript
const response = await get('https://api.example.com/users')
```

#### `post(url, data?, config?)`

Make a POST request.

```javascript
const response = await post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com',
})
```

#### `put(url, data?, config?)`

Make a PUT request.

#### `patch(url, data?, config?)`

Make a PATCH request.

#### `del(url, config?)`

Make a DELETE request.

#### `head(url, config?)`

Make a HEAD request.

#### `options(url, config?)`

Make an OPTIONS request.

#### `downloadBinary(options?)`

Download curl-impersonate binary without making HTTP requests.

```javascript
// Download default binary
const info = await downloadBinary()

// Download specific browser binary
const chromeInfo = await downloadBinary({
  descriptor: { browser: 'chrome', version: '123' },
})
```

### HTTP Client

#### `createCuimpHttp(options?)`

Create an HTTP client instance.

```javascript
const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
  path: '/custom/path/to/binary',
})

// Use the client
const response = await client.get('https://api.example.com/data')
```

#### `request(config)`

Make a request with full configuration.

```javascript
const response = await request({
  url: 'https://api.example.com/users',
  method: 'POST',
  headers: {
    Authorization: 'Bearer token',
    'Content-Type': 'application/json',
  },
  data: { name: 'John Doe' },
  timeout: 5000,
})
```

### Core Classes

#### `Cuimp`

The core class for managing curl-impersonate binaries and descriptors.

```javascript
import { Cuimp } from 'cuimp'

const cuimp = new Cuimp({
  descriptor: { browser: 'chrome', version: '123' },
  path: '/custom/path',
})

// Verify binary
const info = await cuimp.verifyBinary()

// Build command preview
const command = cuimp.buildCommandPreview('https://example.com', 'GET')

// Download binary without verification
const binaryInfo = await cuimp.download()
```

#### `CuimpHttp`

HTTP client class that wraps the Cuimp core.

```javascript
import { CuimpHttp, Cuimp } from 'cuimp'

const core = new Cuimp()
const client = new CuimpHttp(core, {
  baseURL: 'https://api.example.com',
  timeout: 10000,
})
```

## Configuration

### CuimpDescriptor

Configure which browser to impersonate:

```typescript
interface CuimpDescriptor {
  browser?: 'chrome' | 'firefox' | 'edge' | 'safari'
  version?: string // e.g., '123', '124', or 'latest' (default)
  architecture?: 'x64' | 'arm64'
  platform?: 'linux' | 'windows' | 'macos'
  forceDownload?: boolean // Force re-download even if binary exists
}
```

### CuimpRequestConfig

Request configuration options:

```typescript
interface CuimpRequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  headers?: Record<string, string>
  data?: any
  timeout?: number
  maxRedirects?: number
  proxy?: string // HTTP, HTTPS, or SOCKS proxy URL
  insecureTLS?: boolean // Skip TLS certificate verification
  signal?: AbortSignal // Request cancellation
}
```

### CuimpOptions

Core options:

```typescript
interface CuimpOptions {
  descriptor?: CuimpDescriptor
  path?: string // Custom path to curl-impersonate binary
  extraCurlArgs?: string[] // Global curl arguments applied to all requests
  logger?: Logger // Custom logger for binary download/verification messages
  cookieJar?: boolean | string // Enable automatic cookie management
}
```

### Cookie Jar Configuration

The `cookieJar` option enables automatic cookie management:

```typescript
// Option 1: Automatic temp file (cleaned up on destroy)
const client = createCuimpHttp({
  cookieJar: true,
})

// Option 2: Custom file path (persists between runs)
// Recommended: Use user home directory for security
import os from 'os'
import path from 'path'

const cookiePath = path.join(os.homedir(), '.cuimp', 'cookies', 'my-cookies.txt')
const client = createCuimpHttp({
  cookieJar: cookiePath, // User-specific, secure location
})

// Option 3: Disabled (default)
const client = createCuimpHttp({
  cookieJar: false, // or omit entirely
})
```

**Best Practices for Cookie File Paths:**

- ✅ Use `~/.cuimp/cookies/` (user home directory) - secure, user-specific, consistent with binary storage
- ✅ Use temp directory for temporary cookies - auto-cleaned
- ❌ Avoid project root (`./cookies.txt`) - risk of committing sensitive data to git

**Cookie Jar Methods:**

```typescript
// Get the cookie jar instance
const jar = client.getCookieJar()

// Get all cookies
const cookies = jar.getCookies()

// Get cookies for a specific domain
const domainCookies = jar.getCookiesForDomain('example.com')

// Manually set a cookie
jar.setCookie({
  domain: 'example.com',
  name: 'my_cookie',
  value: 'my_value',
  path: '/',
  secure: true,
  expires: new Date('2025-12-31'),
})

// Delete a cookie
jar.deleteCookie('my_cookie', 'example.com')

// Clear all cookies
client.clearCookies()

// Clean up (removes temp file if using cookieJar: true)
client.destroy()
```

### Custom Logging

You can provide a custom logger to control how cuimp logs binary download and verification messages:

```typescript
interface Logger {
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
  debug(...args: any[]): void
}
```

**Example: Using a custom formatted logger**

```javascript
import { createCuimpHttp } from 'cuimp'

// Custom logger with formatted output
const customLogger = {
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
  debug: (...args) => console.debug('[DEBUG]', new Date().toISOString(), ...args),
}

const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
  logger: customLogger,
})

// Now all binary download/verification messages will use your custom format
await client.get('https://api.example.com/data')
// Output: [INFO] 2024-01-15T10:30:00.000Z Verifying binary...
// Output: [INFO] 2024-01-15T10:30:01.000Z Binary verified successfully
```

**Example: Collecting logs for analysis**

```javascript
const logEntries = []

const collectingLogger = {
  info: (...args) =>
    logEntries.push({ level: 'info', timestamp: Date.now(), message: args.join(' ') }),
  warn: (...args) =>
    logEntries.push({ level: 'warn', timestamp: Date.now(), message: args.join(' ') }),
  error: (...args) =>
    logEntries.push({ level: 'error', timestamp: Date.now(), message: args.join(' ') }),
  debug: (...args) =>
    logEntries.push({ level: 'debug', timestamp: Date.now(), message: args.join(' ') }),
}

const client = createCuimpHttp({
  descriptor: { browser: 'firefox' },
  logger: collectingLogger,
})

await client.get('https://api.example.com/data')

// Analyze collected logs
console.log('Collected logs:', logEntries)
// Can send to external logging service, save to file, etc.
```

By default, cuimp uses `console` for logging.

## Supported Browsers

| Browser | Versions                                                                  | Platforms                      |
| ------- | ------------------------------------------------------------------------- | ------------------------------ |
| Chrome  | 99, 100, 101, 104, 107, 110, 116, 119, 120, 123, 124, 131, 133a, 136, 142 | Linux, Windows, macOS, Android |
| Firefox | 133, 135, 145                                                             | Linux, Windows, macOS          |
| Edge    | 99, 101                                                                   | Linux, Windows, macOS          |
| Safari  | 153, 155, 170, 172, 180, 184, 260, 2601                                   | macOS, iOS                     |
| Tor     | 145                                                                       | Linux, Windows, macOS          |

## Response Format

All HTTP methods return a standardized response. **Important**: Unlike traditional curl behavior, cuimp returns response objects for all HTTP status codes (including 4xx/5xx), allowing you to access error response bodies, headers, and status information. Only network errors (connection failures, DNS errors, etc.) throw exceptions.

```typescript
interface CuimpResponse<T = any> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
  rawBody: Buffer
  request: {
    url: string
    method: string
    headers: Record<string, string>
    command: string
  }
}
```

## Examples

> **📁 Runnable Examples**: Check out the [`examples/`](./examples/) folder for complete, runnable examples demonstrating all features of cuimp.

### Basic Usage

```javascript
import { get, post } from 'cuimp'

// GET request
const users = await get('https://jsonplaceholder.typicode.com/users')
console.log(users.data)

// POST request
const newUser = await post('https://jsonplaceholder.typicode.com/users', {
  name: 'John Doe',
  email: 'john@example.com',
})
```

### Using HTTP Client

```javascript
import { createCuimpHttp } from 'cuimp'

const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
})

// Set default headers
client.defaults.headers['Authorization'] = 'Bearer your-token'

// Make requests
const response = await client.get('/api/users')
```

### Custom Binary Path

```javascript
import { Cuimp } from 'cuimp'

const cuimp = new Cuimp({
  path: '/usr/local/bin/curl-impersonate',
})

const info = await cuimp.verifyBinary()
```

### Handling 4xx/5xx Error Responses

```javascript
import { get, post } from 'cuimp'

// 4xx/5xx responses return response objects (not thrown)
const response = await get('https://httpbin.org/status/404')

if (response.status === 404) {
  console.log('Resource not found:', response.data)
} else if (response.status >= 500) {
  console.error('Server error:', response.statusText)
  console.error('Error details:', response.data)
} else if (response.status >= 400) {
  console.warn('Client error:', response.status, response.statusText)
}

// Handle JSON error responses
const errorResponse = await post('https://api.example.com/users', {
  email: 'invalid-email',
})

if (errorResponse.status === 400) {
  // Access the error body (parsed JSON if Content-Type is application/json)
  const errorData = errorResponse.data
  console.log('Validation errors:', errorData.errors)
  console.log('Error message:', errorData.message)
}
```

### Error Handling

**4xx/5xx Responses**: Unlike traditional curl behavior, cuimp returns full response objects for HTTP error status codes (4xx/5xx), similar to axios and Postman. This allows you to access error response bodies, headers, and status information.

```javascript
import { get } from 'cuimp'

// 4xx/5xx responses return response objects (not thrown)
const response = await get('https://httpbin.org/status/404')
console.log('Status:', response.status) // 404
console.log('Status Text:', response.statusText) // 'Not Found'
console.log('Body:', response.data) // Response body (if any)
console.log('Headers:', response.headers) // Response headers

// Check status and handle accordingly
if (response.status >= 400) {
  console.error(`Error ${response.status}:`, response.data)
} else {
  console.log('Success:', response.data)
}
```

**Network Errors**: Network errors (connection failures, DNS errors, etc.) are still thrown as exceptions:

```javascript
import { get } from 'cuimp'

try {
  const response = await get('https://api.example.com/data')
  console.log(response.data)
} catch (error) {
  if (error.code === 'ENOTFOUND') {
    console.log('Network error: DNS resolution failed')
  } else if (error.code === 'ECONNREFUSED') {
    console.log('Network error: Connection refused')
  } else {
    console.log('Unknown error:', error.message)
  }
}
```

## Binary Management

Cuimp automatically manages curl-impersonate binaries:

1. **Automatic Download**: Downloads the appropriate binary for your platform on first use
2. **Version Matching**: Reuses cached binaries only if they match the requested version
3. **Force Download**: Use `forceDownload: true` to bypass cache and always download fresh binaries
4. **Verification**: Checks binary integrity and permissions
5. **Clean Storage**: Binaries are stored in `~/.cuimp/binaries/` (user home directory)
6. **Cross-Platform**: Automatically detects your platform and architecture

### Version Behavior

- **Specific version** (e.g., `'133'`): Uses cached binary if version matches, otherwise downloads
- **'latest'** (default): Uses any cached binary, or downloads if none exists
- **forceDownload**: Always downloads, ignoring cache (useful for always getting the actual latest version)

### Binary Storage Location

- **Download location**: `~/.cuimp/binaries/` (user home directory)
- **Search locations**: Also checks `node_modules/cuimp/binaries/` and system paths as fallback
- **Shared across projects**: Downloaded binaries are reused between projects
- **No Project Pollution**: Your project directory stays clean

### Supported Proxy Formats

```javascript
// HTTP proxy
proxy: 'http://proxy.example.com:8080'

// HTTPS proxy
proxy: 'https://proxy.example.com:8080'

// SOCKS4 proxy
proxy: 'socks4://proxy.example.com:1080'

// SOCKS5 proxy
proxy: 'socks5://proxy.example.com:1080'

// Proxy with authentication
proxy: 'http://username:password@proxy.example.com:8080'
proxy: 'socks5://username:password@proxy.example.com:1080'

// Automatic from environment variables
// HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, http_proxy, https_proxy, all_proxy
```

## Important Notes

### Force Download Behavior

Cuimp **always downloads fresh binaries** on first use, regardless of what's already installed on your system. This ensures:

- ✅ **Consistency**: All users get the same binary versions
- ✅ **Reliability**: No dependency on system-installed binaries
- ✅ **Security**: Fresh downloads with verified checksums
- ✅ **Simplicity**: No need to manage system dependencies

### Environment Variables

Cuimp automatically detects and uses these proxy environment variables:

```bash
# Set proxy for all requests
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8080
export ALL_PROXY=socks5://proxy.example.com:1080

# Or use lowercase variants
export http_proxy=http://proxy.example.com:8080
export https_proxy=https://proxy.example.com:8080
export all_proxy=socks5://proxy.example.com:1080
```

## Requirements

- Node.js >= 18.17
- Internet connection (for binary download)

## Troubleshooting

### Common Issues

**Q: Binary download fails**

```bash
# Check your internet connection and try again
# The binary will be downloaded to node_modules/cuimp/binaries/
```

**Q: Proxy not working**

```javascript
// Make sure your proxy URL is correct
const response = await request({
  url: 'https://httpbin.org/ip',
  proxy: 'http://username:password@proxy.example.com:8080',
})

// Or set environment variables
process.env.HTTP_PROXY = 'http://proxy.example.com:8080'
```

**Q: Permission denied errors**

```bash
# On Unix systems, make sure the binary has execute permissions
chmod +x node_modules/cuimp/binaries/curl-impersonate
```

**Q: Binary not found**

```javascript
// Force re-download by clearing the binaries directory
rm -rf node_modules/cuimp/binaries/
// Then run your code again - it will re-download
```

### Debug Mode

Enable debug logging to see what's happening:

```javascript
// Set debug environment variable
process.env.DEBUG = 'cuimp:*'

// Or check the binary path
import { Cuimp } from 'cuimp'
const cuimp = new Cuimp()
const binaryPath = await cuimp.verifyBinary()
console.log('Binary path:', binaryPath)
```

### Docker

#### Error: “error setting certificate verify locations”

When running cuimp inside a Docker container, you may encounter the following error:

`error setting certificate verify locations: CAfile: /etc/ssl/certs/ca-certificates.crt CApath: /etc/ssl/certs`

This occurs because the container does not have access to the required CA certificates.  
To fix this, mount your host machine’s certificate directory into the container, for example:

```docker-compose
volumes:
  - /etc/ssl/certs:/etc/ssl/certs:ro
```
This ensures cuimp can properly verify TLS certificates inside the container.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Feel free to check the [issues page](https://github.com/F4RAN/cuimp-ts/issues) if you want to contribute.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔗 Links

- **NPM Package**: [npmjs.com/package/cuimp](https://www.npmjs.com/package/cuimp)
- **GitHub Repository**: [github.com/F4RAN/cuimp-ts](https://github.com/F4RAN/cuimp-ts)
- **curl-impersonate**: [github.com/lexiforest/curl-impersonate](https://github.com/lexiforest/curl-impersonate)
- **Issues & Bug Reports**: [github.com/F4RAN/cuimp-ts/issues](https://github.com/F4RAN/cuimp-ts/issues)

## 👥 Contributors

Thanks to these awesome people who have contributed to this project:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/F4RAN">
        <img src="https://github.com/F4RAN.png" width="100px;" alt="F4RAN"/><br />
        <sub><b>F4RAN</b></sub>
      </a><br />
      <sub>Original Author & Maintainer</sub>
    </td>
    <td align="center">
      <a href="https://github.com/ma-joel">
        <img src="https://github.com/ma-joel.png" width="100px;" alt="ma-joel"/><br />
        <sub><b>ma-joel</b></sub>
      </a><br />
      <sub>CI, Encoding & Redirects</sub>
    </td>
    <td align="center">
      <a href="https://github.com/parigi-n">
        <img src="https://github.com/parigi-n.png" width="100px;" alt="parigi-n"/><br />
        <sub><b>parigi-n</b></sub>
      </a><br />
      <sub>Bug Fixes</sub>
    </td>
    <td align="center">
      <a href="https://github.com/nvitaterna">
        <img src="https://github.com/nvitaterna.png" width="100px;" alt="nvitaterna"/><br />
        <sub><b>nvitaterna</b></sub>
      </a><br />
      <sub>Bug Fixes</sub>
    </td>
    <td align="center">
      <a href="https://github.com/tony13tv">
        <img src="https://github.com/tony13tv.png" width="100px;" alt="tony13tv"/><br />
        <sub><b>tony13tv</b></sub>
      </a><br />
      <sub>macOS Support</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/reyzzz">
        <img src="https://github.com/reyzzz.png" width="100px;" alt="reyzzz"/><br />
        <sub><b>reyzzz</b></sub>
      </a><br />
      <sub>HTTP/2 Headers Fix</sub>
    </td>
  </tr>
</table>

---

<div align="center">

**If you find this project useful, please consider giving it a ⭐️!**

Made with ❤️ by the Cuimp community

</div>
