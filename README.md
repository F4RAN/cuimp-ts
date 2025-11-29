# Cuimp

A Node.js wrapper for [curl-impersonate](https://github.com/lwthiker/curl-impersonate) that allows you to make HTTP requests that mimic real browser behavior, bypassing many anti-bot protections.

## Features

- 🚀 **Browser Impersonation**: Mimic Chrome, Firefox, Safari, and Edge browsers
- 🔧 **Easy to Use**: Simple API similar to axios/fetch
- 📦 **Zero Dependencies**: Only requires `tar` for binary extraction
- 🎯 **TypeScript Support**: Full type definitions included
- 🔄 **Auto Binary Management**: Automatically downloads and manages curl-impersonate binaries
- 🌐 **Cross-Platform**: Works on Linux, macOS, and Windows
- 🔒 **Proxy Support**: Built-in support for HTTP, HTTPS, and SOCKS proxies with authentication
- 📁 **Clean Installation**: Binaries stored in package directory, not your project root

## Installation

```bash
npm install cuimp
```

## Quick Start

```javascript
import { get, post, createCuimpHttp } from 'cuimp'

// Simple GET request
const response = await get('https://httpbin.org/headers')
console.log(response.data)

// POST with data
const result = await post('https://httpbin.org/post', {
  name: 'John Doe',
  email: 'john@example.com'
})

// Using HTTP client instance
const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' }
})

const data = await client.get('https://api.example.com/users')
```

## Project Usage Examples

### Web Scraping with Browser Impersonation

```javascript
import { get, createCuimpHttp } from 'cuimp'

// Create a client that mimics Chrome 123
const scraper = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' }
})

// Scrape a website that blocks regular requests
const response = await scraper.get('https://example.com/protected-content', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
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
    descriptor: { browser, version: 'latest' }
  })
  
  const response = await client.get('https://your-api.com/test')
  console.log(`${browser}: ${response.status}`)
}
```

### Using with Proxies

```javascript
import { request } from 'cuimp'

// HTTP proxy
const response1 = await request({
  url: 'https://httpbin.org/ip',
  proxy: 'http://proxy.example.com:8080'
})

// SOCKS5 proxy with authentication
const response2 = await request({
  url: 'https://httpbin.org/ip',
  proxy: 'socks5://user:pass@proxy.example.com:1080'
})

// Automatic proxy detection from environment variables
// HTTP_PROXY, HTTPS_PROXY, ALL_PROXY
const response3 = await request({
  url: 'https://httpbin.org/ip'
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
  descriptor: { browser: 'firefox', version: '133' } 
})

// Pre-download multiple browsers for offline use
const browsers = ['chrome', 'firefox', 'safari', 'edge']
for (const browser of browsers) {
  await downloadBinary({ descriptor: { browser } })
  console.log(`${browser} binary ready`)
}
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
  email: 'john@example.com'
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
  descriptor: { browser: 'chrome', version: '123' } 
})
```

### HTTP Client

#### `createCuimpHttp(options?)`
Create an HTTP client instance.

```javascript
const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' },
  path: '/custom/path/to/binary'
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
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  data: { name: 'John Doe' },
  timeout: 5000
})
```

### Core Classes

#### `Cuimp`
The core class for managing curl-impersonate binaries and descriptors.

```javascript
import { Cuimp } from 'cuimp'

const cuimp = new Cuimp({
  descriptor: { browser: 'chrome', version: '123' },
  path: '/custom/path'
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
  timeout: 10000
})
```

## Configuration

### CuimpDescriptor

Configure which browser to impersonate:

```typescript
interface CuimpDescriptor {
  browser?: 'chrome' | 'firefox' | 'edge' | 'safari'
  version?: string  // e.g., '123', '124', or 'latest' (default)
  architecture?: 'x64' | 'arm64'
  platform?: 'linux' | 'windows' | 'macos'
  forceDownload?: boolean  // Force re-download even if binary exists
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
  proxy?: string  // HTTP, HTTPS, or SOCKS proxy URL
  insecureTLS?: boolean  // Skip TLS certificate verification
  signal?: AbortSignal  // Request cancellation
}
```

### CuimpOptions

Core options:

```typescript
interface CuimpOptions {
  descriptor?: CuimpDescriptor
  path?: string  // Custom path to curl-impersonate binary
}
```

## Supported Browsers

| Browser | Versions | Platforms |
|---------|----------|-----------|
| Chrome  | 99, 100, 101, 104, 107, 110, 116, 119, 120, 123, 124, 131, 133a, 136 | Linux, Windows, macOS, Android |
| Firefox | 133, 135 | Linux, Windows, macOS |
| Edge    | 99, 101 | Linux, Windows, macOS |
| Safari  | 153, 155, 170, 172, 180, 184, 260 | macOS, iOS |
| Tor     | 145 | Linux, Windows, macOS |

## Response Format

All HTTP methods return a standardized response:

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

### Basic Usage

```javascript
import { get, post } from 'cuimp'

// GET request
const users = await get('https://jsonplaceholder.typicode.com/users')
console.log(users.data)

// POST request
const newUser = await post('https://jsonplaceholder.typicode.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
})
```

### Using HTTP Client

```javascript
import { createCuimpHttp } from 'cuimp'

const client = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '123' }
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
  path: '/usr/local/bin/curl-impersonate'
})

const info = await cuimp.verifyBinary()
```

### Error Handling

```javascript
import { get } from 'cuimp'

try {
  const response = await get('https://api.example.com/data')
  console.log(response.data)
} catch (error) {
  if (error.code === 'ENOTFOUND') {
    console.log('Network error')
  } else if (error.status) {
    console.log(`HTTP ${error.status}: ${error.statusText}`)
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
  proxy: 'http://username:password@proxy.example.com:8080'
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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [GitHub Repository](https://github.com/f4ran/cuimp-ts)
- [curl-impersonate](https://github.com/lexiforest/curl-impersonate)
- [npm Package](https://www.npmjs.com/package/cuimp)

# Contributors

Thanks to these awesome people:


- [@F4RAN](https://github.com/F4RAN) - Original author and maintainer
- [@ma-joel](https://github.com/ma-joel) - CI build, non-UTF-8 encoding support, redirect fixes
- [@parigi-n](https://github.com/parigi-n) - Additional bug fixes and improvements
- [@nvitaterna](https://github.com/nvitaterna) - Additional bug fixes and improvements
