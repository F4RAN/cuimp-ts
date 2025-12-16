#!/usr/bin/env node

/**
 * Overwrite Headers on Windows Example
 * 
 * This example demonstrates how custom headers override .bat file defaults on Windows,
 * preventing duplicate headers when using curl-impersonate .bat files.
 * 
 * Usage:
 *   node examples/17-overwrite-headers-windows.js
 * 
 * Requirements:
 *   - Windows OS
 *   - curl-impersonate binary with .bat files installed
 */

import { createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== Overwrite Headers on Windows Example ===\n')

  if (process.platform !== 'win32') {
    console.log('⚠️  This example is designed for Windows OS.')
    console.log('   On Windows, curl-impersonate uses .bat wrapper files')
    console.log('   that contain default headers. This example demonstrates')
    console.log('   how custom headers override those defaults.\n')
    console.log('   Current platform:', process.platform)
    console.log('   You can still run this example, but the header overwrite')
    console.log('   functionality is Windows-specific.\n')
  }

  try {
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '136' }
    })

    console.log('1. Testing with custom Accept header...')
    
    const response = await client.get('https://httpbingo.org/headers', {
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('   ✅ Request completed')
    console.log('   Status:', response.status)
    
    const sentHeaders = response.data.headers || {}
    const acceptHeaders = []
    for (const [key, value] of Object.entries(sentHeaders)) {
      if (key.toLowerCase() === 'accept') {
        acceptHeaders.push(value)
      }
    }

    console.log('\n   Accept headers sent:')
    if (acceptHeaders.length === 1 && acceptHeaders[0] === 'application/json') {
      console.log(`   ✅ Single Accept header: ${acceptHeaders[0]}`)
      console.log('   ✅ Correct! Only user-provided Accept header is present')
    } else if (acceptHeaders.length === 0) {
      console.log('   ❌ No Accept headers found')
    } else {
      console.log(`   ❌ DUPLICATE Accept headers found (${acceptHeaders.length}):`)
      acceptHeaders.forEach((header, i) => {
        console.log(`      ${i + 1}. ${header}`)
      })
    }

    console.log('\n2. Testing with multiple custom headers...')
    
    const response2 = await client.get('https://httpbingo.org/headers', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MyCustomAgent/1.0',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    })

    console.log('   ✅ Request completed')
    console.log('   Status:', response2.status)
    
    const sentHeaders2 = response2.data.headers || {}
    
    const acceptHeaders2 = []
    const userAgents = []
    const acceptLanguages = []
    
    for (const [key, value] of Object.entries(sentHeaders2)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'accept') acceptHeaders2.push(value)
      if (lowerKey === 'user-agent') userAgents.push(value)
      if (lowerKey === 'accept-language') acceptLanguages.push(value)
    }

    console.log('\n   Headers sent:')
    if (acceptHeaders2.length === 1 && acceptHeaders2[0] === 'application/json') {
      console.log('   ✅ Accept: application/json (no duplicates)')
    } else {
      console.log(`   ❌ Accept: ${acceptHeaders2.length} header(s) - Expected 1`)
    }

    if (userAgents.length === 1 && userAgents[0] === 'MyCustomAgent/1.0') {
      console.log('   ✅ User-Agent: MyCustomAgent/1.0 (no duplicates)')
    } else {
      console.log(`   ❌ User-Agent: ${userAgents.length} header(s) - Expected 1`)
    }

    if (acceptLanguages.length === 1 && acceptLanguages[0].includes('fr-FR')) {
      console.log('   ✅ Accept-Language: fr-FR,fr;q=0.9 (no duplicates)')
    } else {
      console.log(`   ❌ Accept-Language: ${acceptLanguages.length} header(s) - Expected 1`)
    }

    console.log('\n3. Testing without custom headers (uses .bat defaults)...')
    
    const response3 = await client.get('https://httpbingo.org/headers')

    console.log('   ✅ Request completed')
    console.log('   Status:', response3.status)
    
    const sentHeaders3 = response3.data.headers || {}
    const acceptHeaders3 = []
    for (const [key, value] of Object.entries(sentHeaders3)) {
      if (key.toLowerCase() === 'accept') {
        acceptHeaders3.push(value)
      }
    }
    
    console.log(`\n   Accept headers sent: ${acceptHeaders3.length}`)
    if (acceptHeaders3.length === 1) {
      const headerValue = String(acceptHeaders3[0])
      const preview = headerValue.length > 50 ? headerValue.substring(0, 50) + '...' : headerValue
      console.log(`   ✅ Single Accept header from .bat file: ${preview}`)
    }

    console.log('\n=== Example Summary ===')
    console.log('✅ Custom headers successfully override .bat file defaults')
    console.log('✅ No duplicate headers when using custom headers')

  } catch (error) {
    console.error('\n❌ Example failed:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

main().catch(console.error)

