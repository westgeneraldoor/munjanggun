# 현재 작업 오더 - MVP-02 접수 경험/통합 큐 보강

발행: 2026-06-09
브랜치: `platform-v1`
PM/실행: Codex
상태: 구현 및 로컬 실검수 완료 / 커밋·푸시 대기

## 목표

고객이 무료방문견적/A/S 접수 이후 수정요청과 취소요청을 할 수 있고, 어드민은 실측과 A/S를 한곳의 접수큐에서 처리할 수 있게 만든다.

## 반영해야 할 사용자 피드백

- 고객 상태는 `확정대기`, `접수확정`, `수정대기`, `수정확정`, `취소대기`, `취소확정`으로 보인다.
- 어드민 접수큐 상태는 `신규접수`, `접수완료`, `수정접수`, `수정완료`, `취소접수`, `취소완료`로 보인다.
- 고객 수정/취소 요청은 어드민 접수큐에 다시 떠야 한다.
- 처리자는 누가 언제 조치했는지 기록되어야 한다.
- 접수큐는 무료실측, A/S, 이후 결제 링크 흐름까지 한 영역에서 필터링 가능한 구조로 간다.
- 데스크탑은 목록을 보면서 행을 누르면 우측 상세가 바뀐다.
- 모바일 상세 구성은 데스크탑 우측 상세와 같은 정보 구조를 쓴다.
- AS 접수는 Daum 주소검색을 사용한다.
- AS 접수에서 급함/확인 우선도와 연락 선호 방식은 제거한다.
- AS 사진/동영상은 필수는 아니지만 정확한 상담에 도움이 된다는 식으로 안내한다.
- 버튼/화면 전환의 느린 체감을 줄인다.

## 완료 기준

- [x] Supabase DB migration 작성
- [x] Supabase DB migration 라이브 적용
- [x] TypeScript 타입 반영
- [x] 고객 수정/취소 요청 API 추가
- [x] 어드민 큐 완료 처리 API 추가
- [x] 마이페이지 수정요청/취소요청 UI 추가
- [x] AS 접수 UX/문구/주소검색 개선
- [x] 어드민 통합 접수큐 구현
- [x] 데스크탑 우측 상세 패널 구현
- [x] 큐 필터/정렬 구현
- [x] route-level loading UI 추가
- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] 문서 정리
- [x] Playwright 주요 화면 확인
- [ ] 커밋
- [ ] 푸시
- [ ] Vercel Preview 배포
- [ ] GitHub PR 생성

## 현재 판단

이번 보강 구현은 `npm run lint`, `npm run build`, 로컬 Playwright 관통 검수를 통과했다. AS 신규 접수, 고객 수정요청, 어드민 수정완료, 고객 취소요청, 어드민 취소완료까지 확인했다.

## 배포 상태

- 브랜치: `platform-v1`
- 이번 보강은 아직 커밋/푸시/Preview 배포 전이다.
- 이전 READY Preview와 Branch alias는 과거 MVP-02 검수 기록으로만 본다.
- 로컬 테스트 A/S ID: `1aba60c7-b5cb-4a3a-91d3-193ccb07e746`
- 테스트 최종 상태: 고객 `cancel_confirmed`, 큐 `cancel_done`, 액션 이벤트 4건
- Playwright 스크린샷: `output/platform-queue-qa/`
- Supabase security advisor는 앱 연결 재인증이 필요해 아직 확인하지 못했다.

## 다음 오더 후보

1. 커밋
2. 푸시
3. Vercel Preview 배포 확인
4. Preview에서 실제 카카오 계정 기준 핵심 화면 확인
5. 이후 MVP-03 담당자 배정 + 상태 관리 논의
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
- Commit/push done: `24872d6` (`MVP-02 무료견적 접수 UX 고도화`).
- Vercel Preview READY: `https://munjanggun-4oea8j2p9-westgeneraldoors-projects.vercel.app`.
- Branch alias READY: `https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app`.
- Preview unauthenticated `/portal/measure/new` correctly redirects to `/login?next=/portal/measure/new`.
- Preview dev smoke login route is intentionally unavailable (`/api/dev/playwright-login` returns 404), so authenticated Preview intake submission requires real Kakao/user session.
- Remaining manual check: real Kakao login on Preview, create one guided intake request, confirm admin receive/cancel once more if needed.

# MVP-07 customer AS intake slice - 2026-06-05

- `/portal` 마이페이지를 무료방문 견적상담 화면과 같은 화이트톤으로 재구성했다.
- `/portal`에서 `무료방문 실측견적 상담`, `A/S 접수`, `견적서 확인`, `시공/A/S 이력` 진입을 명확히 분리했다.
- `/portal/as/new` 고객 AS 접수 화면을 추가했다.
- AS 접수는 로그인 필수이며 접수자/연락받을 사람, 주소, 증상 유형, 우선도, 연락 선호 방식, 상세 내용, 선택 사진/동영상 첨부를 받는다.
- Supabase migration applied: `platform_as_requests_mvp07`.
- DB tables added: `platform.as_requests`, `platform.as_media`.
- Local checks passed: `npm run lint`, `npm run build`.
- Local Playwright verified: customer dev login, portal desktop, AS intake flow, optional media upload, done screen, recent AS display on portal, portal mobile.
- Local AS smoke request ID: `90dd7f22-db09-41b1-9026-f2aaa9904654`.
- Screenshots: `output/as-portal-qa/`.
- Remaining MVP-07 scope: admin AS queue, AS status management, existing construction-history linkage, public floating CTA decision.
