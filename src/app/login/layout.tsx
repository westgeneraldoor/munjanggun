import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '문장군 로그인',
  description: '문장군 무료방문 실측견적과 고객 서비스를 이어가기 위한 로그인입니다.',
}

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
