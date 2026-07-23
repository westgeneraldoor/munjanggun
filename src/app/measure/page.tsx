import type { Metadata } from 'next'
import MeasureExperience from './MeasureExperience'

export const metadata: Metadata = {
  title: '무료방문 실측견적 | 문장군',
  description: '문장군 무료 방문 실측으로 집의 구조와 마감, 시공 가능 조건을 먼저 확인하고 집에 맞는 선택을 함께 좁혀드립니다.',
}

export default function MeasureLandingPage() {
  return <MeasureExperience />
}
