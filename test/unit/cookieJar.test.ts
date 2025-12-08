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
