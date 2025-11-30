#!/usr/bin/env node

/**
 * Proxy Example
 * 
 * This example demonstrates how to use proxies with cuimp.
 * Note: This example uses httpbin.org which doesn't require a real proxy.
 * For real proxy usage, uncomment and configure a proxy server.
 * Run with: node examples/05-proxy-example.js
 */

import { request } from '../dist/index.js'

async function main() {
  console.log('=== Proxy Example ===\n')

  try {
    // Request without proxy (direct connection)
    console.log('1. Making request without proxy (direct connection)...')
    const directResponse = await request({
      url: 'https://httpbin.org/ip'
    })
    console.log('   Status:', directResponse.status)
    console.log('   Your IP:', JSON.stringify(directResponse.data, null, 2))
    console.log()

    // Request with proxy configuration (commented out - requires real proxy)
    /*
    console.log('2. Making request with HTTP proxy...')
    const proxyResponse = await request({
      url: 'https://httpbin.org/ip',
      proxy: 'http://proxy.example.com:8080'
    })
    console.log('   Status:', proxyResponse.status)
    console.log('   IP through proxy:', JSON.stringify(proxyResponse.data, null, 2))
    console.log()

    // Request with SOCKS5 proxy
    console.log('3. Making request with SOCKS5 proxy...')
    const socksResponse = await request({
      url: 'https://httpbin.org/ip',
      proxy: 'socks5://proxy.example.com:1080'
    })
    console.log('   Status:', socksResponse.status)
    console.log('   IP through SOCKS5:', JSON.stringify(socksResponse.data, null, 2))
    console.log()

    // Request with authenticated proxy
    console.log('4. Making request with authenticated proxy...')
    const authProxyResponse = await request({
      url: 'https://httpbin.org/ip',
      proxy: 'http://username:password@proxy.example.com:8080'
    })
    console.log('   Status:', authProxyResponse.status)
    console.log('   IP through authenticated proxy:', JSON.stringify(authProxyResponse.data, null, 2))
    console.log()
    */

    // Environment variable proxy (if set)
    if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY) {
      console.log('2. Making request using environment variable proxy...')
      const envProxyResponse = await request({
        url: 'https://httpbin.org/ip'
      })
      console.log('   Status:', envProxyResponse.status)
      console.log('   IP through env proxy:', JSON.stringify(envProxyResponse.data, null, 2))
      console.log()
      console.log('   Note: cuimp automatically detects HTTP_PROXY, HTTPS_PROXY, and ALL_PROXY')
      console.log()
    } else {
      console.log('2. Environment proxy variables not set.')
      console.log('   To use environment proxy, set:')
      console.log('   export HTTP_PROXY=http://proxy.example.com:8080')
      console.log('   export HTTPS_PROXY=https://proxy.example.com:8080')
      console.log('   export ALL_PROXY=socks5://proxy.example.com:1080')
      console.log()
    }

    console.log('✅ Proxy example completed!')
    console.log()
    console.log('Note: To test with a real proxy, uncomment the proxy examples above')
    console.log('      and configure with your proxy server details.')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status) {
      console.error('HTTP Status:', error.status)
    }
    process.exit(1)
  }
}

main()

