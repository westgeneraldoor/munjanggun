import { NextResponse } from 'next/server'
import { createPlatformAdminClient } from '@/lib/supabase/platform-server'
import { logError } from '@/lib/logger'

export async function GET() {
  try {
    const supabase = createPlatformAdminClient()

    const [{ data: settings, error: settingsError }, { data: overrides, error: overridesError }] =
      await Promise.all([
        supabase
          .from('measurement_booking_settings')
          .select('min_days_out, max_days_out, close_saturday, close_sunday, close_holidays')
          .eq('id', 1)
          .single(),
        supabase
          .from('measurement_date_overrides')
          .select('date, is_closed, source')
          .order('date', { ascending: true }),
      ])

    if (settingsError) {
      logError('Booking config settings fetch error', settingsError)
      return NextResponse.json({ error: '예약 설정을 불러오지 못했습니다.' }, { status: 500 })
    }

    if (overridesError) {
      logError('Booking config overrides fetch error', overridesError)
      return NextResponse.json({ error: '예약 예외 일정을 불러오지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      settings,
      overrides: overrides ?? [],
    })
  } catch (err) {
    logError('Booking config unexpected error', err)
    return NextResponse.json({ error: '예약 설정 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
