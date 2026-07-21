import { notFound } from 'next/navigation'
import AdminQueueClient, { type QueueRow } from '@/app/admin/platform/AdminQueueClient'

export const dynamic = 'force-dynamic'

const FIXTURE_ROWS: QueueRow[] = [
  {
    key: 'measurement:queue-fixture',
    sourceType: 'measurement',
    id: 'queue-fixture',
    customerName: '테스트 고객',
    phone: '000-0000-0000',
    address: '테스트 주소',
    summary: '관리자 큐 회귀 검증용 접수',
    message: '실제 고객 정보나 데이터베이스를 사용하지 않는 개발 전용 픽스처입니다.',
    receivedAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    customerStatus: 'confirmation_pending',
    queueStatus: 'new_received',
    customerActionNote: null,
    customerActionRequestedAt: null,
    processedAt: null,
    hasMedia: false,
    sourceLabel: '무료실측',
    contactName: null,
    contactPhone: null,
    contactRelationship: null,
    extraRows: [],
  },
]

export default function AdminQueueFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <AdminQueueClient initialRows={FIXTURE_ROWS} />
}
