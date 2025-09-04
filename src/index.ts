// src/index.ts
import { Cuimp } from './cuimp'

export async function __smoke() {
  const cu = new Cuimp()
  const info = await cu.verifyBinary()
  console.log('Binary:', info)  
  const cmd = cu.buildCommandPreview('https://example.com', 'GET')
  console.log('Preview:', cmd)


  const cu2 = new Cuimp({
    descriptor: {
      browser: 'chrome',
      version: '123'
    }
  })
  const info2 = await cu2.verifyBinary()
  console.log('Binary:', info2) 
}
