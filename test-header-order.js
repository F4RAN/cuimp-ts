#!/usr/bin/env node

/**
 * Test script to verify header order matches browser
 *
 * Usage:
 *   node test-header-order.js
 */

import { createCuimpHttp } from './dist/index.js'

async function main() {
  console.log('=== Header Order Test ===\n')

  try {
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '136' }
    })

    console.log('Making request with custom Accept header...\n')

    const response = await client.get('https://httpbingo.org/headers', {
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('Status:', response.status)
    console.log('\n=== Headers Received by Server ===\n')

    const sentHeaders = response.data.headers || {}

    // Display all headers in order
    let headerNum = 1
    for (const [key, value] of Object.entries(sentHeaders)) {
      const displayValue = String(value).length > 60
        ? String(value).substring(0, 60) + '...'
        : String(value)

      console.log(`${headerNum}. ${key}: ${displayValue}`)
      headerNum++
    }

    console.log('\n=== Expected Browser Order (Chrome 136) ===\n')
    console.log('1. sec-ch-ua')
    console.log('2. sec-ch-ua-mobile')
    console.log('3. sec-ch-ua-platform')
    console.log('4. upgrade-insecure-requests')
    console.log('5. user-agent')
    console.log('6. accept          <-- Should be here!')
    console.log('7. sec-fetch-site')
    console.log('8. sec-fetch-mode')
    console.log('9. sec-fetch-user')
    console.log('10. sec-fetch-dest')
    console.log('11. accept-encoding')
    console.log('12. accept-language')
    console.log('13. priority')

    // Check if Accept is in correct position (after user-agent)
    const headerKeys = Object.keys(sentHeaders).map(k => k.toLowerCase())
    const acceptIndex = headerKeys.indexOf('accept')
    const userAgentIndex = headerKeys.indexOf('user-agent')

    console.log('\n=== Order Check ===')
    if (acceptIndex > userAgentIndex && acceptIndex < headerKeys.length - 3) {
      console.log('✅ Accept header is in the correct position (after User-Agent)')
    } else if (acceptIndex > headerKeys.length - 3) {
      console.log('❌ Accept header is at the END (wrong position)')
    } else {
      console.log('⚠️  Accept header position unclear')
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

main().catch(console.error)
