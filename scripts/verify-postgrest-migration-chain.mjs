import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localStatusCommand = process.platform === 'win32'
  ? {
      executable: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx --yes --package supabase@2.109.1 supabase status --output env'],
    }
  : {
      executable: 'npx',
      args: ['--yes', '--package', 'supabase@2.109.1', 'supabase', 'status', '--output', 'env'],
    }

function localStatusEnvironment() {
  let output
  try {
    output = execFileSync(
      localStatusCommand.executable,
      localStatusCommand.args,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch {
    throw new Error('Unable to read local Supabase status for the PostgREST verification.')
  }

  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .flatMap((line) => {
        const separator = line.indexOf('=')
        return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')]] : []
      }),
  )
}

const localStatus = localStatusEnvironment()
const apiUrl = localStatus.API_URL
const anonKey = localStatus.ANON_KEY

if (!apiUrl || !anonKey) {
  throw new Error('Local Supabase status did not provide API_URL and ANON_KEY for the PostgREST verification.')
}

const endpoint = '/rest/v1/nodes?select=id&limit=1'
const response = await fetch(`${apiUrl}${endpoint}`, {
  headers: {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
    'accept-profile': 'showroom',
  },
})

if (!response.ok) {
  const body = (await response.text()).slice(0, 500)
  throw new Error(`PostgREST REST verification failed: ${response.status} ${endpoint}; ${body}`)
}

console.log(`PostgREST REST verification passed: ${response.status} ${endpoint} (showroom profile)`)
