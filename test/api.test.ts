import { describe, it, expect } from 'vitest'
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
  options
} from '../src/index'

describe('API Tests', () => {
  describe('Cuimp class', () => {
    it('should create instance with default options', () => {
      const cuimp = new Cuimp()
      expect(cuimp.getDescriptor()).toEqual({})
      expect(cuimp.getBinaryPath()).toBe('')
    })

    it('should create instance with custom options', () => {
      const options = {
        descriptor: { browser: 'chrome', version: '123' },
        path: '/custom/path'
      }
      const cuimp = new Cuimp(options)
      expect(cuimp.getDescriptor()).toEqual(options.descriptor)
      expect(cuimp.getBinaryPath()).toBe(options.path)
    })

    it('should handle descriptor updates', () => {
      const cuimp = new Cuimp()
      
      cuimp.setDescriptor({ browser: 'chrome', version: '123' })
      expect(cuimp.getDescriptor()).toEqual({ browser: 'chrome', version: '123' })
      
      cuimp.setBinaryPath('/custom/path')
      expect(cuimp.getBinaryPath()).toBe('/custom/path')
    })

    it('should return undefined for binary info when not set', () => {
      const cuimp = new Cuimp()
      expect(cuimp.getBinaryInfo()).toBeUndefined()
    })
  })

  describe('CuimpHttp class', () => {
    it('should create instance with core', () => {
      const cuimp = new Cuimp()
      const client = new CuimpHttp(cuimp)
      expect(client).toBeInstanceOf(CuimpHttp)
    })

    it('should create instance with core and defaults', () => {
      const cuimp = new Cuimp()
      const defaults = { baseURL: 'https://api.example.com' }
      const client = new CuimpHttp(cuimp, defaults)
      expect(client).toBeInstanceOf(CuimpHttp)
    })
  })

  describe('Factory function', () => {
    it('should create HTTP client with options', () => {
      const client = createCuimpHttp({
        descriptor: { browser: 'chrome' }
      })
      expect(client).toBeInstanceOf(CuimpHttp)
    })

    it('should create HTTP client without options', () => {
      const client = createCuimpHttp()
      expect(client).toBeInstanceOf(CuimpHttp)
    })
  })

  describe('Convenience functions', () => {
    it('should be functions', () => {
      expect(typeof request).toBe('function')
      expect(typeof get).toBe('function')
      expect(typeof post).toBe('function')
      expect(typeof put).toBe('function')
      expect(typeof patch).toBe('function')
      expect(typeof del).toBe('function')
      expect(typeof head).toBe('function')
      expect(typeof options).toBe('function')
    })
  })

  describe('Type safety', () => {
    it('should maintain type safety', () => {
      interface User {
        id: number
        name: string
        email: string
      }
      
      // These should compile without errors
      const client = createCuimpHttp()
      const promise: Promise<any> = client.get<User>('https://api.example.com/users/123')
      expect(promise).toBeInstanceOf(Promise)
    })
  })
})
