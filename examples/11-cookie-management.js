#!/usr/bin/env node

/**
 * Cookie Management Example
 * 
 * This example demonstrates automatic cookie management with cuimp.
 * Cookies are automatically stored and sent with subsequent requests.
 * Run with: node examples/11-cookie-management.js
 */

import { createCuimpHttp } from '../dist/index.js'
import os from 'os'
import path from 'path'

async function main() {
  console.log('=== Cookie Management Example ===\n')

  // Create a client with automatic cookie management enabled
  const client = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '136' },
    cookieJar: true  // Enable automatic cookie management
  })

  try {
    // Example 1: Make a request that sets cookies
    console.log('1. Making request to httpbin.org/cookies/set...')
    const response1 = await client.get('https://httpbin.org/cookies/set/session_id/abc123')
    console.log('   ✅ Status:', response1.status)
    console.log('   Response shows cookies:', JSON.stringify(response1.data?.cookies || {}, null, 2))
    console.log()

    // Example 2: Cookies are automatically sent in subsequent requests
    console.log('2. Making another request - cookies should be sent automatically...')
    const response2 = await client.get('https://httpbin.org/cookies')
    console.log('   ✅ Status:', response2.status)
    console.log('   Cookies received by server:', JSON.stringify(response2.data?.cookies || {}, null, 2))
    console.log()

    // Example 3: Set another cookie
    console.log('3. Setting another cookie...')
    const response3 = await client.get('https://httpbin.org/cookies/set/user_id/user456')
    console.log('   ✅ Status:', response3.status)
    console.log()

    // Example 4: Verify all cookies are sent
    console.log('4. Verifying all cookies are sent...')
    const response4 = await client.get('https://httpbin.org/cookies')
    console.log('   ✅ Status:', response4.status)
    console.log('   All cookies:', JSON.stringify(response4.data?.cookies || {}, null, 2))
    console.log()

    // Example 5: Access the cookie jar directly
    console.log('5. Accessing cookie jar directly...')
    const cookieJar = client.getCookieJar()
    if (cookieJar) {
      const cookies = cookieJar.getCookies()
      console.log('   Cookies in jar:', cookies.length)
      cookies.forEach(cookie => {
        console.log(`   - ${cookie.name}: ${cookie.value} (domain: ${cookie.domain})`)
      })
    }
    console.log()

    // Example 6: Manually set a cookie
    console.log('6. Manually setting a cookie...')
    if (cookieJar) {
      cookieJar.setCookie({
        domain: 'httpbin.org',
        name: 'manual_cookie',
        value: 'manually_set_value',
        path: '/'
      })
      console.log('   ✅ Cookie set manually')
    }

    // Verify manual cookie is sent
    const response5 = await client.get('https://httpbin.org/cookies')
    console.log('   Cookies now:', JSON.stringify(response5.data?.cookies || {}, null, 2))
    console.log()

    // Example 7: Clear all cookies
    console.log('7. Clearing all cookies...')
    client.clearCookies()
    const response6 = await client.get('https://httpbin.org/cookies')
    console.log('   ✅ Cookies after clear:', JSON.stringify(response6.data?.cookies || {}, null, 2))
    console.log()

    // Example 8: Clean up
    console.log('8. Destroying client (cleans up temp cookie file)...')
    client.destroy()
    console.log('   ✅ Client destroyed')

  } catch (error) {
    console.error('❌ Error:', error.message)
    // Clean up on error
    client.destroy()
  }
}

// Example with custom cookie file path
async function customCookieFileExample() {
  console.log('\n=== Custom Cookie File Example ===\n')

  // Better: Use user home directory (consistent with binary storage)
  // This is more secure and won't pollute your project directory
  const cookiePath = path.join(os.homedir(), '.cuimp', 'cookies', 'my-cookies.txt')
  
  const client = createCuimpHttp({
    descriptor: { browser: 'chrome' },
    cookieJar: cookiePath  // User-specific, secure location
  })

  try {
    console.log('1. Setting cookies with custom file...')
    await client.get('https://httpbin.org/cookies/set/persistent/cookie_value')
    
    console.log('2. Verifying cookies...')
    const response = await client.get('https://httpbin.org/cookies')
    console.log('   Cookies:', JSON.stringify(response.data?.cookies || {}, null, 2))
    
    console.log(`\n   💡 Note: Cookies are saved to ${cookiePath}`)
    console.log('   They will persist between runs and are user-specific!')
    console.log('   ✅ This location is secure and won\'t be committed to git')
    
    // Don't destroy - keep the cookie file for next run
    console.log('\n   ✅ Done (cookie file preserved)')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run examples
main()
  .then(() => customCookieFileExample())
  .then(() => {
    console.log('\n=== All Examples Complete ===')
  })
  .catch(console.error)

