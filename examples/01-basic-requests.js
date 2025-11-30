#!/usr/bin/env node

/**
 * Basic HTTP Requests Example
 * 
 * This example demonstrates basic GET and POST requests using cuimp.
 * Run with: node examples/01-basic-requests.js
 */

import { get, post } from '../dist/index.js'

async function main() {
  console.log('=== Basic HTTP Requests Example ===\n')

  try {
    // GET request
    console.log('1. Making a GET request to httpbin.org/headers...')
    const getResponse = await get('https://httpbin.org/headers')
    console.log('Status:', getResponse.status)
    console.log('Headers received:', Object.keys(getResponse.headers).length, 'headers')
    console.log('Response data keys:', Object.keys(getResponse.data.headers || {}).slice(0, 5).join(', '), '...')
    console.log()

    // POST request with JSON data
    console.log('2. Making a POST request with JSON data...')
    const postData = {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello from cuimp!'
    }
    const postResponse = await post('https://httpbin.org/post', postData)
    console.log('Status:', postResponse.status)
    console.log('Posted data:', JSON.stringify(postResponse.data.json, null, 2))
    console.log()

    // GET request with query parameters (via URL)
    console.log('3. Making a GET request with query parameters...')
    const queryResponse = await get('https://httpbin.org/get?foo=bar&baz=qux')
    console.log('Status:', queryResponse.status)
    console.log('Query params:', JSON.stringify(queryResponse.data.args, null, 2))
    console.log()

    console.log('✅ All requests completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    process.exit(1)
  }
}

main()

