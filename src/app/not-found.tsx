import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mg-root-fallback">
      <h2 className="mg-root-fallback__title">페이지를 찾을 수 없습니다</h2>
      <p className="mg-root-fallback__description">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
      </p>
      <Link href="/" className="mg-root-fallback__action">
        메인으로 돌아가기
      </Link>
    </div>
  )
}
