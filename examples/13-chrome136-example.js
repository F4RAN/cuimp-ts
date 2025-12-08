#!/usr/bin/env node

/**
 * Chrome 136 Impersonation Example
 * 
 * This example demonstrates how to use cuimp with Chrome 136 browser impersonation.
 * Run with: node examples/13-chrome136-example.js
 */

import { createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== Chrome 136 Impersonation Example ===\n')

  // Create HTTP client with Chrome 136 impersonation
  const client = createCuimpHttp({
    descriptor: {
      browser: 'chrome',
      version: '136'
    }
  })

  try {
    // Example 1: Get request headers to verify impersonation
    console.log('1. Verifying Chrome 136 User-Agent...')
    const headersResponse = await client.get('https://httpbin.org/headers')
    
    const userAgent = headersResponse.data.headers?.['User-Agent'] || 
                     headersResponse.data.headers?.['user-agent'] || 
                     'Not found'
    
    console.log(`   ✅ Status: ${headersResponse.status}`)
    console.log(`   User-Agent: ${userAgent}`)
    console.log()

    // Example 2: Make a GET request
    console.log('2. Making GET request with Chrome 136...')
    const getResponse = await client.get('https://httpbin.org/get', {
      params: {
        test: 'chrome136',
        version: '1.6.0'
      }
    })
    console.log(`   ✅ Status: ${getResponse.status}`)
    console.log(`   URL: ${getResponse.data.url}`)
    console.log(`   Args: ${JSON.stringify(getResponse.data.args)}`)
    console.log()

    // Example 3: POST request with JSON data
    console.log('3. Making POST request with JSON data...')
    const postResponse = await client.post('https://httpbin.org/post', {
      name: 'Chrome 136 Test',
      browser: 'chrome',
      version: '136',
      timestamp: new Date().toISOString()
    })
    console.log(`   ✅ Status: ${postResponse.status}`)
    console.log(`   Response data: ${JSON.stringify(postResponse.data.json, null, 2)}`)
    console.log()

    // Example 4: Handle 4xx/5xx errors (new in v1.6.0)
    console.log('4. Testing error handling with Chrome 136...')
    const errorResponse = await client.get('https://httpbin.org/status/404')
    console.log(`   ✅ Status: ${errorResponse.status} (not thrown!)`)
    console.log(`   Status Text: ${errorResponse.statusText}`)
    console.log(`   Body: ${errorResponse.data}`)
    console.log()

    // Example 5: Access response headers
    console.log('5. Inspecting response headers...')
    const headersTest = await client.get('https://httpbin.org/response-headers', {
      params: {
        'X-Custom-Header': 'Chrome136-Example'
      }
    })
    console.log(`   ✅ Status: ${headersTest.status}`)
    console.log(`   Content-Type: ${headersTest.headers['content-type']}`)
    console.log(`   Custom Header: ${headersTest.data['X-Custom-Header']}`)
    console.log()

    // Example 6: Using custom headers
    console.log('6. Making request with custom headers...')
    const customHeadersResponse = await client.get('https://httpbin.org/headers', {
      headers: {
        'X-Requested-With': 'Chrome136-Client',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    console.log(`   ✅ Status: ${customHeadersResponse.status}`)
    console.log(`   Request Headers:`)
    const reqHeaders = customHeadersResponse.data.headers || {}
    console.log(`     X-Requested-With: ${reqHeaders['X-Requested-With']}`)
    console.log(`     Accept: ${reqHeaders['Accept']}`)
    console.log(`     Accept-Language: ${reqHeaders['Accept-Language']}`)
    console.log()

    console.log('✅ All Chrome 136 examples completed successfully!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.code) {
      console.error(`   Exit Code: ${error.code}`)
    }
  } finally {
    // Clean up resources
    client.destroy()
  }
}

main().catch(console.error)