# Cuimp

A Node.js wrapper for [curl-impersonate](https://github.com/lwthiker/curl-impersonate) that allows you to make HTTP requests that mimic real browser behavior, bypassing many anti-bot protections.

## Features

- 🚀 **Browser Impersonation**: Mimic Chrome, Firefox, Safari, and Edge browsers
- 🔧 **Easy to Use**: Simple API similar to axios/fetch
- 📦 **Zero Dependencies**: Only requires `tar` for binary extraction
- 🎯 **TypeScript Support**: Full type definitions included
- 🔄 **Auto Binary Management**: Automatically downloads and manages curl-impersonate binaries
- 🌐 **Cross-Platform**: Works on Linux, macOS, and Windows

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
  version?: string  // e.g., '123', '124'
  architecture?: 'x64' | 'arm64'
  platform?: 'linux' | 'windows' | 'macos'
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
  followRedirects?: boolean
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

1. **First Run**: Downloads the appropriate binary for your platform
2. **Verification**: Checks binary integrity and permissions
3. **Caching**: Stores binaries locally for future use
4. **Updates**: Can re-download if binary is corrupted

Binaries are stored in the `binaries/` directory relative to your project.

## Requirements

- Node.js >= 18.17
- Internet connection (for initial binary download)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [GitHub Repository](https://github.com/f4ran/cuimp-ts)
- [curl-impersonate](https://github.com/lexiforest/curl-impersonate)
- [npm Package](https://www.npmjs.com/package/cuimp)
