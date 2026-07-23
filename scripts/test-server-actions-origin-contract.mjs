import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextConfig = await readFile(path.join(projectRoot, 'next.config.ts'), 'utf8')
const allowedOriginsBlock = nextConfig.match(/allowedOrigins:\s*\[([\s\S]*?)\]/)?.[1]
assert.ok(allowedOriginsBlock, 'Server Action allowedOrigins block must exist')
const allowedOrigins = [...allowedOriginsBlock.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])

assert.deepEqual(
  allowedOrigins,
  ['munjanggun.com', 'hybrid-preview.munjanggun.com'],
  'Server Actions must allow only the two exact browser-facing Cloudflare proxy origins',
)
assert.ok(allowedOrigins.every(origin => !origin.includes('*')), 'Proxy origins must not use wildcards')

console.log('server action origin contract passed (2 exact proxy origins)')
