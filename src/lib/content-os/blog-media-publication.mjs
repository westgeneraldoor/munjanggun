import sharp from 'sharp'

const MAX_PUBLIC_GIF_BYTES = 20 * 1024 * 1024

function hasGifMagic(buffer) {
  if (buffer.byteLength < 6) return false
  const signature = buffer.subarray(0, 6).toString('ascii')
  return signature === 'GIF87a' || signature === 'GIF89a'
}

export async function prepareBlogMediaForPublication(source, declaredMimeType) {
  const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source)
  const normalizedMimeType = String(declaredMimeType || '').split(';', 1)[0].trim().toLowerCase()
  const gifByBytes = hasGifMagic(buffer)

  if (gifByBytes || normalizedMimeType === 'image/gif') {
    if (!gifByBytes || normalizedMimeType !== 'image/gif') {
      throw new Error('GIF bytes and the declared MIME type do not match.')
    }
    if (buffer.byteLength > MAX_PUBLIC_GIF_BYTES) {
      throw new Error('Animated GIF files must be 20MB or smaller for public playback.')
    }

    const metadata = await sharp(buffer, { animated: true, failOn: 'error' }).metadata()
    if (metadata.format !== 'gif') throw new Error('The public GIF could not be decoded.')

    return {
      buffer,
      contentType: 'image/gif',
      extension: 'gif',
      originalAnimationPreserved: true,
    }
  }

  const publicWebp = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .webp({ quality: 84, effort: 4 })
    .toBuffer()

  return {
    buffer: publicWebp,
    contentType: 'image/webp',
    extension: 'webp',
    originalAnimationPreserved: false,
  }
}
