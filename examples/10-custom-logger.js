#!/usr/bin/env node

/**
 * Custom Logger Example
 * 
 * This example demonstrates how to use a custom logger with cuimp
 * to control logging behavior.
 * Run with: node examples/10-custom-logger.js
 */

import { createCuimpHttp, Cuimp } from '../dist/index.js'

async function main() {
  console.log('=== Custom Logger Example ===\n')

  // Example 1: Silent logger (suppress all logs)
  console.log('1. Using silent logger (no output)...')
  const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  }

  const silentClient = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '123' },
    logger: silentLogger
  })

  try {
    // This will download/verify binary silently
    await silentClient.get('https://httpbin.org/get')
    console.log('   ✅ Request completed silently (no binary download logs)')
  } catch (error) {
    console.log('   ⚠️  Error:', error.message)
  }
  console.log()

  // Example 2: Custom formatted logger
  console.log('2. Using custom formatted logger...')
  const customLogger = {
    info: (...args) => console.log('   [INFO]', ...args),
    warn: (...args) => console.log('   [WARN]', ...args),
    error: (...args) => console.log('   [ERROR]', ...args),
    debug: (...args) => console.log('   [DEBUG]', ...args)
  }

  const customClient = createCuimpHttp({
    descriptor: { browser: 'firefox', version: '133' },
    logger: customLogger
  })

  try {
    await customClient.get('https://httpbin.org/get')
    console.log('   ✅ Request completed with custom logging')
  } catch (error) {
    console.log('   ⚠️  Error:', error.message)
  }
  console.log()

  // Example 3: Logger that collects logs
  console.log('3. Using logger that collects logs...')
  const logEntries = []
  const collectingLogger = {
    info: (...args) => logEntries.push({ level: 'info', args }),
    warn: (...args) => logEntries.push({ level: 'warn', args }),
    error: (...args) => logEntries.push({ level: 'error', args }),
    debug: (...args) => logEntries.push({ level: 'debug', args })
  }

  const collectingClient = createCuimpHttp({
    descriptor: { browser: 'edge', version: '101' },
    logger: collectingLogger
  })

  try {
    await collectingClient.get('https://httpbin.org/get')
    console.log(`   ✅ Collected ${logEntries.length} log entries:`)
    logEntries.forEach(entry => {
      console.log(`      [${entry.level.toUpperCase()}]`, entry.args.join(' '))
    })
  } catch (error) {
    console.log('   ⚠️  Error:', error.message)
  }
  console.log()

  // Example 4: Using with Cuimp class directly
  console.log('4. Using custom logger with Cuimp class...')
  const fileLogger = {
    info: (msg) => console.log(`   📝 [FILE LOG] ${msg}`),
    warn: (msg) => console.log(`   ⚠️  [FILE LOG] ${msg}`),
    error: (msg) => console.log(`   ❌ [FILE LOG] ${msg}`),
    debug: (msg) => console.log(`   🔍 [FILE LOG] ${msg}`)
  }

  const cuimp = new Cuimp({
    descriptor: { browser: 'chrome' },
    logger: fileLogger
  })

  try {
    await cuimp.verifyBinary()
    console.log('   ✅ Binary verified with custom logger')
  } catch (error) {
    console.log('   ⚠️  Error:', error.message)
  }
  console.log()

  console.log('✅ Custom logger example completed!')
  console.log()
  console.log('Note: Custom loggers allow you to:')
  console.log('  - Suppress logs in production')
  console.log('  - Route logs to external systems')
  console.log('  - Format logs differently')
  console.log('  - Collect logs for analysis')
}

main()

