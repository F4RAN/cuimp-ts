#!/usr/bin/env node

/**
 * Test and fix .bat file parsing
 * This file contains the actual .bat file content to test parsing
 */

import fs from 'fs'

// The actual .bat file content from Windows
const actualBatContent = `:: The list of ciphers can be obtained by looking at the Client Hello message in
:: Wireshark, then converting it using this reference
:: https://wiki.mozilla.org/Security/Cipher_Suites
@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA" ^
    --curves X25519MLKEM768:X25519:P-256:P-384 ^
    -H "sec-ch-ua: \\"Chromium\\";v=\\"136\\", \\"Google Chrome\\";v=\\"136\\", \\"Not(A:Brand\\";v=\\"99\\"" ^
    -H "sec-ch-ua-mobile: ?0" ^
    -H "sec-ch-ua-platform: \\"macOS\\"" ^
    -H "Upgrade-Insecure-Requests: 1" ^
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36" ^
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" ^
    -H "Sec-Fetch-Site: none" ^
    -H "Sec-Fetch-Mode: navigate" ^
    -H "Sec-Fetch-User: ?1" ^
    -H "Sec-Fetch-Dest: document" ^
    -H "Accept-Encoding: gzip, deflate, br, zstd" ^
    -H "Accept-Language: en-US,en;q=0.9" ^
    -H "Priority: u=0, i" ^
    --http2 ^
    --http2-settings "1:65536;2:0;4:6291456;6:262144" ^
    --http2-window-update 15663105 ^
    --http2-stream-weight 256 ^
    --http2-stream-exclusive 1 ^
    --compressed ^
    --ech grease ^
    --tlsv1.2 --alps --tls-permute-extensions ^
    --cert-compression brotli ^
    --tls-grease ^
    --tls-use-new-alps-codepoint ^
    --tls-signed-cert-timestamps ^
    %*`

// Write test .bat file
fs.writeFileSync('test_curl_chrome136.bat', actualBatContent)

// Test parsing function (simplified version)
function parseBatFileSimple(content) {
  const lines = content.split(/\r?\n/)
  const args = []
  let inCurlCommand = false
  let accumulated = ''

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
      const match = line.match(/(?:.*?"%~dp0curl\.exe"|.*?curl\.exe)\s*(.*)$/)
      if (match && match[1]) {
        accumulated = match[1].replace(/\s*\^\s*$/, '')
      } else {
        accumulated = ''
      }
      continue
    }

    if (inCurlCommand) {
      // Check for %*
      if (trimmed.includes('%*')) {
        if (accumulated.trim()) {
          const parsed = parseArguments(accumulated.trim())
          args.push(...parsed)
        }
        break
      }

      // Check for line continuation
      const hasContinuation = line.trimEnd().endsWith('^')
      let lineContent = line.replace(/^\s+/, '') // Remove leading spaces
      
      if (hasContinuation) {
        lineContent = lineContent.replace(/\s*\^\s*$/, '')
      } else {
        lineContent = lineContent.trim()
      }

      if (lineContent) {
        // Check if inside quotes
        const quoteCount = (accumulated.match(/"/g) || []).length
        const inQuotes = quoteCount % 2 === 1

        if (accumulated) {
          if (inQuotes) {
            accumulated += lineContent // No space inside quotes
          } else {
            accumulated += ' ' + lineContent // Space between arguments
          }
        } else {
          accumulated = lineContent
        }
      }

      // Process if no continuation
      if (!hasContinuation) {
        if (accumulated.trim()) {
          const parsed = parseArguments(accumulated.trim())
          args.push(...parsed)
          accumulated = ''
        }
      }
    }
  }

  // Process remaining
  if (accumulated.trim()) {
    const parsed = parseArguments(accumulated.trim())
    args.push(...parsed)
  }

  return args
}

function parseArguments(line) {
  const args = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
        current += char
      } else if (char === quoteChar) {
        inQuotes = false
        current += char
        quoteChar = ''
      } else {
        current += char
      }
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current)
        current = ''
      }
      // Skip multiple spaces
      while (i + 1 < line.length && line[i + 1] === ' ') {
        i++
      }
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

// Test the parsing
console.log('Testing .bat file parsing...\n')
const parsedArgs = parseBatFileSimple(actualBatContent)

console.log(`Parsed ${parsedArgs.length} arguments\n`)

// Find the --ciphers argument
const ciphersIndex = parsedArgs.findIndex(arg => arg === '--ciphers' || arg.startsWith('--ciphers'))
if (ciphersIndex >= 0) {
  const ciphersArg = parsedArgs[ciphersIndex]
  let ciphersValue = ''
  
  if (ciphersArg === '--ciphers' && parsedArgs[ciphersIndex + 1]) {
    ciphersValue = parsedArgs[ciphersIndex + 1]
  } else if (ciphersArg.startsWith('--ciphers')) {
    ciphersValue = ciphersArg.replace(/^--ciphers\s+/, '')
  }

  console.log('Ciphers argument found:')
  console.log(`  Length: ${ciphersValue.length} characters`)
  console.log(`  Starts with: ${ciphersValue.substring(0, 50)}...`)
  console.log(`  Ends with: ...${ciphersValue.substring(ciphersValue.length - 50)}`)
  console.log(`  Full value: ${ciphersValue}\n`)

  // Check if it's complete
  const expectedEnd = 'AES256-SHA"'
  if (ciphersValue.endsWith(expectedEnd)) {
    console.log('✅ Ciphers argument is COMPLETE')
  } else {
    console.log('❌ Ciphers argument is TRUNCATED')
    console.log(`   Expected to end with: ${expectedEnd}`)
    console.log(`   Actually ends with: ${ciphersValue.substring(ciphersValue.length - 20)}`)
  }
} else {
  console.log('❌ --ciphers argument not found!')
}

// Show first 10 and last 10 arguments
console.log('\nFirst 10 arguments:')
parsedArgs.slice(0, 10).forEach((arg, i) => {
  console.log(`  ${i + 1}. ${arg.substring(0, 80)}${arg.length > 80 ? '...' : ''}`)
})

console.log('\nLast 10 arguments:')
parsedArgs.slice(-10).forEach((arg, i) => {
  console.log(`  ${parsedArgs.length - 10 + i + 1}. ${arg.substring(0, 80)}${arg.length > 80 ? '...' : ''}`)
})

