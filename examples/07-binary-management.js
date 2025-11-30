#!/usr/bin/env node

/**
 * Binary Management Example
 * 
 * This example demonstrates how to download and manage curl-impersonate binaries.
 * Run with: node examples/07-binary-management.js
 */

import { Cuimp, downloadBinary } from '../dist/index.js'

async function main() {
  console.log('=== Binary Management Example ===\n')

  try {
    // Method 1: Using downloadBinary convenience function
    console.log('1. Downloading binary using convenience function...')
    const binaryInfo1 = await downloadBinary({
      descriptor: { browser: 'chrome', version: '123' }
    })
    console.log('   ✅ Binary downloaded:')
    console.log(`      Path: ${binaryInfo1.binaryPath}`)
    console.log(`      Version: ${binaryInfo1.version || 'N/A'}`)
    console.log(`      Downloaded: ${binaryInfo1.isDownloaded ? 'Yes' : 'No'}`)
    console.log()

    // Method 2: Using Cuimp class
    console.log('2. Verifying binary using Cuimp class...')
    const cuimp = new Cuimp({
      descriptor: { browser: 'chrome', version: '123' }
    })
    const binaryInfo2 = await cuimp.verifyBinary()
    console.log('   ✅ Binary verified:')
    console.log(`      Path: ${binaryInfo2.binaryPath}`)
    console.log(`      Version: ${binaryInfo2.version || 'N/A'}`)
    console.log()

    // Method 3: Preview command without executing
    console.log('3. Building command preview...')
    const command = await cuimp.buildCommandPreview('https://example.com', 'GET')
    console.log('   Command preview:')
    console.log(`   ${command.substring(0, 100)}...`)
    console.log()

    // Method 4: Download multiple browser binaries
    console.log('4. Downloading multiple browser binaries...')
    const browsers = [
      { browser: 'chrome', version: '123' },
      { browser: 'firefox', version: '133' }
    ]

    for (const descriptor of browsers) {
      try {
        const info = await downloadBinary({ descriptor })
        console.log(`   ✅ ${descriptor.browser} ${descriptor.version}: ${info.binaryPath}`)
      } catch (error) {
        console.log(`   ⚠️  ${descriptor.browser} ${descriptor.version}: ${error.message}`)
      }
    }
    console.log()

    console.log('✅ Binary management example completed!')
    console.log()
    console.log('Note: Binaries are cached and reused between requests.')
    console.log('      Use forceDownload: true to bypass cache.')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.code) {
      console.error('Error Code:', error.code)
    }
    process.exit(1)
  }
}

main()

