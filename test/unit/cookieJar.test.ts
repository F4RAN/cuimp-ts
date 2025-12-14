import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CookieJar } from '../../src/helpers/cookieJar'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('CookieJar', () => {
  let tempCookieFile: string
  let cookieJar: CookieJar | null = null

  beforeEach(() => {
    tempCookieFile = path.join(os.tmpdir(), `cuimp-test-cookies-${Date.now()}.txt`)
  })

  afterEach(() => {
    // Clean up
    if (cookieJar) {
      cookieJar.destroy()
      cookieJar = null
    }
    // Also clean up the temp file if it exists
    if (fs.existsSync(tempCookieFile)) {
      try {
        fs.unlinkSync(tempCookieFile)
      } catch {
        // Ignore
      }
    }
  })

  describe('constructor', () => {
    it('should create a temporary cookie file when option is true', () => {
      cookieJar = new CookieJar(true)
      const filePath = cookieJar.getFilePath()

      expect(filePath).toContain('cuimp-cookies')
      expect(filePath).toContain('cookies-')
      expect(fs.existsSync(filePath)).toBe(true)
      expect(cookieJar.isTemp()).toBe(true)
    })

    it('should use custom path when string is provided', () => {
      cookieJar = new CookieJar(tempCookieFile)
      const filePath = cookieJar.getFilePath()

      expect(filePath).toBe(tempCookieFile)
      expect(fs.existsSync(filePath)).toBe(true)
      expect(cookieJar.isTemp()).toBe(false)
    })

    it('should create file with Netscape header', () => {
      cookieJar = new CookieJar(tempCookieFile)
      cookieJar.getFilePath() // Trigger file creation

      const content = fs.readFileSync(tempCookieFile, 'utf8')
      expect(content).toContain('# Netscape HTTP Cookie File')
      expect(content).toContain('cuimp')
    })
  })

  describe('getCurlArgs', () => {
    it('should return correct curl arguments', () => {
      cookieJar = new CookieJar(tempCookieFile)
      const args = cookieJar.getCurlArgs()

      expect(args).toHaveLength(4)
      expect(args[0]).toBe('-b')
      expect(args[1]).toBe(tempCookieFile)
      expect(args[2]).toBe('-c')
      expect(args[3]).toBe(tempCookieFile)
    })
  })

  describe('setCookie', () => {
    it('should add a cookie to the file', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({
        domain: 'example.com',
        name: 'session',
        value: 'abc123',
      })

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('session')
      expect(cookies[0].value).toBe('abc123')
      expect(cookies[0].domain).toBe('.example.com')
    })

    it('should handle expiration dates', () => {
      cookieJar = new CookieJar(tempCookieFile)
      const futureDate = new Date(Date.now() + 86400000) // 1 day from now

      cookieJar.setCookie({
        domain: 'example.com',
        name: 'persistent',
        value: 'xyz789',
        expires: futureDate,
      })

      const cookies = cookieJar.getCookies()
      expect(cookies[0].expires).toBeGreaterThan(0)
    })

    it('should set secure flag correctly', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({
        domain: 'example.com',
        name: 'secure_cookie',
        value: 'secret',
        secure: true,
      })

      const cookies = cookieJar.getCookies()
      expect(cookies[0].secure).toBe(true)
    })

    it('should set custom path', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({
        domain: 'example.com',
        name: 'path_cookie',
        value: 'value',
        path: '/api',
      })

      const cookies = cookieJar.getCookies()
      expect(cookies[0].path).toBe('/api')
    })
  })

  describe('getCookies', () => {
    it('should return empty array for empty file', () => {
      cookieJar = new CookieJar(tempCookieFile)
      const cookies = cookieJar.getCookies()

      expect(cookies).toEqual([])
    })

    it('should parse multiple cookies', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({ domain: 'example.com', name: 'cookie1', value: 'value1' })
      cookieJar.setCookie({ domain: 'example.com', name: 'cookie2', value: 'value2' })
      cookieJar.setCookie({ domain: 'other.com', name: 'cookie3', value: 'value3' })

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(3)
    })

    it('should parse HttpOnly cookies and strip #HttpOnly_ prefix', () => {
      cookieJar = new CookieJar(tempCookieFile)

      // Write HttpOnly cookie directly to file (Netscape format)
      const expiresTime = Math.floor(Date.now() / 1000) + 86400 // 1 day from now
      fs.appendFileSync(
        tempCookieFile,
        `#HttpOnly_.domain.com\tTRUE\t/\tTRUE\t${expiresTime}\tcookieName\tcookieValue\n`
      )

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(1)
      expect(cookies[0].domain).toBe('.domain.com') // Should strip #HttpOnly_ prefix
      expect(cookies[0].name).toBe('cookieName')
      expect(cookies[0].value).toBe('cookieValue')
      expect(cookies[0].includeSubdomains).toBe(true)
      expect(cookies[0].secure).toBe(true)
      expect(cookies[0].path).toBe('/')
    })

    it('should parse both regular and HttpOnly cookies', () => {
      cookieJar = new CookieJar(tempCookieFile)

      // Add a regular cookie
      cookieJar.setCookie({ domain: 'example.com', name: 'regular', value: 'value1' })

      // Add an HttpOnly cookie directly
      const expiresTime = Math.floor(Date.now() / 1000) + 86400
      fs.appendFileSync(
        tempCookieFile,
        `#HttpOnly_.example.com\tTRUE\t/\tFALSE\t${expiresTime}\thttponly\tsecret\n`
      )

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(2)

      const regularCookie = cookies.find(c => c.name === 'regular')
      const httpOnlyCookie = cookies.find(c => c.name === 'httponly')

      expect(regularCookie).toBeDefined()
      expect(regularCookie?.domain).toBe('.example.com')
      expect(httpOnlyCookie).toBeDefined()
      expect(httpOnlyCookie?.domain).toBe('.example.com') // Should strip prefix
      expect(httpOnlyCookie?.value).toBe('secret')
    })
  })

  describe('getCookiesForDomain', () => {
    it('should filter cookies by domain', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({ domain: 'example.com', name: 'cookie1', value: 'value1' })
      cookieJar.setCookie({ domain: 'other.com', name: 'cookie2', value: 'value2' })

      const cookies = cookieJar.getCookiesForDomain('example.com')
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('cookie1')
    })

    it('should include subdomain cookies when includeSubdomains is true', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({
        domain: 'example.com',
        name: 'cookie1',
        value: 'value1',
        includeSubdomains: true,
      })

      const cookies = cookieJar.getCookiesForDomain('sub.example.com')
      expect(cookies).toHaveLength(1)
    })

    it('should exclude expired cookies', () => {
      cookieJar = new CookieJar(tempCookieFile)

      // Add an expired cookie directly to the file
      const expiredTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      fs.appendFileSync(
        tempCookieFile,
        `.example.com\tTRUE\t/\tFALSE\t${expiredTime}\texpired\tvalue\n`
      )

      // Add a valid cookie
      cookieJar.setCookie({ domain: 'example.com', name: 'valid', value: 'value' })

      const cookies = cookieJar.getCookiesForDomain('example.com')
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('valid')
    })

    it('should include HttpOnly cookies when filtering by domain', () => {
      cookieJar = new CookieJar(tempCookieFile)

      // Add HttpOnly cookie directly
      const expiresTime = Math.floor(Date.now() / 1000) + 86400
      fs.appendFileSync(
        tempCookieFile,
        `#HttpOnly_.example.com\tTRUE\t/\tTRUE\t${expiresTime}\thttponly_session\tabc123\n`
      )

      // Add regular cookie
      cookieJar.setCookie({ domain: 'example.com', name: 'regular', value: 'value1' })

      const cookies = cookieJar.getCookiesForDomain('example.com')
      expect(cookies).toHaveLength(2)

      const cookieNames = cookies.map(c => c.name).sort()
      expect(cookieNames).toEqual(['httponly_session', 'regular'])
    })
  })

  describe('deleteCookie', () => {
    it('should delete a cookie by name', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({ domain: 'example.com', name: 'cookie1', value: 'value1' })
      cookieJar.setCookie({ domain: 'example.com', name: 'cookie2', value: 'value2' })

      cookieJar.deleteCookie('cookie1')

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('cookie2')
    })

    it('should delete cookie by name and domain', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({ domain: 'example.com', name: 'cookie', value: 'value1' })
      cookieJar.setCookie({ domain: 'other.com', name: 'cookie', value: 'value2' })

      cookieJar.deleteCookie('cookie', 'example.com')

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(1)
      expect(cookies[0].domain).toBe('.other.com')
    })

    it('should delete HttpOnly cookies correctly', () => {
      cookieJar = new CookieJar(tempCookieFile)

      // Add HttpOnly cookie
      const expiresTime = Math.floor(Date.now() / 1000) + 86400
      fs.appendFileSync(
        tempCookieFile,
        `#HttpOnly_.example.com\tTRUE\t/\tTRUE\t${expiresTime}\thttponly_cookie\tsecret\n`
      )

      // Add regular cookie
      cookieJar.setCookie({ domain: 'example.com', name: 'regular', value: 'value1' })

      // Delete HttpOnly cookie
      cookieJar.deleteCookie('httponly_cookie')

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('regular')
    })
  })

  describe('clear', () => {
    it('should remove all cookies', () => {
      cookieJar = new CookieJar(tempCookieFile)

      cookieJar.setCookie({ domain: 'example.com', name: 'cookie1', value: 'value1' })
      cookieJar.setCookie({ domain: 'example.com', name: 'cookie2', value: 'value2' })

      cookieJar.clear()

      const cookies = cookieJar.getCookies()
      expect(cookies).toHaveLength(0)
    })

    it('should preserve file with header after clear', () => {
      cookieJar = new CookieJar(tempCookieFile)
      cookieJar.setCookie({ domain: 'example.com', name: 'cookie1', value: 'value1' })

      cookieJar.clear()

      expect(fs.existsSync(tempCookieFile)).toBe(true)
      const content = fs.readFileSync(tempCookieFile, 'utf8')
      expect(content).toContain('# Netscape HTTP Cookie File')
    })
  })

  describe('destroy', () => {
    it('should delete temporary cookie file', () => {
      cookieJar = new CookieJar(true)
      const filePath = cookieJar.getFilePath()

      expect(fs.existsSync(filePath)).toBe(true)

      cookieJar.destroy()

      expect(fs.existsSync(filePath)).toBe(false)
      cookieJar = null // Prevent afterEach from trying to destroy again
    })

    it('should not delete custom cookie file', () => {
      cookieJar = new CookieJar(tempCookieFile)
      cookieJar.getFilePath() // Create the file

      cookieJar.destroy()

      expect(fs.existsSync(tempCookieFile)).toBe(true)
      cookieJar = null
    })
  })

  describe('getCookiesRaw', () => {
    it('should return raw file contents', () => {
      cookieJar = new CookieJar(tempCookieFile)
      cookieJar.setCookie({ domain: 'example.com', name: 'test', value: 'value' })

      const raw = cookieJar.getCookiesRaw()

      expect(raw).toContain('# Netscape HTTP Cookie File')
      expect(raw).toContain('.example.com')
      expect(raw).toContain('test')
      expect(raw).toContain('value')
    })
  })
})
