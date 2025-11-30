#!/usr/bin/env node

/**
 * HTTP Client Instance Example
 * 
 * This example demonstrates using a reusable HTTP client instance
 * with default configuration.
 * Run with: node examples/03-http-client.js
 */

import { createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== HTTP Client Instance Example ===\n')

  // Create a client with default configuration
  const client = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '123' }
  })

  // Helper function to add default headers to requests
  const defaultHeaders = {
    'X-Custom-Header': 'cuimp-example',
    'Accept': 'application/json'
  }

  try {
    // Make multiple requests using the same client
    console.log('1. Making GET request with default headers...')
    const response1 = await client.get('https://httpbin.org/headers', {
      headers: defaultHeaders
    })
    console.log('   Status:', response1.status)
    console.log('   Custom header sent:', 
      response1.data.headers?.['X-Custom-Header'] || 
      response1.data.headers?.['x-custom-header'] || 
      'Not found')
    console.log()

    // Override headers for a specific request
    console.log('2. Making GET request with overridden headers...')
    const response2 = await client.get('https://httpbin.org/headers', {
      headers: {
        'X-Custom-Header': 'overridden-value',
        'X-Request-ID': '12345'
      }
    })
    console.log('   Status:', response2.status)
    console.log('   Overridden header:', 
      response2.data.headers?.['X-Custom-Header'] || 
      response2.data.headers?.['x-custom-header'] || 
      'Not found')
    console.log('   Request ID:', 
      response2.data.headers?.['X-Request-ID'] || 
      response2.data.headers?.['x-request-id'] || 
      'Not found')
    console.log()

    // POST request
    console.log('3. Making POST request...')
    const response3 = await client.post('https://httpbin.org/post', {
      message: 'Hello from HTTP client!',
      timestamp: new Date().toISOString()
    })
    console.log('   Status:', response3.status)
    console.log('   Posted data:', JSON.stringify(response3.data.json, null, 2))
    console.log()

    console.log('✅ HTTP client example completed!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    process.exit(1)
  }
}

main()

