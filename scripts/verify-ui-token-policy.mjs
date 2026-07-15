import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g
const RAW_LAYOUT_PATTERN = /(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/g
const TOKEN_DECLARATION_PATTERN = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}{]+);?/g
const VARIABLE_USE_PATTERN = /var\(\s*(--[A-Za-z0-9_-]+)/g

function matchesEntry(value, entries = []) {
  return entries.some(entry => entry instanceof RegExp ? entry.test(value) : entry === value)
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function stripCommentsKeepingLines(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
}

export function verifyUiTokenPolicy({ files, config }) {
  const normalizedFiles = files.map(file => ({
    path: file.path.replaceAll('\\', '/'),
    content: String(file.content).replace(/\r\n?/g, '\n'),
  }))
  const generatedFiles = new Set((config.generatedFiles ?? []).map(file => file.replaceAll('\\', '/')))
  const defined = new Set(config.externalDefinitions ?? [])
  const diagnostics = []
  const usedLayoutConstants = new Set()

  for (const file of normalizedFiles) {
    const source = stripCommentsKeepingLines(file.content)
    let match
    TOKEN_DECLARATION_PATTERN.lastIndex = 0
    while ((match = TOKEN_DECLARATION_PATTERN.exec(source)) !== null) {
      defined.add(match[1])
    }
  }

  for (const file of normalizedFiles) {
    if (generatedFiles.has(file.path)) continue
    const source = stripCommentsKeepingLines(file.content)
    let match

    TOKEN_DECLARATION_PATTERN.lastIndex = 0
    while ((match = TOKEN_DECLARATION_PATTERN.exec(source)) !== null) {
      const [full, property, value] = match
      const line = lineNumberAt(source, match.index + full.indexOf(property))
      if (property.startsWith('--mg-') && !matchesEntry(property, config.declarationAllowlist)) {
        diagnostics.push(`${file.path}:${line}: unauthorized token declaration ${property}`)
      }

      RAW_COLOR_PATTERN.lastIndex = 0
      let raw
      while ((raw = RAW_COLOR_PATTERN.exec(value)) !== null) {
        if (!matchesEntry(property, config.rawValueTokenAllowlist)) {
          diagnostics.push(`${file.path}:${line}: unauthorized raw color ${raw[0]}`)
        }
      }

      RAW_LAYOUT_PATTERN.lastIndex = 0
      while ((raw = RAW_LAYOUT_PATTERN.exec(value)) !== null) {
        const exception = (config.layoutConstants ?? []).find(item => (
          item.file.replaceAll('\\', '/') === file.path
          && item.property === property
          && item.value === raw[0]
        ))
        if (exception) {
          usedLayoutConstants.add(exception.name)
        } else {
          diagnostics.push(`${file.path}:${line}: unauthorized layout constant ${raw[0]}`)
        }
      }

      TOKEN_DECLARATION_PATTERN.lastIndex = match.index + full.length
    }

    const lines = source.split('\n')
    lines.forEach((lineSource, lineIndex) => {
      const declarationLine = lineSource.includes('--') && TOKEN_DECLARATION_PATTERN.test(lineSource)
      TOKEN_DECLARATION_PATTERN.lastIndex = 0
      if (declarationLine) return
      const trimmedLine = lineSource.trimStart()
      const policyProperty = trimmedLine.startsWith('@media')
        ? '@media'
        : trimmedLine.match(/^([A-Za-z-]+)\s*:/)?.[1]

      let raw
      RAW_COLOR_PATTERN.lastIndex = 0
      while ((raw = RAW_COLOR_PATTERN.exec(lineSource)) !== null) {
        diagnostics.push(`${file.path}:${lineIndex + 1}: unauthorized raw color ${raw[0]}`)
      }
      RAW_LAYOUT_PATTERN.lastIndex = 0
      while ((raw = RAW_LAYOUT_PATTERN.exec(lineSource)) !== null) {
        const exception = (config.layoutConstants ?? []).find(item => (
          item.file.replaceAll('\\', '/') === file.path
          && item.property === policyProperty
          && item.value === raw[0]
        ))
        if (exception) {
          usedLayoutConstants.add(exception.name)
        } else {
          diagnostics.push(`${file.path}:${lineIndex + 1}: unauthorized layout constant ${raw[0]}`)
        }
      }
    })
  }

  for (const file of normalizedFiles) {
    const source = stripCommentsKeepingLines(file.content)
    let match
    VARIABLE_USE_PATTERN.lastIndex = 0
    while ((match = VARIABLE_USE_PATTERN.exec(source)) !== null) {
      if (!defined.has(match[1])) {
        diagnostics.push(`${file.path}:${lineNumberAt(source, match.index)}: undefined variable ${match[1]}`)
      }
    }
  }

  for (const item of config.layoutConstants ?? []) {
    if (!usedLayoutConstants.has(item.name)) {
      diagnostics.push(`${item.file.replaceAll('\\', '/')}:1: named layout constant ${item.name} was not used`)
    }
  }

  return {
    diagnostics: [...new Set(diagnostics)].sort((left, right) => left.localeCompare(right)),
    usedLayoutConstants: [...usedLayoutConstants].sort((left, right) => left.localeCompare(right)),
  }
}

export async function verifyConfiguredUiTokenPolicy({
  projectRoot = projectRootFromScript,
  configModule = './ui-token-policy.config.mjs',
} = {}) {
  const configUrl = new URL(configModule, import.meta.url)
  const { default: config } = await import(configUrl.href)
  const files = await Promise.all(config.files.map(async relativePath => ({
    path: relativePath,
    content: await readFile(path.join(projectRoot, relativePath), 'utf8'),
  })))
  const result = verifyUiTokenPolicy({ files, config })
  if (result.diagnostics.length) {
    throw new Error(`UI token policy failed:\n${result.diagnostics.join('\n')}`)
  }
  return result
}

async function main() {
  const result = await verifyConfiguredUiTokenPolicy()
  console.log(`UI token policy passed (${result.usedLayoutConstants.length} named layout exceptions)`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
