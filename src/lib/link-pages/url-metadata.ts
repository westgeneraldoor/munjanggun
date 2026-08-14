import 'server-only'

import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest, type RequestOptions } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'

const REQUEST_TIMEOUT_MS = 5_000
const MAX_REDIRECTS = 3
const MAX_RESPONSE_BYTES = 512 * 1024
const MAX_DNS_ANSWERS = 16
const MAX_URL_LENGTH = 2_048
const MAX_TITLE_LENGTH = 200

const BLOCKED_HOSTNAMES = new Set([
  'instance-data',
  'instance-data.ec2.internal',
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.home.arpa',
  '.internal',
  '.local',
  '.localhost',
]

const blockedIpv4Addresses = new BlockList()
const blockedIpv6Addresses = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6')
}

type IpFamily = 4 | 6

type ResolvedAddress = {
  address: string
  family: IpFamily
}

type FetchedDocument = {
  body: string
  finalUrl: URL
}

type RequestResult =
  | { kind: 'document'; body: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'blocked' }

export type UrlMetadataResult = {
  title?: string
  imageUrl?: string
  faviconUrl?: string
  status: 'found' | 'empty' | 'blocked'
}

export type ParsedUrlMetadata = Omit<UrlMetadataResult, 'status'>

class MetadataRequestBlockedError extends Error {}

function ipFamilyName(family: IpFamily) {
  return family === 4 ? 'ipv4' : 'ipv6'
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

function isBlockedHostname(hostname: string) {
  return BLOCKED_HOSTNAMES.has(hostname)
    || BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

function isPublicAddress(address: string, family = isIP(address)): address is string {
  if (family !== 4 && family !== 6) return false
  return family === 4
    ? !blockedIpv4Addresses.check(address, 'ipv4')
    : !blockedIpv6Addresses.check(address, 'ipv6')
}

function parseTarget(value: string) {
  if (!value || value.length > MAX_URL_LENGTH) throw new MetadataRequestBlockedError()

  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new MetadataRequestBlockedError()
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new MetadataRequestBlockedError()
  if (target.username || target.password) throw new MetadataRequestBlockedError()
  if ((target.protocol === 'http:' && target.port && target.port !== '80')
    || (target.protocol === 'https:' && target.port && target.port !== '443')) {
    throw new MetadataRequestBlockedError()
  }

  const hostname = normalizeHostname(target.hostname)
  if (!hostname || isBlockedHostname(hostname)) throw new MetadataRequestBlockedError()

  const literalFamily = isIP(hostname)
  if (literalFamily && !isPublicAddress(hostname, literalFamily)) throw new MetadataRequestBlockedError()

  target.hash = ''
  return target
}

async function withDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new MetadataRequestBlockedError()

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new MetadataRequestBlockedError()), remaining)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function resolvePublicAddress(target: URL, deadline: number): Promise<ResolvedAddress> {
  const hostname = normalizeHostname(target.hostname)
  const literalFamily = isIP(hostname)
  if (literalFamily === 4 || literalFamily === 6) {
    if (!isPublicAddress(hostname, literalFamily)) throw new MetadataRequestBlockedError()
    return { address: hostname, family: literalFamily }
  }

  let answers: Array<{ address: string; family: number }>
  try {
    answers = await withDeadline(lookup(hostname, { all: true, verbatim: true }), deadline)
  } catch {
    throw new MetadataRequestBlockedError()
  }

  if (!Array.isArray(answers) || answers.length === 0 || answers.length > MAX_DNS_ANSWERS) {
    throw new MetadataRequestBlockedError()
  }

  const resolved = answers.map(({ address, family }) => ({ address, family }))
  if (resolved.some(({ address, family }) => !isPublicAddress(address, family))) {
    throw new MetadataRequestBlockedError()
  }

  const selected = resolved[0]
  if (!selected || (selected.family !== 4 && selected.family !== 6)) throw new MetadataRequestBlockedError()
  return selected as ResolvedAddress
}

function makePinnedLookup(resolved: ResolvedAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: resolved.address, family: resolved.family }])
      return
    }
    callback(null, resolved.address, resolved.family)
  }
}

function isPinnedRemoteAddress(remoteAddress: string | undefined, resolved: ResolvedAddress) {
  if (!remoteAddress || !isPublicAddress(remoteAddress)) return false
  const allowed = new BlockList()
  allowed.addAddress(resolved.address, ipFamilyName(resolved.family))
  const remoteFamily = isIP(remoteAddress)
  return (remoteFamily === 4 || remoteFamily === 6)
    && allowed.check(remoteAddress, ipFamilyName(remoteFamily))
}

function getSingleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function readHtmlResponse(response: IncomingMessage, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const contentType = (getSingleHeader(response.headers['content-type']) ?? '').split(';', 1)[0]?.trim().toLowerCase()
    const contentEncoding = (getSingleHeader(response.headers['content-encoding']) ?? 'identity').trim().toLowerCase()
    const contentLength = Number.parseInt(getSingleHeader(response.headers['content-length']) ?? '', 10)

    if ((contentType !== 'text/html' && contentType !== 'application/xhtml+xml')
      || (contentEncoding !== '' && contentEncoding !== 'identity')
      || (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES)) {
      response.destroy()
      reject(new MetadataRequestBlockedError())
      return
    }

    const chunks: Buffer[] = []
    let totalBytes = 0
    let settled = false

    const fail = () => {
      if (settled) return
      settled = true
      response.destroy()
      reject(new MetadataRequestBlockedError())
    }

    const onAbort = () => fail()
    signal.addEventListener('abort', onAbort, { once: true })

    response.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += bytes.length
      if (totalBytes > MAX_RESPONSE_BYTES) {
        fail()
        return
      }
      chunks.push(bytes)
    })
    response.once('aborted', fail)
    response.once('error', fail)
    response.once('end', () => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      resolve(Buffer.concat(chunks, totalBytes).toString('utf8'))
    })
  })
}

function requestTarget(target: URL, resolved: ResolvedAddress, signal: AbortSignal): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      agent: false,
      family: resolved.family,
      headers: {
        Accept: 'text/html, application/xhtml+xml;q=0.9',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Munjanggun-Link-Metadata/1.0',
      },
      lookup: makePinnedLookup(resolved),
      method: 'GET',
      signal,
      servername: normalizeHostname(target.hostname),
    }

    const request = target.protocol === 'https:'
      ? httpsRequest(target, options)
      : httpRequest(target, options)

    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      request.destroy()
      reject(new MetadataRequestBlockedError())
    }

    request.once('error', fail)
    request.once('socket', (socket) => {
      socket.once('connect', () => {
        if (!isPinnedRemoteAddress(socket.remoteAddress, resolved)) fail()
      })
    })
    request.once('response', async (response) => {
      if (settled) {
        response.destroy()
        return
      }

      const status = response.statusCode ?? 0
      if ([301, 302, 303, 307, 308].includes(status)) {
        settled = true
        const location = getSingleHeader(response.headers.location)
        response.destroy()
        resolve(location ? { kind: 'redirect', location } : { kind: 'blocked' })
        return
      }

      if (status < 200 || status >= 300) {
        settled = true
        response.destroy()
        resolve({ kind: 'blocked' })
        return
      }

      try {
        const body = await readHtmlResponse(response, signal)
        if (settled) return
        settled = true
        resolve({ kind: 'document', body })
      } catch {
        fail()
      }
    })
    request.end()
  })
}

async function fetchDocument(input: string): Promise<FetchedDocument> {
  const controller = new AbortController()
  const deadline = Date.now() + REQUEST_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let target = parseTarget(input)
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      if (controller.signal.aborted || Date.now() >= deadline) throw new MetadataRequestBlockedError()
      const resolved = await resolvePublicAddress(target, deadline)
      const result = await withDeadline(requestTarget(target, resolved, controller.signal), deadline)

      if (result.kind === 'blocked') throw new MetadataRequestBlockedError()
      if (result.kind === 'document') return { body: result.body, finalUrl: target }
      if (redirectCount === MAX_REDIRECTS) throw new MetadataRequestBlockedError()

      let redirected: URL
      try {
        redirected = new URL(result.location, target)
      } catch {
        throw new MetadataRequestBlockedError()
      }
      target = parseTarget(redirected.toString())
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }

  throw new MetadataRequestBlockedError()
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }

  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, code: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(code, 16))
      } catch {
        return ''
      }
    })
    .replace(/&#(\d+);?/g, (_match, code: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(code, 10))
      } catch {
        return ''
      }
    })
    .replace(/&([a-z]+);/gi, (match, entity: string) => named[entity.toLowerCase()] ?? match)
}

function cleanText(value: string | undefined) {
  if (!value) return undefined
  const cleaned = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.slice(0, MAX_TITLE_LENGTH) : undefined
}

function parseAttributes(tag: string) {
  const attributes = new Map<string, string>()
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(tag))) {
    const name = match[1]?.toLowerCase()
    if (!name || name === 'meta' || name === 'link') continue
    attributes.set(name, decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? ''))
  }
  return attributes
}

function normalizeMetadataUrl(value: string | undefined, baseUrl: URL) {
  if (!value || value.length > MAX_URL_LENGTH) return undefined
  try {
    const target = parseTarget(new URL(decodeHtmlEntities(value.trim()), baseUrl).toString())
    return target.toString()
  } catch {
    return undefined
  }
}

export function parseUrlMetadataDocument(html: string, finalUrl: URL): ParsedUrlMetadata {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)(?:<\/head>|$)/i)?.[1] ?? html.slice(0, MAX_RESPONSE_BYTES)
  let openGraphTitle: string | undefined
  let openGraphImage: string | undefined
  let faviconHref: string | undefined

  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag)
    const key = (attributes.get('property') ?? attributes.get('name') ?? '').trim().toLowerCase()
    const content = attributes.get('content')
    if (!openGraphTitle && key === 'og:title') openGraphTitle = content
    if (!openGraphImage && (key === 'og:image' || key === 'og:image:url')) openGraphImage = content
  }

  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag)
    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/)
    if (!faviconHref && rel.includes('icon')) faviconHref = attributes.get('href')
  }

  const documentTitle = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return {
    title: cleanText(openGraphTitle) ?? cleanText(documentTitle),
    imageUrl: normalizeMetadataUrl(openGraphImage, finalUrl),
    faviconUrl: normalizeMetadataUrl(faviconHref, finalUrl),
  }
}

export async function fetchUrlMetadata(input: string): Promise<UrlMetadataResult> {
  try {
    const document = await fetchDocument(input)
    const metadata = parseUrlMetadataDocument(document.body, document.finalUrl)
    return Object.values(metadata).some(Boolean)
      ? { ...metadata, status: 'found' }
      : { status: 'empty' }
  } catch {
    return { status: 'blocked' }
  }
}
