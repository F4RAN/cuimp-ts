#!/usr/bin/env node

/**
 * HttpOnly Cookies Example
 * 
 * This example demonstrates how cuimp handles HttpOnly cookies in the Netscape cookie format.
 * HttpOnly cookies are marked with a #HttpOnly_ prefix in the domain field.
 * 
 * Run with: node examples/14-httponly-cookies.js
 */

import { createCuimpHttp, CookieJar } from '../dist/index.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

async function main() {
  console.log('=== HttpOnly Cookies Example ===\n')

  // Create a cookie jar with a custom file path
  const cookiePath = path.join(os.tmpdir(), `cuimp-httponly-example-${Date.now()}.txt`)
  const cookieJar = new CookieJar(cookiePath)

  try {
    console.log('1. Creating a cookie jar and adding HttpOnly cookie manually...')
    
    // HttpOnly cookies use the format: #HttpOnly_.domain.com    TRUE    /    TRUE    expires    name    value
    // The #HttpOnly_ prefix indicates the cookie is HttpOnly
    const expiresTime = Math.floor(Date.now() / 1000) + 86400 // 1 day from now
    
    // Write HttpOnly cookie directly to the file (Netscape format)
    fs.appendFileSync(
      cookiePath,
      `#HttpOnly_.example.com\tTRUE\t/\tTRUE\t${expiresTime}\tsession_id\tabc123xyz\n`
    )
    
    console.log('   ✅ HttpOnly cookie written to file')
    console.log('   Format: #HttpOnly_.example.com    TRUE    /    TRUE    <expires>    session_id    abc123xyz')
    console.log()

    console.log('2. Parsing cookies from the jar...')
    const cookies = cookieJar.getCookies()
    
    console.log(`   Found ${cookies.length} cookie(s):`)
    cookies.forEach(cookie => {
      console.log(`   - Name: ${cookie.name}`)
      console.log(`     Value: ${cookie.value}`)
      console.log(`     Domain: ${cookie.domain} (HttpOnly prefix stripped)`)
      console.log(`     Secure: ${cookie.secure}`)
      console.log(`     Path: ${cookie.path}`)
      console.log()
    })

    console.log('3. Creating HTTP client with cookie jar...')
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '136' },
      cookieJar: cookiePath
    })
    
    console.log('   ✅ Client created with HttpOnly cookie support')
    console.log()

    console.log('4. HttpOnly cookies are automatically sent with requests!')
    console.log('   The cookie jar will include HttpOnly cookies when making HTTP requests.')
    console.log('   Note: curl-impersonate handles the cookie file format automatically.')
    console.log()

    // Clean up
    console.log('5. Cleaning up...')
    cookieJar.destroy()
    client.destroy()
    console.log('   ✅ Done')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    cookieJar.destroy()
  }
}

async function exampleWithExistingCookieFile() {
  console.log('\n=== Example: Loading Existing Cookie File with HttpOnly Cookies ===\n')

  // Create a sample cookie file with both regular and HttpOnly cookies
  const cookiePath = path.join(os.tmpdir(), `cuimp-mixed-cookies-${Date.now()}.txt`)
  
  // Write Netscape header
  fs.writeFileSync(
    cookiePath,
    '# Netscape HTTP Cookie File\n# https://curl.se/docs/http-cookies.html\n\n'
  )

  const expiresTime = Math.floor(Date.now() / 1000) + 86400

  // Add regular cookie
  fs.appendFileSync(
    cookiePath,
    `.example.com\tTRUE\t/\tFALSE\t${expiresTime}\tregular_cookie\tvalue123\n`
  )

  // Add HttpOnly cookie
  fs.appendFileSync(
    cookiePath,
    `#HttpOnly_.example.com\tTRUE\t/\tTRUE\t${expiresTime}\thttponly_session\tsecret456\n`
  )

  console.log('1. Created cookie file with mixed cookies:')
  console.log('   - Regular cookie: regular_cookie')
  console.log('   - HttpOnly cookie: httponly_session')
  console.log()

  const cookieJar = new CookieJar(cookiePath)

  console.log('2. Parsing all cookies...')
  const allCookies = cookieJar.getCookies()
  console.log(`   Found ${allCookies.length} cookie(s):`)
  
  // Check raw file to see which cookies are HttpOnly
  const rawContent = cookieJar.getCookiesRaw()
  const httpOnlyCookies = new Set()
  rawContent.split('\n').forEach(line => {
    if (line.startsWith('#HttpOnly_')) {
      const parts = line.split('\t')
      if (parts.length >= 7) {
        httpOnlyCookies.add(parts[5]) // Cookie name
      }
    }
  })
  
  allCookies.forEach(cookie => {
    const type = httpOnlyCookies.has(cookie.name) ? 'HttpOnly' : 'Regular'
    console.log(`   - ${cookie.name} (${type}): ${cookie.value}`)
    console.log(`     Domain: ${cookie.domain}`)
  })
  console.log()

  console.log('3. Filtering cookies for example.com domain...')
  const domainCookies = cookieJar.getCookiesForDomain('example.com')
  console.log(`   Found ${domainCookies.length} cookie(s) for example.com:`)
  domainCookies.forEach(cookie => {
    console.log(`   - ${cookie.name}: ${cookie.value}`)
  })
  console.log()

  console.log('4. Both regular and HttpOnly cookies are accessible!')
  console.log('   ✅ HttpOnly cookies are no longer skipped')
  
  // Clean up
  cookieJar.destroy()
  if (fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath)
  }
}

// Run examples
main()
  .then(() => exampleWithExistingCookieFile())
  .then(() => {
    console.log('\n=== All Examples Complete ===')
  })
  .catch(console.error)
