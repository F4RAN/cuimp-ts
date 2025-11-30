#!/usr/bin/env node

/**
 * All HTTP Methods Example
 * 
 * This example demonstrates all available HTTP methods.
 * Run with: node examples/04-all-methods.js
 */

import { get, post, put, patch, del, head, options } from '../dist/index.js'

async function main() {
  console.log('=== All HTTP Methods Example ===\n')

  const baseUrl = 'https://httpbin.org'

  try {
    // GET
    console.log('1. GET request...')
    const getResponse = await get(`${baseUrl}/get`)
    console.log(`   ✅ Status: ${getResponse.status}`)
    console.log()

    // POST
    console.log('2. POST request...')
    const postResponse = await post(`${baseUrl}/post`, { method: 'POST', data: 'test' })
    console.log(`   ✅ Status: ${postResponse.status}`)
    console.log()

    // PUT
    console.log('3. PUT request...')
    const putResponse = await put(`${baseUrl}/put`, { method: 'PUT', data: 'test' })
    console.log(`   ✅ Status: ${putResponse.status}`)
    console.log()

    // PATCH
    console.log('4. PATCH request...')
    const patchResponse = await patch(`${baseUrl}/patch`, { method: 'PATCH', data: 'test' })
    console.log(`   ✅ Status: ${patchResponse.status}`)
    console.log()

    // DELETE
    console.log('5. DELETE request...')
    const delResponse = await del(`${baseUrl}/delete`)
    console.log(`   ✅ Status: ${delResponse.status}`)
    console.log()

    // HEAD
    console.log('6. HEAD request...')
    try {
      const headResponse = await head(`${baseUrl}/get`)
      console.log(`   ✅ Status: ${headResponse.status}`)
      console.log(`   Headers: ${Object.keys(headResponse.headers).length} headers received`)
    } catch (error) {
      // HEAD requests with -X HEAD can sometimes cause curl warnings/errors
      // but the request may still succeed
      if (error.code === 'PARTIAL_FILE' || error.message.includes('HEAD')) {
        console.log(`   ⚠️  HEAD request completed with warning (curl limitation with -X HEAD)`)
        console.log(`   Note: Consider using GET with Range header for similar functionality`)
      } else {
        throw error
      }
    }
    console.log()

    // OPTIONS
    console.log('7. OPTIONS request...')
    const optionsResponse = await options(`${baseUrl}/get`)
    console.log(`   ✅ Status: ${optionsResponse.status}`)
    console.log()

    console.log('✅ All HTTP methods tested successfully!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    process.exit(1)
  }
}

main()

