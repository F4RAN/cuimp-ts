#!/usr/bin/env node

/**
 * Test script for .bat file parsing logic (works on any OS)
 * 
 * This tests the parsing and header filtering logic without requiring Windows.
 * It directly tests the helper functions that parse .bat files.
 * 
 * Usage:
 *   node test-bat-parsing.js
 */

import fs from 'fs'
import path from 'path'

// Import the parsing functions (we'll need to export them or test them indirectly)
// Since they're not exported, we'll recreate the logic here for testing

/**
 * Test version of parseBatArguments - same logic as in runner.ts
 */
function parseBatArguments(line) {
  const args = []
  let i = 0
  let currentArg = ''
  let inQuotes = false
  let quoteChar = ''

  while (i < line.length) {
    const char = line[i]

    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
        currentArg += char
      } else if (char === quoteChar) {
        inQuotes = false
        currentArg += char
        quoteChar = ''
      } else {
        currentArg += char
      }
    } else if (char === ' ' && !inQuotes) {
      if (currentArg.trim()) {
        args.push(currentArg.trim())
        currentArg = ''
      }
    } else {
      currentArg += char
    }
    i++
  }

  if (currentArg.trim()) {
    args.push(currentArg.trim())
  }

  return args
}

/**
 * Test version of parseBatFile - same logic as in runner.ts
 */
function parseBatFile(batFilePath) {
  const content = fs.readFileSync(batFilePath, 'utf8')
  const lines = content.split(/\r?\n/)

  const args = []
  let inCurlCommand = false
  let currentLine = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith('::') || trimmed.startsWith('@') || !trimmed) {
      continue
    }

    // Check if this line starts the curl.exe command
    if (trimmed.includes('curl.exe') || trimmed.includes('"%~dp0curl.exe"')) {
      inCurlCommand = true
      // Extract everything after curl.exe
      const afterCurl = trimmed.replace(/.*?"%~dp0curl\.exe"|.*?curl\.exe/, '').trim()
      if (afterCurl) {
        currentLine = afterCurl
      }
      continue
    }

    // If we're in the curl command section
    if (inCurlCommand) {
      // Check for line continuation (^ at end of line)
      const hasContinuation = trimmed.endsWith('^')
      const lineContent = hasContinuation ? trimmed.slice(0, -1).trim() : trimmed

      if (lineContent) {
        currentLine += (currentLine ? ' ' : '') + lineContent
      }

      // If no continuation, process the accumulated line
      if (!hasContinuation) {
        if (currentLine) {
          const extractedArgs = parseBatArguments(currentLine)
          args.push(...extractedArgs)
          currentLine = ''
        }

        // Check if we hit %* (end of bat arguments)
        if (trimmed.includes('%*')) {
          break
        }
      }
    }
  }

  return args
}

/**
 * Test version of extractHeaderNamesFromArgs
 */
function extractHeaderNamesFromArgs(args) {
  const headerNames = new Set()
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    // Check if this is a header flag
    if (arg === '-H' && i + 1 < args.length) {
      const headerValue = args[i + 1]
      // Extract header name (case-insensitive)
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
      i += 2
      continue
    }

    // Check if it's a combined -H "Header: value" format
    if (arg.startsWith('-H')) {
      const headerMatch = arg.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        headerNames.add(headerName)
      }
    }

    i++
  }

  return headerNames
}

/**
 * Test version of filterConflictingHeaders
 */
function filterConflictingHeaders(batArgs, userHeaderNames) {
  const filtered = []
  let i = 0

  while (i < batArgs.length) {
    const arg = batArgs[i]

    // Check if this is a header flag
    if (arg === '-H' && i + 1 < batArgs.length) {
      const headerValue = batArgs[i + 1]
      // Extract header name (case-insensitive)
      const headerMatch = headerValue.match(/^["']?([^:]+):/i)

      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()

        // If user provided this header, skip it (remove from .bat)
        if (userHeaderNames.has(headerName)) {
          i += 2 // Skip both -H and the header value
          continue
        }
      }

      // Keep this header
      filtered.push(arg)
      i++
      continue
    }

    // Check if it's a combined -H "Header: value" format
    if (arg.startsWith('-H')) {
      const headerMatch = arg.match(/^["']?([^:]+):/i)
      if (headerMatch) {
        const headerName = headerMatch[1].trim().toLowerCase()
        // If user provided this header, skip it
        if (userHeaderNames.has(headerName)) {
          i++
          continue
        }
      }
    }

    filtered.push(arg)
    i++
  }

  return filtered
}

async function testBatParsing() {
  console.log('=== Testing .bat File Parsing Logic ===\n')

  // Test with the actual .bat file if it exists
  const batFilePath = path.join(
    process.cwd(),
    'curl_chrome136.bat'
  )

  if (!fs.existsSync(batFilePath)) {
    console.log('⚠️  curl_chrome136.bat not found in current directory')
    console.log('   Creating a test .bat file...\n')
    
    // Create a test .bat file
    const testBatContent = `@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384" ^
    --curves X25519:P-256 ^
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" ^
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" ^
    -H "Accept-Language: en-US,en;q=0.9" ^
    --http2 ^
    --tls-grease ^
    %*`

    fs.writeFileSync(batFilePath, testBatContent)
    console.log('✅ Created test .bat file\n')
  }

  try {
    console.log('1. Testing .bat file parsing...')
    const batArgs = parseBatFile(batFilePath)
    
    console.log(`   ✅ Parsed ${batArgs.length} arguments from .bat file`)
    console.log('   Sample arguments:')
    batArgs.slice(0, 5).forEach((arg, i) => {
      console.log(`      ${i + 1}. ${arg.substring(0, 60)}${arg.length > 60 ? '...' : ''}`)
    })

    // Verify we got the expected arguments
    const hasCiphers = batArgs.some(arg => arg.includes('--ciphers') || arg === '--ciphers')
    const hasAccept = batArgs.some((arg, i) => 
      arg === '-H' && batArgs[i + 1]?.includes('Accept:') ||
      arg.includes('Accept:')
    )
    const hasHttp2 = batArgs.includes('--http2')
    const hasTlsGrease = batArgs.includes('--tls-grease')

    console.log('\n   Verification:')
    console.log(`   ${hasCiphers ? '✅' : '❌'} Found --ciphers argument`)
    console.log(`   ${hasAccept ? '✅' : '❌'} Found Accept header`)
    console.log(`   ${hasHttp2 ? '✅' : '❌'} Found --http2 argument`)
    console.log(`   ${hasTlsGrease ? '✅' : '❌'} Found --tls-grease argument`)

    console.log('\n2. Testing header extraction from user args...')
    const userArgs = ['-H', 'Accept: application/json', '-H', 'User-Agent: MyAgent/1.0', 'https://example.com']
    const userHeaderNames = extractHeaderNamesFromArgs(userArgs)
    
    console.log(`   ✅ Extracted ${userHeaderNames.size} header names from user args:`)
    userHeaderNames.forEach(name => {
      console.log(`      - ${name}`)
    })

    console.log('\n3. Testing header filtering...')
    const filteredBatArgs = filterConflictingHeaders(batArgs, userHeaderNames)
    
    console.log(`   ✅ Filtered .bat args: ${batArgs.length} → ${filteredBatArgs.length} arguments`)
    
    // Check that Accept header was removed
    const hasAcceptAfterFilter = filteredBatArgs.some((arg, i) => 
      arg === '-H' && filteredBatArgs[i + 1]?.includes('Accept:') ||
      arg.includes('Accept:')
    )
    const hasUserAgentAfterFilter = filteredBatArgs.some((arg, i) => 
      arg === '-H' && filteredBatArgs[i + 1]?.includes('User-Agent:') ||
      arg.includes('User-Agent:')
    )
    
    // Check that non-conflicting headers are preserved
    const hasAcceptLanguageAfterFilter = filteredBatArgs.some((arg, i) => 
      arg === '-H' && filteredBatArgs[i + 1]?.includes('Accept-Language:') ||
      arg.includes('Accept-Language:')
    )
    const hasHttp2AfterFilter = filteredBatArgs.includes('--http2')
    const hasTlsGreaseAfterFilter = filteredBatArgs.includes('--tls-grease')

    console.log('\n   Verification:')
    console.log(`   ${!hasAcceptAfterFilter ? '✅' : '❌'} Accept header removed from .bat (conflicts with user)`)
    console.log(`   ${!hasUserAgentAfterFilter ? '✅' : '❌'} User-Agent header removed from .bat (conflicts with user)`)
    console.log(`   ${hasAcceptLanguageAfterFilter ? '✅' : '❌'} Accept-Language preserved (no conflict)`)
    console.log(`   ${hasHttp2AfterFilter ? '✅' : '❌'} --http2 preserved (not a header)`)
    console.log(`   ${hasTlsGreaseAfterFilter ? '✅' : '❌'} --tls-grease preserved (not a header)`)

    console.log('\n4. Testing final argument combination...')
    const finalArgs = [...filteredBatArgs, ...userArgs]
    
    // Count Accept headers in final args (properly)
    let acceptHeaderCount = 0
    for (let i = 0; i < finalArgs.length; i++) {
      const arg = finalArgs[i]
      if (arg === '-H' && finalArgs[i + 1]?.includes('Accept:')) {
        acceptHeaderCount++
        i++ // Skip the header value
      } else if (arg.includes('Accept:') && !arg.startsWith('-H')) {
        acceptHeaderCount++
      }
    }

    console.log(`   ✅ Final args: ${finalArgs.length} total arguments`)
    console.log(`   ✅ Accept headers in final args: ${acceptHeaderCount}`)
    
    if (acceptHeaderCount === 1) {
      console.log('   ✅ SUCCESS! Only one Accept header (user-provided)')
    } else {
      console.log(`   ❌ FAILURE! Found ${acceptHeaderCount} Accept headers (should be 1)`)
    }

    console.log('\n=== Test Summary ===')
    if (!hasAcceptAfterFilter && acceptHeaderCount === 1) {
      console.log('✅ All tests passed! The parsing logic works correctly.')
      console.log('   On Windows, this will prevent duplicate headers.')
    } else {
      console.log('❌ Some tests failed. Check the output above.')
    }

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
testBatParsing().catch(console.error)

