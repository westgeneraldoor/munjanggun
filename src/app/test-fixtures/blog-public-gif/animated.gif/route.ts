const TWO_FRAME_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICRAEAIfkEAQAAAQAsAAAAAAEAAQAAAgJEADs=',
  'base64',
)

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 })
  }

  return new Response(TWO_FRAME_GIF, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Length': String(TWO_FRAME_GIF.byteLength),
      'Content-Type': 'image/gif',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
