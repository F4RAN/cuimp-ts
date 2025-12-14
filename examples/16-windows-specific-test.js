import { createCuimpHttp } from '../dist/index.js'

async function test() {
  const http = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '123' },
  })

  try {
    // Test with password containing quote (kenmadev's example)
    const response = await http.post('https://httpbin.org/post', {
      username: 'username123',
      password: '"P!ngpass123' // literal quote
    })
    
    console.log('✅ Success! Status:', response.status)
    console.log('Response:', response.data)
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('URL_MALFORMAT')) {
      console.error('The fix did not work - still getting URL_MALFORMAT')
    }
  }
}

test()