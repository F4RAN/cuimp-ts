#!/usr/bin/env node

/**
 * Web Scraping Example
 * 
 * This example demonstrates web scraping with browser impersonation
 * to bypass anti-bot protections.
 * Run with: node examples/08-web-scraping.js
 */

import { createCuimpHttp } from '../dist/index.js'

async function main() {
  console.log('=== Web Scraping Example ===\n')

  // Create a scraper client that mimics Chrome
  const scraper = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '123' }
  })

  try {
    // Example 1: Scrape a simple page
    console.log('1. Scraping httpbin.org with browser impersonation...')
    const response1 = await scraper.get('https://httpbin.org/html', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    console.log('   ✅ Status:', response1.status)
    console.log('   Content-Type:', response1.headers['content-type'] || 'Not specified')
    console.log('   Content Length:', response1.rawBody.length, 'bytes')
    console.log('   First 200 chars:', response1.data.substring(0, 200).replace(/\s+/g, ' '))
    console.log()

    // Example 2: Scrape with custom headers
    console.log('2. Scraping with custom headers...')
    const response2 = await scraper.get('https://httpbin.org/headers', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://example.com',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    console.log('   ✅ Status:', response2.status)
    console.log('   Headers sent:', Object.keys(response2.data.headers || {}).length)
    console.log('   User-Agent:', 
      response2.data.headers?.['User-Agent']?.substring(0, 60) || 
      response2.data.headers?.['user-agent']?.substring(0, 60) || 
      'Not found')
    console.log()

    // Example 3: Scrape JSON API
    console.log('3. Scraping JSON API endpoint...')
    const response3 = await scraper.get('https://httpbin.org/json')
    console.log('   ✅ Status:', response3.status)
    console.log('   JSON keys:', Object.keys(response3.data).join(', '))
    console.log()

    // Example 4: POST form data (like a login form)
    console.log('4. Simulating form submission...')
    const response4 = await scraper.post('https://httpbin.org/post', {
      username: 'testuser',
      password: 'testpass',
      action: 'login'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com'
      }
    })
    console.log('   ✅ Status:', response4.status)
    console.log('   Form data received:', JSON.stringify(response4.data.json, null, 2))
    console.log()

    console.log('✅ Web scraping example completed!')
    console.log()
    console.log('Note: Browser impersonation helps bypass many anti-bot protections.')
    console.log('      Always respect robots.txt and terms of service.')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    process.exit(1)
  }
}

main()

