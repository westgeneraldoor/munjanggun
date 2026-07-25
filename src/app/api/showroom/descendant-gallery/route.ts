import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import {
  DESCENDANT_GALLERY_INITIAL_PAGE_SIZE,
  DescendantGallerySnapshotMismatchError,
  loadRenderableDescendantGalleryPage,
  loadRenderableRootDescendantGalleryPage,
} from '@/lib/showroom/descendant-gallery-data'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parsePageNumber(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get('scope')
  const nodeId = request.nextUrl.searchParams.get('nodeId')
  const isRootScope = scope === 'root'
  if (!isRootScope && (!nodeId || !UUID_PATTERN.test(nodeId))) {
    return NextResponse.json({ error: 'Invalid showroom node.' }, { status: 400 })
  }

  const offset = Math.max(0, parsePageNumber(request.nextUrl.searchParams.get('offset'), 0))
  const limit = Math.min(
    24,
    Math.max(1, parsePageNumber(request.nextUrl.searchParams.get('limit'), DESCENDANT_GALLERY_INITIAL_PAGE_SIZE)),
  )
  const snapshot = request.nextUrl.searchParams.get('snapshot')

  try {
    const page = isRootScope
      ? await loadRenderableRootDescendantGalleryPage(offset, limit, snapshot)
      : await loadRenderableDescendantGalleryPage(nodeId!, offset, limit, snapshot)
    return NextResponse.json(page)
  } catch (error) {
    if (error instanceof DescendantGallerySnapshotMismatchError) {
      return NextResponse.json(
        { error: '시공사진 순서가 갱신되었습니다. 목록을 새로 고쳐 주세요.', code: 'gallery_snapshot_stale' },
        { status: 409 },
      )
    }
    logError('Failed to load a descendant showroom gallery page.', error)
    return NextResponse.json(
      { error: '시공사진을 더 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
