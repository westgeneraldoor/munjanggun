import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g
const RAW_LAYOUT_PATTERN = /(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/g
const DECLARATION_PATTERN = /(?:^|(?<=[;{\n]))\s*(--[A-Za-z0-9_-]+|[A-Za-z-]+)\s*:\s*([^;}{]+);?/g
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

function selectorAtIndex(source, targetIndex) {
  const stack = []
  let segmentStart = 0

  for (let index = 0; index < targetIndex; index += 1) {
    const character = source[index]
    if (character === '{') {
      stack.push(source.slice(segmentStart, index).trim())
      segmentStart = index + 1
    } else if (character === '}') {
      stack.pop()
      segmentStart = index + 1
    } else if (character === ';') {
      segmentStart = index + 1
    }
  }

  return [...stack].reverse().find(item => item && !item.startsWith('@')) ?? '(unknown)'
}

function allowsGeneratedOverride(filePath, selector, scopes = []) {
  return scopes.some(scope => (
    scope.file.replaceAll('\\', '/') === filePath
    && (scope.selectors ?? []).includes(selector)
  ))
}

export function verifyUiTokenPolicy({ files, config }) {
  const normalizedFiles = files.map(file => ({
    path: file.path.replaceAll('\\', '/'),
    content: String(file.content).replace(/\r\n?/g, '\n'),
  }))
  const generatedFiles = new Set((config.generatedFiles ?? []).map(file => file.replaceAll('\\', '/')))
  const defined = new Set(config.externalDefinitions ?? [])
  const generatedTokenNames = new Set()
  const diagnostics = []
  const usedLayoutConstants = new Set()

  for (const file of normalizedFiles) {
    const source = stripCommentsKeepingLines(file.content)
    let match
    DECLARATION_PATTERN.lastIndex = 0
    while ((match = DECLARATION_PATTERN.exec(source)) !== null) {
      const property = match[1]
      if (!property.startsWith('--')) continue
      defined.add(property)
      if (generatedFiles.has(file.path)) generatedTokenNames.add(property)
    }
  }

  for (const file of normalizedFiles) {
    if (generatedFiles.has(file.path)) continue
    const source = stripCommentsKeepingLines(file.content)
    let match

    DECLARATION_PATTERN.lastIndex = 0
    while ((match = DECLARATION_PATTERN.exec(source)) !== null) {
      const [full, property, value] = match
      const line = lineNumberAt(source, match.index + full.indexOf(property))
      if (property.startsWith('--')) {
        const selector = selectorAtIndex(source, match.index + full.indexOf(property))
        if (
          generatedTokenNames.has(property)
          && !allowsGeneratedOverride(file.path, selector, config.generatedTokenOverrideScopes)
        ) {
          diagnostics.push(`${file.path}:${line}: central token collision ${property} in selector ${selector}`)
        } else if (property.startsWith('--mg-') && !matchesEntry(property, config.declarationAllowlist)) {
          diagnostics.push(`${file.path}:${line}: unauthorized token declaration ${property}`)
        }
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

      DECLARATION_PATTERN.lastIndex = match.index + full.length
    }

    const mediaPattern = /@media\s*([^{}]*)\{/g
    while ((match = mediaPattern.exec(source)) !== null) {
      const prelude = match[1]
      const line = lineNumberAt(source, match.index)
      let raw
      RAW_LAYOUT_PATTERN.lastIndex = 0
      while ((raw = RAW_LAYOUT_PATTERN.exec(prelude)) !== null) {
        const exception = (config.layoutConstants ?? []).find(item => (
          item.file.replaceAll('\\', '/') === file.path
          && item.property === '@media'
          && item.value === raw[0]
        ))
        if (exception) {
          usedLayoutConstants.add(exception.name)
        } else {
          diagnostics.push(`${file.path}:${line}: unauthorized layout constant ${raw[0]}`)
        }
      }
    }
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
