# 현재 작업 오더 - MVP-02 마감 정리

발행: 2026-06-04
브랜치: `platform-v1`
PM/실행: Codex
상태: MVP-02 실검수 완료 / PR 생성 대기

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
- [x] Vercel 환경변수 정리
- [x] Vercel Preview 보호 해제 및 공개 접근 확인
- [x] 배포 URL 고객 신청 1건 실제 생성 확인
- [x] 배포 URL 어드민 접수완료/취소 상태 저장 확인
- [ ] GitHub PR 생성
- [x] 배포 URL 최종 확인

## 현재 판단

MVP-02는 현재 `완료`다.

배포 URL에서 테스트 고객 신청 1건 생성, 어드민 큐 노출, 상세 상태 저장으로 `appsheet_registered`와 `cancelled`까지 확인했다. GitHub PR 생성은 로컬 `gh` 토큰 만료와 GitHub 커넥터 권한 403 때문에 별도 권한 조치가 필요하다.

## 배포 상태

- 브랜치: `platform-v1`
- 최신 기능 커밋: `beee460`
- Vercel Preview: `https://munjanggun-knsqon7og-westgeneraldoors-projects.vercel.app`
- 첫 배포 실패 원인: 관리자 페이지가 build 시점에 Supabase env를 요구하며 prerender됨
- 보정: 관리자 서버 페이지를 `force-dynamic`으로 처리
- 최신 배포 상태: READY
- OAuth callback 보정: 세션 교환 쿠키를 최종 redirect 응답에 직접 실어 로그인 후 홈/쇼룸에서 유저메뉴가 유지되도록 수정
- Vercel 환경변수: `platform-v1` Preview Supabase 3종, Production `SUPABASE_SERVICE_ROLE_KEY` 반영
- Vercel Preview 보호: SSO Deployment Protection 해제, 공개 접근 200 확인
- 실제 검수 접수 ID: `4a23cca6-5794-423e-8a34-c2f4bb204bd4`
- 테스트 접수 최종 상태: `cancelled`
- 남은 확인: GitHub PR 생성, 실제 카카오 계정 callback 확인

## 다음 오더 후보

MVP-03 담당자 배정 + 접수 상태 관리.

단, 바로 기능을 만들기 전에 어드민 모바일 사용성, 접수 큐의 실제 업무 흐름, AppSheet 수동 등록 화면 동선을 먼저 짧게 점검한다.
# MVP-02 public entry closeout - 2026-06-04

- Main/showroom floating `무료방문견적` CTA now enters `/portal/measure/new` instead of the external Naver reservation link.
- Customer protected routes now preserve `/login?next=/portal/measure/new`, so login returns to the application flow.
- Public showroom now has a top-right login/user menu. Signed-in customers see `마이페이지` and `무료방문견적 신청`; administrators also see `플랫폼 어드민`.
- `moon@munjanggun.com` and `west1836@gmail.com` are confirmed as `administrator` in `platform.profiles`.
- Local checks passed: `npm run lint`, `npm run build`, and Playwright smoke for logged-out CTA redirect, customer menu, administrator menu, and admin navigation.
- Latest callback fix commit: `beee460`; Preview READY at `https://munjanggun-knsqon7og-westgeneraldoors-projects.vercel.app`.

# MVP-02 guided intake UX closeout - 2026-06-04

- `/portal/measure/new` is now a step-by-step guided intake instead of a long single-page form.
- Customer-facing copy now leads with `무료방문 실측견적 상담은 무료입니다.`
- Applicant, primary contact recipient, and additional contact recipients are captured separately.
- Visit-time copy now explains prior-day 4-5 PM route closeout, direct manager contact, missed-call SMS, and schedule-change handling.
- Cheonan, Asan, Cheongju, Sejong, and Daejeon addresses are restricted to Wednesday/Saturday visit dates.
- Unsupported regions are blocked in the UI and by the Supabase trigger.
- Admin detail and AppSheet copy block now include contact recipient and service-region fields.
- Supabase migration applied: `measurement_contact_region_flow`.
- Local checks passed: `npm run lint`, `npm run build`.
- Local Playwright verified: Seoul test submission, Chungcheong calendar restriction, unsupported-region blocking, and admin detail rendering.
- Local smoke test request ID: `fb34508a-9e13-4413-9feb-497d81e7b669`.
- Next action: commit, push, wait for Vercel Preview READY, then verify Preview `/portal/measure/new`.
