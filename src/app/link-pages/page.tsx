import type { Metadata } from 'next'
import { LinkPageStudio } from '@/components/link-pages/LinkPageStudio'

export const metadata: Metadata = {
  title: '문장군 링크 페이지 편집기',
  description: '영업 상담 자료 페이지를 제작하는 프로토타입',
}

export default function LinkPagesPage() {
  return <LinkPageStudio />
}
