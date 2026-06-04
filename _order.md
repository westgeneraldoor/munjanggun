# 현재 작업 오더 - MVP-02 마감 정리

발행: 2026-06-04
브랜치: `platform-v1`
PM/실행: Codex
상태: 마감 정리 중

## 목표

MVP-02 무료방문 실측 견적상담 신청과 어드민 접수 큐를 실제 검수 가능한 상태로 마감한다.

이번 오더는 새 기능을 크게 벌리는 작업이 아니라, 사용자가 직접 화면을 보며 지적한 UX 문제를 고치고 문서, 커밋, 배포 흐름까지 정리하는 작업이다.

## 반영해야 할 사용자 피드백

- 고객 포털로 돌아가는 버튼을 명확하게 보이게 한다.
- 신청 전 확인사항은 누를 수 있다는 인식이 생기도록 강조한다.
- 접혀 있는 확인사항은 열었을 때 실제 운영 안내가 충분히 상세해야 한다.
- 충청권 지정요일은 구체적으로 수요일, 토요일 중심 운영이라고 표시한다.
- 주소 검색 모달이 blank일 때 fallback과 안내를 제공한다.
- 상담 희망 내용은 필수가 아니라 선택사항으로 둔다.
- 추천인 입력란을 선택사항으로 추가한다.
- 다크 UI의 폰트 대비와 가독성을 개선한다.
- 플랫폼 화면에서 이모지를 사용하지 않는다.
- 방문시간대 선택 항목은 제거한다.

## 완료 기준

- [x] 고객 신청 화면 UX 보정
- [x] Daum 주소 검색 blank fallback 보정
- [x] 상담 희망 내용 선택사항 처리
- [x] 추천인 필드 추가
- [x] Supabase DB migration 적용
- [x] TypeScript 타입 반영
- [x] 어드민 상세/AppSheet 복사 블록에 추천인 반영
- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] Playwright 주요 화면 확인
- [x] 문서 정리
- [x] 커밋
- [x] 푸시
- [x] Vercel Preview 배포
- [ ] GitHub PR 생성
- [ ] 배포 URL 최종 확인

## 현재 판단

MVP-02는 현재 `완료 후보`다.

배포 URL 검수까지 끝나면 `docs/platform/PLATFORM_TASKS.md`에서 MVP-02를 완료로 바꾼다.

## 배포 상태

- 브랜치: `platform-v1`
- 최신 코드 커밋: `6dcd80b`
- Vercel Preview: `https://munjanggun-9w9i0l6hy-westgeneraldoors-projects.vercel.app`
- 첫 배포 실패 원인: 관리자 페이지가 build 시점에 Supabase env를 요구하며 prerender됨
- 보정: 관리자 서버 페이지를 `force-dynamic`으로 처리
- 두 번째 배포 상태: READY
- 남은 확인: Vercel Preview/Production 환경변수와 실제 로그인 callback

## 다음 오더 후보

MVP-03 담당자 배정 + 접수 상태 관리.

단, 바로 기능을 만들기 전에 어드민 모바일 사용성, 접수 큐의 실제 업무 흐름, AppSheet 수동 등록 화면 동선을 먼저 짧게 점검한다.
