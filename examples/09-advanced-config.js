#!/usr/bin/env node

/**
 * Advanced Configuration Example
 * 
 * This example demonstrates advanced configuration options
 * like timeouts, redirects, and custom curl arguments.
 * Run with: node examples/09-advanced-config.js
 */

import { request, createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== Advanced Configuration Example ===\n')

  try {
    // Example 1: Custom timeout
    console.log('1. Request with custom timeout...')
    const response1 = await request({
      url: 'https://httpbin.org/delay/2',
      timeout: 5000 // 5 seconds
    })
    console.log('   ✅ Status:', response1.status)
    console.log('   Completed within timeout')
    console.log()

    // Example 2: Max redirects
    console.log('2. Request with redirect following...')
    const response2 = await request({
      url: 'https://httpbin.org/redirect/3',
      maxRedirects: 5
    })
    console.log('   ✅ Status:', response2.status)
    console.log('   Final URL:', response2.request.url)
    console.log()

    // Example 3: Custom headers and data
    console.log('3. Request with custom configuration...')
    const response3 = await request({
      url: 'https://httpbin.org/anything',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value',
        'Content-Type': 'application/json'
      },
      data: {
        message: 'Advanced configuration example',
        timestamp: Date.now()
      },
      timeout: 10000
    })
    console.log('   ✅ Status:', response3.status)
    console.log('   Method:', response3.data.method)
    console.log('   Headers sent:', Object.keys(response3.data.headers || {}).length)
    console.log('   Data received:', JSON.stringify(response3.data.json, null, 2))
    console.log()

    // Example 4: Using HTTP client with defaults
    console.log('4. HTTP client with default configuration...')
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '123' }
    })
    
    // Set default timeout
    // Note: timeout is per-request, but we can set it in defaults if supported
    
    const response4 = await client.get('https://httpbin.org/get', {
      headers: {
        'X-Client-Header': 'from-client-instance'
      }
    })
    console.log('   ✅ Status:', response4.status)
    console.log('   Client header sent:', 
      response4.data.headers?.['X-Client-Header'] || 
      response4.data.headers?.['x-client-header'] || 
      'Not found')
    console.log()

    // Example 5: Request cancellation with AbortSignal
    console.log('5. Request cancellation example...')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000)
    
    try {
      await request({
        url: 'https://httpbin.org/delay/5',
        signal: controller.signal
      })
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request aborted') {
        console.log('   ✅ Request cancelled as expected')
      } else {
        throw error
      }
    } finally {
      clearTimeout(timeoutId)
    }
    console.log()

    console.log('✅ Advanced configuration example completed!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    if (error.code) {
      console.error('Error Code:', error.code)
    }
    process.exit(1)
  }
}

main()

