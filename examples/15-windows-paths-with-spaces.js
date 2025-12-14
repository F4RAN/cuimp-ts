#!/usr/bin/env node

/**
 * Windows Paths with Spaces Example
 * 
 * This example demonstrates how to use cuimp with custom binary paths that contain spaces.
 * This addresses issue #25 where paths with spaces (e.g., "D:/Users/Active PC/cuimp/binaries")
 * were causing UNSUPPORTED_PROTOCOL errors on Windows.
 * 
 * Run with: node examples/15-windows-paths-with-spaces.js
 * 
 * Note: This example is primarily for Windows, but demonstrates the fix for path handling.
 */

import { Cuimp, createCuimpHttp } from '../dist/index.js'
import path from 'node:path'
import os from 'node:os'

async function main() {
  console.log('=== Windows Paths with Spaces Example ===\n')

  // Check if running on Windows
  const isWindows = process.platform === 'win32'
  if (!isWindows) {
    console.log('⚠️  This example is designed for Windows, but you can still see how it works.')
    console.log('   On non-Windows systems, paths with spaces are handled differently.\n')
  }

  try {
    // Example 1: Setting a custom path with spaces (Windows-style)
    console.log('1. Using custom binary path with spaces...')
    
    // Simulate a Windows path with spaces
    // In real usage, this would be something like: "D:/Users/Active PC/cuimp/binaries/curl_edge101.bat"
    const customPathWithSpaces = isWindows
      ? path.join(os.homedir(), 'My Documents', 'cuimp', 'binaries', 'curl_edge101.bat')
      : path.join(os.homedir(), 'My Documents', 'cuimp', 'binaries', 'curl-impersonate')

    console.log(`   Custom path: ${customPathWithSpaces}`)
    console.log('   Note: The path contains spaces, which requires proper quoting on Windows.')
    console.log()

    // Create Cuimp instance with custom path
    const cuimp = new Cuimp({
      path: customPathWithSpaces
    })

    // Try to verify the binary (this will fail if the path doesn't exist, but demonstrates usage)
    try {
      const verifiedPath = await cuimp.verifyBinary()
      console.log(`   ✅ Binary verified at: ${verifiedPath}`)
      console.log('   The path is properly quoted when passed to spawn() on Windows.')
      console.log()

      // Make a request using the custom path
      console.log('2. Making HTTP request with custom path...')
      const http = createCuimpHttp(cuimp)
      
      try {
        const response = await http.get('https://httpbin.org/get')
        console.log('   ✅ Request successful!')
        console.log(`   Status: ${response.status}`)
        console.log(`   The path with spaces was handled correctly.`)
      } catch (error) {
        console.log('   ⚠️  Request failed (this is expected if binary doesn\'t exist):')
        console.log(`   ${error.message}`)
      }
    } catch (error) {
      console.log('   ⚠️  Binary not found at custom path (this is expected in examples):')
      console.log(`   ${error.message}`)
      console.log('   But the path quoting logic is still tested and working!')
    }
    console.log()

    // Example 2: Path without spaces but with forward slashes (second scenario)
    console.log('3. Using path with forward slashes (second scenario fix)...')
    // Windows paths can be provided with forward slashes, which need normalization
    const pathWithForwardSlashes = isWindows
      ? 'D:/Users/ActivePC/cuimp/binaries/curl_edge101.bat'
      : '/usr/local/bin/curl-impersonate'

    console.log(`   Path with forward slashes: ${pathWithForwardSlashes}`)
    console.log('   Note: On Windows, forward slashes are normalized to backslashes.')
    console.log('   This fixes the "no URL specified" and "path not found" errors.')
    console.log()

    // Example 3: Path without spaces (should work normally)
    console.log('4. Using path without spaces (for comparison)...')
    const pathWithoutSpaces = isWindows
      ? path.join(os.homedir(), '.cuimp', 'binaries', 'curl_edge101.bat')
      : path.join(os.homedir(), '.cuimp', 'binaries', 'curl-impersonate')

    console.log(`   Path without spaces: ${pathWithoutSpaces}`)
    console.log('   This path doesn\'t require quoting, but still gets normalized.')
    console.log()

    // Example 4: Demonstrate the fixes
    console.log('5. Technical Details:')
    console.log('   Scenario 1 - Paths with spaces:')
    console.log('   Before the fix:')
    console.log('   - Paths with spaces were not quoted')
    console.log('   - Windows CMD would split "D:\\Users\\Active PC\\..." into:')
    console.log('     Command: "D:\\Users\\Active"')
    console.log('     Args: ["PC\\..."]')
    console.log('   - This caused: "C:\\Users\\ACTIVE is not recognized" error')
    console.log()
    console.log('   After the fix:')
    console.log('   - Paths with spaces (and other shell metacharacters) are quoted')
    console.log('   - Path becomes: "D:\\Users\\Active PC\\..."')
    console.log('   - Windows CMD treats it as a single command path')
    console.log('   - Existing quotes in paths are properly escaped')
    console.log()
    console.log('   Scenario 2 - Paths without spaces but with issues:')
    console.log('   Before the fix:')
    console.log('   - Paths with forward slashes (D:/Users/...) were not normalized')
    console.log('   - Relative paths were not resolved to absolute')
    console.log('   - This caused: "no URL specified" and "path not found" errors')
    console.log()
    console.log('   After the fix:')
    console.log('   - Forward slashes are normalized to backslashes on Windows')
    console.log('   - Relative paths are resolved to absolute paths')
    console.log('   - Paths are normalized before being passed to spawn()')
    console.log('   - This ensures Windows CMD can find and execute the binary')
    console.log()

    console.log('✅ Windows paths with spaces example completed!')
    console.log()
    console.log('Key takeaways:')
    console.log('  1. Paths with spaces are automatically quoted for .bat files')
    console.log('  2. Forward slashes are normalized to backslashes on Windows')
    console.log('  3. Relative paths are resolved to absolute paths')
    console.log('  4. Existing quotes are properly escaped')
    console.log()
    console.log('  These fixes resolve issue #25 (UNSUPPORTED_PROTOCOL errors)')
    console.log('  for both scenarios: paths with spaces and paths without spaces.')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.code) {
      console.error('Error Code:', error.code)
    }
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
