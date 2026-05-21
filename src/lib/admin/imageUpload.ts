export function getCompressedImageMimeType(fileType: string) {
  if (fileType === 'image/png') {
    return 'image/png'
  }

  if (fileType === 'image/webp') {
    return 'image/webp'
  }

  return 'image/jpeg'
}
