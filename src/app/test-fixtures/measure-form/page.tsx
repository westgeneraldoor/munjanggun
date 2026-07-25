import { notFound } from 'next/navigation'
import MeasureForm from '@/app/portal/measure/new/MeasureForm'

export const dynamic = 'force-dynamic'

export default function MeasureFormFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MeasureForm userId="00000000-0000-4000-8000-000000000001" />
}
