#!/usr/bin/env node

/**
 * Browser Impersonation Example
 * 
 * This example demonstrates how to impersonate different browsers.
 * Run with: node examples/02-browser-impersonation.js
 */

import { createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== Browser Impersonation Example ===\n')

  const browsers = [
    { browser: 'chrome', version: '123' },
    { browser: 'firefox', version: '133' },
    { browser: 'edge', version: '101' },
    { browser: 'safari', version: '153' }
  ]

  for (const descriptor of browsers) {
    try {
      console.log(`Testing with ${descriptor.browser} ${descriptor.version}...`)
      
      const client = createCuimpHttp({ descriptor })
      const response = await client.get('https://httpbin.org/headers', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })

      // Extract User-Agent from response
      const userAgent = response.data.headers?.['User-Agent'] || 
                       response.data.headers?.['user-agent'] || 
                       'Not found'
      
      console.log(`  ✅ Status: ${response.status}`)
      console.log(`  User-Agent: ${userAgent.substring(0, 60)}...`)
      console.log()
    } catch (error) {
      console.error(`  ❌ Error with ${descriptor.browser}:`, error.message)
      console.log()
    }
  }

  console.log('✅ Browser impersonation test completed!')
}

main()

