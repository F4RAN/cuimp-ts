#!/usr/bin/env node

/**
 * Manual test script for .bat file header filtering fix
 * 
 * This script tests that duplicate Accept headers are removed when using .bat files on Windows.
 * 
 * Usage:
 *   node test-bat-fix.js
 * 
 * Requirements:
 *   - Windows OS
 *   - curl-impersonate binary with .bat files installed
 */

import { createCuimpHttp } from './dist/index.js'

async function testBatFileHeaderFix() {
  console.log('=== Testing .bat File Header Filtering Fix ===\n')

  try {
    // Create a client with Chrome impersonation (will use .bat file on Windows)
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '136' }
    })

    console.log('1. Testing with custom Accept header (should NOT have duplicates)...')
    
    // Make a request with custom Accept header
    // This should NOT result in duplicate Accept headers
    const response = await client.get('https://httpbin.org/headers', {
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('   ✅ Request completed')
    console.log('   Status:', response.status)
    
    // Check the headers that were sent
    const sentHeaders = response.data.headers || {}
    
    // Find Accept header(s) in the response
    const acceptHeaders = []
    for (const [key, value] of Object.entries(sentHeaders)) {
      if (key.toLowerCase() === 'accept') {
        acceptHeaders.push(value)
      }
    }

    console.log('\n   📋 Accept headers sent:')
    if (acceptHeaders.length === 0) {
      console.log('   ⚠️  No Accept header found in response')
    } else if (acceptHeaders.length === 1) {
      console.log(`   ✅ Single Accept header: ${acceptHeaders[0]}`)
      if (acceptHeaders[0] === 'application/json') {
        console.log('   ✅ Correct! Only user-provided Accept header is present')
      } else {
        console.log('   ⚠️  Accept header value is not "application/json"')
      }
    } else {
      console.log(`   ❌ DUPLICATE Accept headers found (${acceptHeaders.length}):`)
      acceptHeaders.forEach((header, i) => {
        console.log(`      ${i + 1}. ${header}`)
      })
      console.log('   ❌ This indicates the fix is NOT working!')
    }

    console.log('\n2. Testing with multiple custom headers...')
    
    const response2 = await client.get('https://httpbin.org/headers', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MyCustomAgent/1.0',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    })

    console.log('   ✅ Request completed')
    console.log('   Status:', response2.status)
    
    const sentHeaders2 = response2.data.headers || {}
    
    // Check Accept header
    const acceptHeaders2 = []
    for (const [key, value] of Object.entries(sentHeaders2)) {
      if (key.toLowerCase() === 'accept') {
        acceptHeaders2.push(value)
      }
    }
    
    // Check User-Agent
    const userAgents = []
    for (const [key, value] of Object.entries(sentHeaders2)) {
      if (key.toLowerCase() === 'user-agent') {
        userAgents.push(value)
      }
    }
    
    // Check Accept-Language
    const acceptLanguages = []
    for (const [key, value] of Object.entries(sentHeaders2)) {
      if (key.toLowerCase() === 'accept-language') {
        acceptLanguages.push(value)
      }
    }

    console.log('\n   📋 Headers sent:')
    console.log(`   Accept: ${acceptHeaders2.length} header(s)`)
    if (acceptHeaders2.length === 1 && acceptHeaders2[0] === 'application/json') {
      console.log('   ✅ Accept header correct (no duplicates)')
    } else {
      console.log('   ❌ Accept header issue:', acceptHeaders2)
    }
    
    console.log(`   User-Agent: ${userAgents.length} header(s)`)
    if (userAgents.length === 1 && userAgents[0] === 'MyCustomAgent/1.0') {
      console.log('   ✅ User-Agent header correct (no duplicates)')
    } else {
      console.log('   ❌ User-Agent header issue:', userAgents)
    }
    
    console.log(`   Accept-Language: ${acceptLanguages.length} header(s)`)
    if (acceptLanguages.length === 1 && acceptLanguages[0].includes('fr-FR')) {
      console.log('   ✅ Accept-Language header correct (no duplicates)')
    } else {
      console.log('   ❌ Accept-Language header issue:', acceptLanguages)
    }

    console.log('\n3. Testing without custom headers (should use .bat defaults)...')
    
    const response3 = await client.get('https://httpbin.org/headers', {
      // No custom headers
    })

    console.log('   ✅ Request completed')
    console.log('   Status:', response3.status)
    
    const sentHeaders3 = response3.data.headers || {}
    const acceptHeaders3 = []
    for (const [key, value] of Object.entries(sentHeaders3)) {
      if (key.toLowerCase() === 'accept') {
        acceptHeaders3.push(value)
      }
    }
    
    console.log(`\n   📋 Accept headers sent: ${acceptHeaders3.length}`)
    if (acceptHeaders3.length === 1) {
      console.log(`   ✅ Single Accept header from .bat file: ${acceptHeaders3[0].substring(0, 50)}...`)
    } else {
      console.log('   ⚠️  Unexpected number of Accept headers:', acceptHeaders3.length)
    }

    console.log('\n=== Test Summary ===')
    console.log('✅ All tests completed!')
    console.log('\nIf you see duplicate headers, the fix is not working.')
    console.log('If you see single headers matching your custom values, the fix is working!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testBatFileHeaderFix().catch(console.error)

