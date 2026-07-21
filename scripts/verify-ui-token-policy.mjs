import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk)\([^)]*\)/g
const CSS_NAMED_COLORS = new Set(`accentcolor accentcolortext activetext aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood buttonborder buttonface buttontext cadetblue canvas canvastext chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue field fieldtext firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray graytext green greenyellow grey highlight highlighttext honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen linktext magenta mark marktext maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell selecteditem selecteditemtext sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet visitedtext wheat white whitesmoke yellow yellowgreen`.split(' '))
const RAW_LAYOUT_PATTERN = /(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/g
const DECLARATION_PATTERN = /(?:^|(?<=[;{\n]))\s*(--[A-Za-z0-9_-]+|[A-Za-z-]+)\s*:\s*([^;}{]+);?/g
const VARIABLE_USE_PATTERN = /var\(\s*(--[A-Za-z0-9_-]+)/g
const RAW_LAYOUT_PROPERTIES = /^(?:--|margin(?:-.+)?$|padding(?:-.+)?$|gap$|row-gap$|column-gap$|inset(?:-.+)?$|top$|right$|bottom$|left$|border(?:-.+)?-radius$|border-radius$|box-shadow$|outline-offset$|scroll-margin(?:-.+)?$|scroll-padding(?:-.+)?$)/
const STRICT_LAYOUT_PROPERTIES = /^(?:font-size|(?:min-|max-)?(?:width|height)|grid-template-(?:columns|rows)|border(?:-(?:top|right|bottom|left))?(?:-width)?|outline(?:-width)?|transform)$/
const TOKENIZED_SHADOW_PATTERN = /^(?:none|var\(\s*--[A-Za-z0-9_-]+\s*\)|inherit|initial|unset|revert(?:-layer)?)$/
const TOKEN_MULTIPLIER_PATTERN = /var\(\s*(--mg-[A-Za-z0-9_-]+)[^)]*\)\s*\*\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*\*\s*var\(\s*(--mg-[A-Za-z0-9_-]+)[^)]*\)/g

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

function findRawColors(value) {
  const rawColors = [...value.matchAll(RAW_COLOR_PATTERN)].map(match => match[0])
  const withoutReferences = value
    .replace(/var\(\s*--[A-Za-z0-9_-]+/g, 'var(')
    .replace(/url\([^)]*\)/g, ' ')
    .replace(/(['"])(?:\\.|(?!\1).)*\1/g, ' ')
  const namedColors = [...withoutReferences.matchAll(/\b[a-z]+\b/gi)]
    .map(match => match[0])
    .filter(color => CSS_NAMED_COLORS.has(color.toLowerCase()))

  return [...new Set([...rawColors, ...namedColors])]
}

function allowsTokenDefinition(filePath, selector, scopes = []) {
  return scopes.some(scope => (
    scope.file.replaceAll('\\', '/') === filePath
    && (scope.selectors ?? []).includes(selector)
  ))
}

function validatesRawLayout(strictLayoutFiles, filePath, property) {
  return RAW_LAYOUT_PROPERTIES.test(property)
    || (strictLayoutFiles.has(filePath) && STRICT_LAYOUT_PROPERTIES.test(property))
}

function findLayoutConstant(config, filePath, property, value) {
  return [
    ...(config.layoutConstants ?? []),
    ...(config.sharedLayoutConstants ?? []),
  ].find(item => (
    validatesLayoutException(item)
    && (
      item.file?.replaceAll('\\', '/') === filePath
      || (item.files ?? []).map(file => file.replaceAll('\\', '/')).includes(filePath)
    )
    && item.property === property
    && item.value === value
  ))
}

function findUnsafeTokenMultipliers(value) {
  const unsafe = []
  let match
  TOKEN_MULTIPLIER_PATTERN.lastIndex = 0
  while ((match = TOKEN_MULTIPLIER_PATTERN.exec(value)) !== null) {
    const token = match[1] ?? match[4]
    const scalar = Number(match[2] ?? match[3])
    const maximum = /--mg-(?:border-width(?:-strong)?|focus-ring-width)$/.test(token) ? 2 : 16
    if (!Number.isFinite(scalar) || Math.abs(scalar) > maximum) {
      unsafe.push(`${token} * ${scalar}`)
    }
  }
  return unsafe
}

function validatesLayoutException(item) {
  const files = [item.file, ...(item.files ?? [])].filter(Boolean)
  return files.length > 0
    && typeof item.property === 'string'
    && typeof item.value === 'string'
    && typeof item.reason === 'string'
    && item.reason.trim().length > 0
}

async function listCssFiles(projectRoot, relativeDirectory) {
  const entries = await readdir(path.join(projectRoot, relativeDirectory), { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    return entry.isDirectory() ? listCssFiles(projectRoot, relativePath) : [relativePath]
  }))

  return nested.flat().filter(file => file.endsWith('.css'))
}

export function verifyUiTokenPolicy({ files, config }) {
  const normalizedFiles = files.map(file => ({
    path: file.path.replaceAll('\\', '/'),
    content: String(file.content).replace(/\r\n?/g, '\n'),
  }))
  const generatedFiles = new Set((config.generatedFiles ?? []).map(file => file.replaceAll('\\', '/')))
  const tokenDefinitionFiles = new Set((config.tokenDefinitionFiles ?? []).map(file => file.replaceAll('\\', '/')))
  const strictLayoutFiles = new Set((config.strictLayoutFiles ?? []).map(file => file.replaceAll('\\', '/')))
  const globalDefinitionFiles = new Set([
    ...generatedFiles,
    ...tokenDefinitionFiles,
    ...(config.globalDefinitionFiles ?? []).map(file => file.replaceAll('\\', '/')),
  ])
  const globallyDefined = new Set(config.externalDefinitions ?? [])
  const definedByFile = new Map()
  const generatedTokenNames = new Set()
  const diagnostics = []
  const usedLayoutConstants = new Set()

  for (const item of [
    ...(config.layoutConstants ?? []),
    ...(config.sharedLayoutConstants ?? []),
  ]) {
    if (!validatesLayoutException(item)) {
      diagnostics.push(`${item.file?.replaceAll('\\', '/') ?? '(shared)'}:1: layout exception ${item.name ?? '(unnamed)'} must declare file, property, value, and reason`)
    }
  }

  for (const file of normalizedFiles) {
    const source = stripCommentsKeepingLines(file.content)
    let match
    DECLARATION_PATTERN.lastIndex = 0
    while ((match = DECLARATION_PATTERN.exec(source)) !== null) {
      const property = match[1]
      if (!property.startsWith('--')) continue
      const localDefinitions = definedByFile.get(file.path) ?? new Set()
      localDefinitions.add(property)
      definedByFile.set(file.path, localDefinitions)
      if (globalDefinitionFiles.has(file.path)) globallyDefined.add(property)
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
      const selector = selectorAtIndex(source, match.index + full.indexOf(property))
      const tokenDefinition = property.startsWith('--') && allowsTokenDefinition(
        file.path,
        selector,
        config.tokenDefinitionScopes,
      )
      if (property.startsWith('--')) {
        if (
          generatedTokenNames.has(property)
          && !allowsGeneratedOverride(file.path, selector, config.generatedTokenOverrideScopes)
        ) {
          diagnostics.push(`${file.path}:${line}: central token collision ${property} in selector ${selector}`)
        } else if (
          property.startsWith('--mg-')
          && !matchesEntry(property, config.declarationAllowlist)
        ) {
          diagnostics.push(`${file.path}:${line}: unauthorized token declaration ${property}`)
        }
      }

      let raw
      if (!tokenDefinition) {
        for (const rawColor of findRawColors(value)) {
          if (!matchesEntry(property, config.rawValueTokenAllowlist)) {
            diagnostics.push(`${file.path}:${line}: unauthorized raw color ${rawColor}`)
          }
        }
      }

      const shadowProperty = property === 'box-shadow'
        || property === 'text-shadow'
        || (property === 'filter' && /\bdrop-shadow\s*\(/i.test(value))
      const rawShadow = shadowProperty && !TOKENIZED_SHADOW_PATTERN.test(value.trim())
      if (!tokenDefinition && rawShadow) {
        diagnostics.push(`${file.path}:${line}: unauthorized raw shadow ${value.trim()}`)
      }

      if (!tokenDefinition && !rawShadow && validatesRawLayout(strictLayoutFiles, file.path, property)) {
        RAW_LAYOUT_PATTERN.lastIndex = 0
        while ((raw = RAW_LAYOUT_PATTERN.exec(value)) !== null) {
          const exception = findLayoutConstant(config, file.path, property, raw[0])
          if (exception) {
            usedLayoutConstants.add(exception.name)
          } else {
            diagnostics.push(`${file.path}:${line}: unauthorized layout constant ${raw[0]}`)
          }
        }
      }

      if (validatesRawLayout(strictLayoutFiles, file.path, property)) {
        for (const unsafeMultiplier of findUnsafeTokenMultipliers(value)) {
          diagnostics.push(`${file.path}:${line}: unsafe token multiplier ${unsafeMultiplier}`)
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
        const exception = findLayoutConstant(config, file.path, '@media', raw[0])
        if (exception) {
          usedLayoutConstants.add(exception.name)
        } else {
          diagnostics.push(`${file.path}:${line}: unauthorized layout constant ${raw[0]}`)
        }
      }
    }

    if (strictLayoutFiles.has(file.path)) {
      const containerPattern = /@container\s*([^{}]*)\{/g
      while ((match = containerPattern.exec(source)) !== null) {
        const prelude = match[1]
        const line = lineNumberAt(source, match.index)
        let raw
        RAW_LAYOUT_PATTERN.lastIndex = 0
        while ((raw = RAW_LAYOUT_PATTERN.exec(prelude)) !== null) {
          const exception = findLayoutConstant(config, file.path, '@container', raw[0])
          if (exception) {
            usedLayoutConstants.add(exception.name)
          } else {
            diagnostics.push(`${file.path}:${line}: unauthorized layout constant ${raw[0]}`)
          }
        }
      }
    }
  }

  for (const file of normalizedFiles) {
    const source = stripCommentsKeepingLines(file.content)
    let match
    VARIABLE_USE_PATTERN.lastIndex = 0
    while ((match = VARIABLE_USE_PATTERN.exec(source)) !== null) {
      if (!globallyDefined.has(match[1]) && !definedByFile.get(file.path)?.has(match[1])) {
        diagnostics.push(`${file.path}:${lineNumberAt(source, match.index)}: undefined variable ${match[1]}`)
      }
    }
  }

  for (const item of [
    ...(config.layoutConstants ?? []),
    ...(config.sharedLayoutConstants ?? []),
  ]) {
    if (!usedLayoutConstants.has(item.name)) {
      diagnostics.push(`${item.file?.replaceAll('\\', '/') ?? '(shared)'}:1: named layout constant ${item.name} was not used`)
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
  const discoveredRequiredFiles = (await Promise.all(
    (config.requiredCssDirectories ?? []).map(directory => listCssFiles(projectRoot, directory)),
  )).flat()
  const requiredFiles = [...new Set([
    ...discoveredRequiredFiles,
    ...(config.requiredCssFiles ?? []),
  ])]
  const configuredPolicyFiles = new Set(config.files.map(file => file.replaceAll('\\', '/')))
  const omittedFiles = requiredFiles.filter(file => !configuredPolicyFiles.has(file)).sort()
  if (omittedFiles.length) {
    throw new Error(`UI token policy coverage failed:\n${omittedFiles.map(file => `${file}: not configured`).join('\n')}`)
  }
  const configuredFiles = [...new Set([
    ...config.files,
    ...(config.tokenDefinitionFiles ?? []),
  ])]
  const files = await Promise.all(configuredFiles.map(async relativePath => ({
    path: relativePath,
    content: await readFile(path.join(projectRoot, relativePath), 'utf8'),
  })))
  const discoveredStrictFiles = (await Promise.all(
    (config.strictLayoutDirectories ?? []).map(directory => listCssFiles(projectRoot, directory)),
  )).flat()
  const resolvedConfig = {
    ...config,
    strictLayoutFiles: [...new Set([
      ...(config.strictLayoutFiles ?? []),
      ...discoveredStrictFiles,
      ...(config.strictLayoutFilesRequired ?? []),
    ])],
  }
  const result = verifyUiTokenPolicy({ files, config: resolvedConfig })
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
