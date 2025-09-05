import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  Cuimp, 
  CuimpHttp, 
  createCuimpHttp, 
  request, 
  get, 
  post, 
  put, 
  patch, 
  del, 
  head, 
  options,
  runBinary 
} from '../../src/index'

// Mock the runner module
vi.mock('../../src/runner', () => ({
  runBinary: vi.fn()
}))

// Mock the parser module
vi.mock('../../src/helpers/parser', () => ({
  parseDescriptor: vi.fn()
}))

// Mock the validation module
vi.mock('../../src/validations/descriptorValidation', () => ({
  validateDescriptor: vi.fn()
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    constants: {
      S_IXUSR: 0o100,
      S_IXGRP: 0o010,
      S_IXOTH: 0o001
    }
  }
}))

describe('Integration Tests - Main API', () => {
  const mockRunBinary = vi.mocked(await import('../../src/runner')).runBinary
  const mockParseDescriptor = vi.mocked(await import('../../src/helpers/parser')).parseDescriptor
  const mockValidateDescriptor = vi.mocked(await import('../../src/validations/descriptorValidation')).validateDescriptor
  const mockFs = vi.mocked(await import('fs')).default

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockParseDescriptor.mockResolvedValue({
      binaryPath: '/usr/bin/curl-impersonate',
      isDownloaded: false
    })
    
    mockFs.existsSync.mockReturnValue(true)
    mockFs.statSync.mockReturnValue({
      isFile: () => true,
      mode: 0o755
    } as any)
    
    mockRunBinary.mockResolvedValue({
      exitCode: 0,
      stdout: Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"message":"success"}'),
      stderr: Buffer.from('')
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cuimp class integration', () => {
    it('should create instance and verify binary', async () => {
      const cuimp = new Cuimp()
      const binaryPath = await cuimp.verifyBinary()
      
      expect(binaryPath).toBe('/usr/bin/curl-impersonate')
      expect(mockValidateDescriptor).toHaveBeenCalled()
      expect(mockParseDescriptor).toHaveBeenCalled()
    })

    it('should build command preview', async () => {
      const cuimp = new Cuimp()
      const command = await cuimp.buildCommandPreview('https://example.com', 'GET')
      
      expect(command).toBe('/usr/bin/curl-impersonate -X GET "https://example.com"')
    })

    it('should handle descriptor updates', async () => {
      const cuimp = new Cuimp()
      
      cuimp.setDescriptor({ browser: 'chrome', version: '123' })
      expect(cuimp.getDescriptor()).toEqual({ browser: 'chrome', version: '123' })
      
      cuimp.setBinaryPath('/custom/path')
      expect(cuimp.getBinaryPath()).toBe('/custom/path')
    })
  })

  describe('CuimpHttp class integration', () => {
    it('should make HTTP requests', async () => {
      const cuimp = new Cuimp()
      const client = new CuimpHttp(cuimp)
      
      const response = await client.get('https://api.example.com/test')
      
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ message: 'success' })
      expect(mockRunBinary).toHaveBeenCalled()
    })

    it('should handle different HTTP methods', async () => {
      const cuimp = new Cuimp()
      const client = new CuimpHttp(cuimp)
      
      // Test all HTTP methods
      await client.get('https://api.example.com/test')
      await client.post('https://api.example.com/test', { data: 'test' })
      await client.put('https://api.example.com/test', { data: 'test' })
      await client.patch('https://api.example.com/test', { data: 'test' })
      await client.delete('https://api.example.com/test')
      await client.head('https://api.example.com/test')
      await client.options('https://api.example.com/test')
      
      expect(mockRunBinary).toHaveBeenCalledTimes(7)
    })

    it('should handle request configuration', async () => {
      const cuimp = new Cuimp()
      const client = new CuimpHttp(cuimp, {
        baseURL: 'https://api.example.com',
        headers: { 'Authorization': 'Bearer token' }
      })
      
      const response = await client.get('/users/123', {
        params: { include: 'profile' },
        timeout: 5000
      })
      
      expect(response.status).toBe(200)
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          'https://api.example.com/users/123?include=profile',
          '-H', 'Authorization: Bearer token'
        ]),
        { timeout: 5000, signal: undefined }
      )
    })
  })

  describe('Factory function integration', () => {
    it('should create HTTP client with options', async () => {
      const client = createCuimpHttp({
        descriptor: { browser: 'chrome' }
      })
      
      const response = await client.get('https://api.example.com/test')
      
      expect(response.status).toBe(200)
      expect(mockValidateDescriptor).toHaveBeenCalledWith({ browser: 'chrome' })
    })
  })

  describe('Convenience functions integration', () => {
    it('should work with request function', async () => {
      const response = await request({
        url: 'https://api.example.com/test',
        method: 'GET'
      })
      
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ message: 'success' })
    })

    it('should work with HTTP method shortcuts', async () => {
      // Test all convenience functions
      await get('https://api.example.com/test')
      await post('https://api.example.com/test', { data: 'test' })
      await put('https://api.example.com/test', { data: 'test' })
      await patch('https://api.example.com/test', { data: 'test' })
      await del('https://api.example.com/test')
      await head('https://api.example.com/test')
      await options('https://api.example.com/test')
      
      expect(mockRunBinary).toHaveBeenCalledTimes(7)
    })

    it('should handle configuration in convenience functions', async () => {
      const response = await get('https://api.example.com/test', {
        headers: { 'X-Custom': 'value' },
        params: { page: 1 }
      })
      
      expect(response.status).toBe(200)
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          'https://api.example.com/test?page=1',
          '-H', 'X-Custom: value'
        ]),
        expect.any(Object)
      )
    })
  })

  describe('Error handling integration', () => {
    it('should handle binary verification errors', async () => {
      mockParseDescriptor.mockRejectedValue(new Error('Binary not found'))
      
      const cuimp = new Cuimp()
      
      await expect(cuimp.verifyBinary()).rejects.toThrow('Failed to verify binary: Binary not found')
    })

    it('should handle HTTP request errors', async () => {
      mockRunBinary.mockResolvedValue({
        exitCode: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('curl: (6) Could not resolve host')
      })
      
      const client = createCuimpHttp()
      
      const response = await client.get('https://nonexistent.example.com')
      
      // The client should still return a response object, but with error info
      expect(response).toBeDefined()
      expect(mockRunBinary).toHaveBeenCalled()
    })

    it('should handle malformed HTTP responses', async () => {
      mockRunBinary.mockResolvedValue({
        exitCode: 0,
        stdout: Buffer.from('Invalid HTTP response format'),
        stderr: Buffer.from('')
      })
      
      const client = createCuimpHttp()
      
      await expect(client.get('https://api.example.com/test')).rejects.toThrow(
        'Unexpected response format'
      )
    })
  })

  describe('Type safety integration', () => {
    it('should maintain type safety across the API', async () => {
      interface User {
        id: number
        name: string
        email: string
      }
      
      const client = createCuimpHttp()
      
      // This should be type-safe
      const response = await client.get<User>('https://api.example.com/users/123')
      
      // Mock a proper response
      mockRunBinary.mockResolvedValue({
        exitCode: 0,
        stdout: Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"id":123,"name":"John","email":"john@example.com"}'),
        stderr: Buffer.from('')
      })
      
      const typedResponse = await client.get<User>('https://api.example.com/users/123')
      
      expect(typedResponse.data).toHaveProperty('id')
      expect(typedResponse.data).toHaveProperty('name')
      expect(typedResponse.data).toHaveProperty('email')
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle API with authentication', async () => {
      const client = createCuimpHttp()
      
      const response = await client.get('https://api.github.com/user', {
        headers: {
          'Authorization': 'Bearer github_token',
          'User-Agent': 'cuimp-test'
        }
      })
      
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          '-H', 'Authorization: Bearer github_token',
          '-H', 'User-Agent: cuimp-test'
        ]),
        expect.any(Object)
      )
    })

    it('should handle file upload', async () => {
      const client = createCuimpHttp()
      
      const fileData = Buffer.from('file content')
      const response = await client.post('https://api.example.com/upload', fileData, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })
      
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          '--data-binary', 'file content',
          '-H', 'Content-Type: application/octet-stream'
        ]),
        expect.any(Object)
      )
    })

    it('should handle form submission', async () => {
      const client = createCuimpHttp()
      
      const formData = new URLSearchParams()
      formData.append('username', 'john')
      formData.append('password', 'secret')
      
      const response = await client.post('https://api.example.com/login', formData)
      
      expect(mockRunBinary).toHaveBeenCalledWith(
        '/usr/bin/curl-impersonate',
        expect.arrayContaining([
          '--data', 'username=john&password=secret',
          '-H', 'Content-Type: application/x-www-form-urlencoded'
        ]),
        expect.any(Object)
      )
    })
  })
})
