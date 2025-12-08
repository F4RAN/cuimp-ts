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
}

test().catch(console.error)