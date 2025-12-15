import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CuimpHttp } from '../../src/client'
import { Cuimp } from '../../src/cuimp'
import { CuimpRequestConfig } from '../../src/types/cuimpTypes'
import { CurlError, CurlExitCode } from '../../src/types/curlErrors'

// Mock the runner module
vi.mock('../../src/runner', () => ({
  runBinary: vi.fn(),
}))

describe('CuimpHttp', () => {
  let mockCuimp: Cuimp
  let client: CuimpHttp
  let mockRunBinary: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCuimp = {
      ensurePath: vi.fn().mockResolvedValue('/usr/bin/curl-impersonate'),
    } as any
    client = new CuimpHttp(mockCuimp)

    // Get mocked functions
    const runnerModule = await import('../../src/runner')
    mockRunBinary = vi.mocked(runnerModule.runBinary)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with core and defaults', () => {
      const defaults = { baseURL: 'https://api.example.com' }
      const instance = new CuimpHttp(mockCuimp, defaults)
      expect(instance).toBeInstanceOf(CuimpHttp)
    })
  })

  describe('request', () => {
    it('should make GET request successfully', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from(
          'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"message":"success"}'
        ),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      }

      const response = await client.request(config)

      expect(response.status).toBe(200)
      expect(response.statusText).toBe('OK')
      expect(response.data).toEqual({ message: 'success' })
      expect(response.headers['Content-Type']).toBe('application/json')
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          '--location',
          '--max-redirs',
          '10',
          '-i',
          'https://api.example.com/test',
        ]),
        expect.any(Object)
      )
    })

    it('should make POST request with JSON data', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from(
          'HTTP/1.1 201 Created\r\nContent-Type: application/json\r\n\r\n{"id":123}'
        ),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John Doe', email: 'john@example.com' },
      }

      const response = await client.request(config)

      expect(response.status).toBe(201)
      expect(response.statusText).toBe('Created')
      expect(response.data).toEqual({ id: 123 })

      // On Windows, data is passed via stdin; on other platforms, via command-line
      const isWindows = process.platform === 'win32'
      if (isWindows) {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining([
            '-X',
            'POST',
            '--data-binary',
            '@-',
            '-H',
            'Content-Type: application/json',
          ]),
          expect.objectContaining({
            stdin: '{"name":"John Doe","email":"john@example.com"}',
          })
        )
      } else {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining([
            '-X',
            'POST',
            '--data-binary',
            '{"name":"John Doe","email":"john@example.com"}',
            '-H',
            'Content-Type: application/json',
          ]),
          expect.any(Object)
        )
      }
    })

    it('should handle URL parameters', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/search',
        params: { q: 'test query', page: 1 },
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['https://api.example.com/search?q=test+query&page=1']),
        expect.any(Object)
      )
    })

    it('should handle custom headers', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          '-H',
          'Authorization: Bearer token123',
          '-H',
          'X-Custom-Header: custom-value',
        ]),
        expect.any(Object)
      )
    })

    it('should handle baseURL', async () => {
      const clientWithBaseURL = new CuimpHttp(mockCuimp, { baseURL: 'https://api.example.com' })
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: '/users/123',
      }

      await clientWithBaseURL.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['https://api.example.com/users/123']),
        expect.any(Object)
      )
    })

    it('should handle timeout', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        timeout: 5000,
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith('/usr/bin/curl-impersonate', expect.any(Array), {
        timeout: 5000,
        signal: undefined,
      })
    })

    it('should handle proxy', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        proxy: 'http://proxy.example.com:8080',
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--proxy', 'http://proxy.example.com:8080']),
        expect.any(Object)
      )
    })

    it('should handle proxy without scheme', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        proxy: 'proxy.example.com:8080',
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--proxy', 'http://proxy.example.com:8080']),
        expect.any(Object)
      )
    })

    it('should handle proxy with authentication', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        proxy: 'user:pass@proxy.example.com:8080',
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--proxy', 'http://user:pass@proxy.example.com:8080']),
        expect.any(Object)
      )
    })

    it('should handle SOCKS proxy', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        proxy: 'socks5://proxy.example.com:1080',
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--proxy', 'socks5://proxy.example.com:1080']),
        expect.any(Object)
      )
    })

    it('should handle insecure TLS', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        insecureTLS: true,
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-k']),
        expect.any(Object)
      )
    })

    it('should handle redirects', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        maxRedirects: 5,
      }

      await client.request(config)

      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--location', '--max-redirs', '5']),
        expect.any(Object)
      )
    })

    it('should handle form data', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const formData = new URLSearchParams()
      formData.append('username', 'john')
      formData.append('password', 'secret')

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/login',
        method: 'POST',
        data: formData,
      }

      await client.request(config)

      // On Windows, data is passed via stdin; on other platforms, via command-line
      const isWindows = process.platform === 'win32'
      if (isWindows) {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining([
            '--data-binary',
            '@-',
            '-H',
            'Content-Type: application/x-www-form-urlencoded',
          ]),
          expect.objectContaining({
            stdin: 'username=john&password=secret',
          })
        )
      } else {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining([
            '--data',
            'username=john&password=secret',
            '-H',
            'Content-Type: application/x-www-form-urlencoded',
          ]),
          expect.any(Object)
        )
      }
    })

    it('should handle string data', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'POST',
        data: 'raw string data',
      }

      await client.request(config)

      // On Windows, data is passed via stdin; on other platforms, via command-line
      const isWindows = process.platform === 'win32'
      if (isWindows) {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining(['--data-binary', '@-']),
          expect.objectContaining({
            stdin: 'raw string data',
          })
        )
      } else {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining(['--data-binary', 'raw string data']),
          expect.any(Object)
        )
      }
    })

    it('should handle Buffer data', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const bufferData = Buffer.from('binary data')
      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'POST',
        data: bufferData,
      }

      await client.request(config)

      // On Windows, data is passed via stdin; on other platforms, via command-line
      const isWindows = process.platform === 'win32'
      if (isWindows) {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining(['--data-binary', '@-']),
          expect.objectContaining({
            stdin: bufferData,
          })
        )
      } else {
        expect(mockRunBinary).toHaveBeenCalledWith(
          '/usr/bin/curl-impersonate',
          expect.arrayContaining(['--data-binary', 'binary data']),
          expect.any(Object)
        )
      }
    })

    it('should throw error for missing URL', async () => {
      const config: CuimpRequestConfig = {
        method: 'GET',
      }

      await expect(client.request(config)).rejects.toThrow('URL is required')
    })

    it('should handle multiple redirects in response', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from(
          'HTTP/1.1 302 Found\r\nLocation: /redirect1\r\n\r\n' +
            'HTTP/1.1 301 Moved\r\nLocation: /redirect2\r\n\r\n' +
            'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"final":"response"}'
        ),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
      }

      const response = await client.request(config)

      expect(response.status).toBe(200)
      expect(response.statusText).toBe('OK')
      expect(response.data).toEqual({ final: 'response' })
    })

    it('should handle non-JSON response', async () => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello World'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://api.example.com/test',
      }

      const response = await client.request(config)

      expect(response.data).toBe('Hello World')
    })
  })

  describe('HTTP method shortcuts', () => {
    beforeEach(() => {
      const mockResponse = {
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\n\r\n{}'),
        stderr: Buffer.from(''),
      }
      mockRunBinary.mockResolvedValue(mockResponse)
    })

    it('should handle GET request', async () => {
      await client.get('https://api.example.com/test')
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['--location', '--max-redirs', '10', '-i']),
        expect.any(Object)
      )
    })

    it('should handle POST request', async () => {
      await client.post('https://api.example.com/test', { data: 'test' })
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'POST']),
        expect.any(Object)
      )
    })

    it('should handle PUT request', async () => {
      await client.put('https://api.example.com/test', { data: 'test' })
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'PUT']),
        expect.any(Object)
      )
    })

    it('should handle PATCH request', async () => {
      await client.patch('https://api.example.com/test', { data: 'test' })
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'PATCH']),
        expect.any(Object)
      )
    })

    it('should handle DELETE request', async () => {
      await client.delete('https://api.example.com/test')
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'DELETE']),
        expect.any(Object)
      )
    })

    it('should handle HEAD request', async () => {
      await client.head('https://api.example.com/test')
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'HEAD']),
        expect.any(Object)
      )
    })

    it('should handle OPTIONS request', async () => {
      await client.options('https://api.example.com/test')
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining(['-X', 'OPTIONS']),
        expect.any(Object)
      )
    })
  })

  describe('Error handling', () => {
    it('should throw CurlError when curl exits with non-zero code', async () => {
      const mockResponse = {
        exitCode: CurlExitCode.COULDNT_RESOLVE_HOST,
        stdout: Buffer.from(''),
        stderr: Buffer.from('curl: (6) Could not resolve host'),
      }
      mockRunBinary.mockResolvedValue(mockResponse)

      const config: CuimpRequestConfig = {
        url: 'https://invalid.example.com',
      }

      try {
        await client.request(config)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(CurlError)
        if (err instanceof CurlError) {
          expect(err.code).toBe(CurlExitCode.COULDNT_RESOLVE_HOST)
          expect(err.message).toContain('Could not resolve host')
          expect(err.message).toContain('curl: (6)')
        }
      }
    })
  })
})
