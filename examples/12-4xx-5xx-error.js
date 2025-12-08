#!/usr/bin/env node

import { get } from '../dist/index.js'

async function test() {
  console.log('Testing 4xx/5xx response handling...\n')

  // Test 404
  console.log('1. Testing 404 response...')
  try {
    const response404 = await get('https://httpbin.org/status/404')
    console.log('✅ 404 Response received (not thrown):')
    console.log('   Status:', response404.status)
    console.log('   Status Text:', response404.statusText)
    console.log('   Body:', response404.data)
  } catch (error) {
    console.log('❌ 404 threw error:', error.message)
    if (error.status) {
      console.log('   Status:', error.status)
      console.log('   Body:', error.data)
    }
  }

  console.log()

  // Test 500
  console.log('2. Testing 500 response...')
  try {
    const response500 = await get('https://httpbin.org/status/500')
    console.log('✅ 500 Response received (not thrown):')
    console.log('   Status:', response500.status)
    console.log('   Status Text:', response500.statusText)
    console.log('   Body:', response500.data)
  } catch (error) {
    console.log('❌ 500 threw error:', error.message)
    if (error.status) {
      console.log('   Status:', error.status)
      console.log('   Body:', error.data)
    }
  }

  console.log()

  // Test 400
  console.log('3. Testing 400 response...')
  try {
    const response400 = await get('https://httpbin.org/status/400')
    console.log('✅ 400 Response received (not thrown):')
    console.log('   Status:', response400.status)
    console.log('   Status Text:', response400.statusText)
  } catch (error) {
    console.log('❌ 400 threw error:', error.message)
  }

  console.log()

  // Test successful request (should still work)
  console.log('4. Testing 200 response (should still work)...')
  try {
    const response200 = await get('https://httpbin.org/status/200')
    console.log('✅ 200 Response received:')
    console.log('   Status:', response200.status)
  } catch (error) {
    console.log('❌ Unexpected error:', error.message)
  }

  console.log()

  // Test 404 with actual JSON error body
  console.log('5. Testing 404 with JSON error body...')
  try {
    const { get } = await import('../dist/index.js')
    const errorResponse = await get('https://postman-echo.com/status/404')
    console.log('✅ 404 Response with JSON body:')
    console.log('   Status:', errorResponse.status)
    console.log('   Status Text:', errorResponse.statusText)
    console.log('   Body:', JSON.stringify(errorResponse.data, null, 2))
    console.log('   Content-Type:', errorResponse.headers['content-type'])
  } catch (error) {
    console.log('❌ Error:', error.message)
  }

  console.log()

  // Test 500 with actual JSON error body
  console.log('6. Testing 500 with JSON error body (Postman Echo)...')
  try {
    const { get } = await import('../dist/index.js')
    const errorResponse = await get('https://postman-echo.com/status/500')
    console.log('✅ 500 Response with JSON body:')
    console.log('   Status:', errorResponse.status)
    console.log('   Status Text:', errorResponse.statusText)
    console.log('   Body:', JSON.stringify(errorResponse.data, null, 2))
    console.log('   Headers:', errorResponse.headers['content-type'])
  } catch (error) {
    console.log('❌ Error:', error.message)
  }

  console.log()

  // Test 400 with actual JSON error body (httpbin with message)
  console.log('7. Testing 400 with custom error message (httpbin)...')
  try {
    const { get } = await import('../dist/index.js')
    const errorResponse = await get('https://httpbin.org/status/400?message=Invalid%20request%20parameters')
    console.log('✅ 400 Response with body:')
    console.log('   Status:', errorResponse.status)
    console.log('   Body:', errorResponse.data)
  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

test().catch(console.error)