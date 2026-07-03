import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(scriptDir, '..')
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
const isExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL)
const args = process.argv.slice(2)

function run(command, commandArgs, options = {}) {
  return spawn(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
}

async function isServerReady(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' })
    return response.status >= 200 && response.status < 500
  } catch {
    return false
  }
}

async function waitForServer(url, serverProcess) {
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Next dev server exited early with code ${serverProcess.exitCode}.`)
    }

    if (await isServerReady(url)) return
    await new Promise(resolveWait => setTimeout(resolveWait, 500))
  }

  throw new Error(`Timed out waiting for ${url}.`)
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return

  if (process.platform === 'win32') {
    await new Promise(resolveStop => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      })
      killer.on('close', resolveStop)
      killer.on('error', resolveStop)
    })
    return
  }

  child.kill('SIGTERM')
  await new Promise(resolveStop => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolveStop()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveStop()
    })
  })
}

let serverProcess = null
let ownsServer = false
let exitCode = 1

try {
  if (!isExternalServer && !(await isServerReady(baseURL))) {
    const nextCli = join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next')
    serverProcess = run(process.execPath, [
      nextCli,
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3000',
    ], {
      env: {
        ...process.env,
        BROWSER: 'none',
        FORCE_COLOR: '1',
      },
    })
    ownsServer = true
    await waitForServer(baseURL, serverProcess)
  }

  const playwrightCli = join(rootDir, 'node_modules', '@playwright', 'test', 'cli.js')
  const playwright = run(process.execPath, [playwrightCli, 'test', ...args], {
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseURL,
    },
  })

  exitCode = await new Promise(resolveRun => {
    playwright.on('close', code => resolveRun(code ?? 1))
    playwright.on('error', () => resolveRun(1))
  })
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  if (ownsServer) {
    await stopProcessTree(serverProcess)
  }
}

process.exit(exitCode)
