export * from './cuimp'

// quick local smoke check (not part of public API)
export async function __smoke() {
  const { Cuimp } = await import('./cuimp.js')
  const client = new Cuimp('chrome136', { followRedirects: true })
  const res = await client.request({
    url: 'https://tls.browserleaks.com/json',
    method: 'GET',
    timeoutMs: 15000
  })
  console.log('Status:', res.status)
  console.log('Body (first 300 chars):', res.text.slice(0, 300))
}
