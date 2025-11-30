#!/usr/bin/env node

/**
 * Error Handling Example
 * 
 * This example demonstrates proper error handling with cuimp.
 * Run with: node examples/06-error-handling.js
 */

import { get, request } from '../dist/index.js'

async function main() {
  console.log('=== Error Handling Example ===\n')

  // Example 1: HTTP error (404)
  console.log('1. Handling HTTP 404 error...')
  try {
    await get('https://httpbin.org/status/404')
  } catch (error) {
    console.log(`   ✅ Caught error: ${error.message}`)
    if (error.status) {
      console.log(`   HTTP Status: ${error.status}`)
      console.log(`   Status Text: ${error.statusText}`)
    }
  }
  console.log()

  // Example 2: HTTP error (500)
  console.log('2. Handling HTTP 500 error...')
  try {
    await get('https://httpbin.org/status/500')
  } catch (error) {
    console.log(`   ✅ Caught error: ${error.message}`)
    if (error.status) {
      console.log(`   HTTP Status: ${error.status}`)
    }
  }
  console.log()

  // Example 3: Network error (invalid domain)
  console.log('3. Handling network error (invalid domain)...')
  try {
    await get('https://this-domain-does-not-exist-12345.com')
  } catch (error) {
    console.log(`   ✅ Caught error: ${error.message}`)
    if (error.code) {
      console.log(`   Error Code: ${error.code}`)
    }
  }
  console.log()

  // Example 4: Timeout error
  console.log('4. Handling timeout error...')
  try {
    await request({
      url: 'https://httpbin.org/delay/10',
      timeout: 2000 // 2 second timeout
    })
  } catch (error) {
    console.log(`   ✅ Caught error: ${error.message}`)
    if (error.code) {
      console.log(`   Error Code: ${error.code}`)
    }
  }
  console.log()

  // Example 5: Successful request with error checking
  console.log('5. Successful request with proper error checking...')
  try {
    const response = await get('https://httpbin.org/status/200')
    console.log(`   ✅ Request successful: ${response.status}`)
    console.log(`   Status Text: ${response.statusText}`)
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error.message}`)
  }
  console.log()

  console.log('✅ Error handling example completed!')
}

main()

