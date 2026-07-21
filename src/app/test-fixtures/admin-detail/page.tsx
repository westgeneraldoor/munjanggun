import { notFound } from 'next/navigation'
import DetailClient from '@/app/admin/platform/[id]/DetailClient'
import { PlatformSelect } from '@/components/platform/ui'

export const dynamic = 'force-dynamic'

export default function AdminDetailFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div data-mg-theme="admin" style={{ minHeight: '100dvh', background: 'var(--mg-surface-page)' }}>
      <DetailClient
      requestId="00000000-0000-4000-8000-000000000001"
      initialCategoryMap={{ middle_door: '중문' }}
      request={{
        id: '00000000-0000-4000-8000-000000000001',
        customer_name: '테스트 고객',
        phone: '000-0000-0000',
        applicant_relationship: '본인',
        contact_name: '테스트 고객',
        contact_phone: '000-0000-0000',
        contact_relationship: '본인',
        additional_contacts: [],
        address: '테스트 주소',
        address_detail: '테스트 상세',
        postcode: '00000',
        road_address: '테스트 도로명 주소',
        jibun_address: null,
        address_extra: null,
        preferred_visit_date: '2026-07-20',
        preferred_visit_time_slot: '오전',
        interest_categories: ['middle_door'],
        is_manual_address: true,
        interest_category: 'middle_door',
        message: '관리자 상세 화면 회귀 검증용 가짜 상담 내용입니다.',
        referrer_name: null,
        service_region: '테스트 권역',
        service_region_status: '확인 필요',
        preferred_schedule: null,
        status: 'contacted',
        appsheet_status: 'pending',
        privacy_agreed_at: '2026-07-16T00:00:00.000Z',
        created_at: '2026-07-16T00:00:00.000Z',
      }}
      media={[{
        id: '00000000-0000-4000-8000-000000000002',
        media_type: 'image',
        file_name: 'fixture-image.jpg',
        file_size: 1024,
      }]}
      />
      <div hidden>
        <PlatformSelect
          label="공용 셀렉트 클래스 계약"
          className="fixture-select-contract"
          options={[{ value: 'ok', label: '확인' }]}
        />
      </div>
    </div>
  )
}
