import assert from 'node:assert/strict'
import test from 'node:test'

import worker from './index.ts'

const env = {
  APP_ORIGIN: 'https://preview.munjanggun.com',
  HOME_ORIGIN: 'https://munjanggun-home.pages.dev',
  PUBLIC_ORIGIN: 'https://munjanggun.com',
}

async function routedOrigin(pathname) {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async request => {
    const url = new URL(request.url)
    return Response.json({ origin: url.origin, pathname: url.pathname })
  }

  try {
    const response = await worker.fetch(new Request(`https://munjanggun.com${pathname}`), env)
    return response.json()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('routes the Next.js generated icon through the Vercel application origin', async () => {
  const routed = await routedOrigin('/icon.png?icon.test.png')

  assert.equal(routed.origin, env.APP_ORIGIN)
  assert.equal(routed.pathname, '/icon.png')
})

test('keeps the homepage root on Cloudflare Pages', async () => {
  const routed = await routedOrigin('/')

  assert.equal(routed.origin, env.HOME_ORIGIN)
  assert.equal(routed.pathname, '/')
})
