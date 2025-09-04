// src/index.ts
import { Cuimp } from './cuimp'

export async function __smoke() {
  const cu = new Cuimp('chrome136', { followRedirects: true })
  const info = cu.verifyBinary()
  console.log('Binary:', info)
  const cmd = cu.buildCommandPreview({
    url: 'https://example.com',
    method: 'GET',
  })
  console.log('Preview:', cmd)
}
