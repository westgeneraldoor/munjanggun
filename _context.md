# 프로젝트 컨텍스트

마지막 업데이트: 2026-06-09
현재 오더: MVP-02 접수 경험/통합 큐 보강

## 현재 상태

V2 쇼룸은 `v2-cms` 기준 Public Experience로 유지한다. 현재 브랜치 `platform-v1`에서는 쇼룸을 유지하면서 문장군 플랫폼 MVP를 확장 중이다.

플랫폼 기준 문서는 `docs/platform/`에 있고, 제작 일정 기준은 `docs/platform/PLATFORM_TASKS.md`다.

## 최근 완료

- 고객 요청 상태 체계를 `확정대기/접수확정/수정대기/수정확정/취소대기/취소확정`으로 분리했다.
- 어드민 큐 상태 체계를 `신규접수/접수완료/수정접수/수정완료/취소접수/취소완료`로 분리했다.
- 고객 마이페이지에서 최근 무료견적/A/S 접수에 대해 수정요청, 취소요청을 남길 수 있게 했다.
- 수정/취소 요청은 바로 확정하지 않고 어드민 통합 접수큐에 다시 노출되도록 했다.
- 어드민 `/admin/platform`을 무료실측 + A/S 통합 접수큐로 재구성했다.
- 데스크탑 어드민은 목록 행 선택 시 우측 상세 패널이 바뀌고, 모바일은 같은 상세 구조를 아래에서 확인한다.
- AS 접수 화면에서 급함/연락 선호 방식을 제거하고, 상세 내용 + 사진/동영상 중심으로 단순화했다.
- AS 주소 입력에 Daum 주소 검색과 수동 입력 fallback을 붙이고 주소 메타데이터를 저장한다.
- 포털, 무료견적, AS, 어드민 큐에 route-level loading UI를 추가했다.
- MVP-01 카카오 로그인 기반 구현 및 검수
- MVP-02 고객 포털, 무료방문 실측 견적상담 신청, 어드민 접수 큐 구현
- Supabase `platform` schema, RLS, private media, booking settings 기반 구성
- Daum 주소 검색, 주소 검색 fallback, 방문일 달력, 관심 제품 다중 선택 구현
- 어드민 관심 품목 관리, 예약 가능일 설정, 접수/취소 큐 구현
- 상담 희망 내용 선택사항 처리
- 추천인 선택사항 추가
- 방문시간대 선택 제거
- 신청 전 확인사항 상세 안내 보강
- 고객 신청 화면 다크 UI 가독성 개선
- 플랫폼 화면 이모지 제거
- Playwright로 고객 신청, 주소 검색, 어드민 접수 큐, 어드민 설정 화면 확인
- Vercel 환경변수 정리 및 새 Preview READY 배포
- Preview URL 공개 접근 200 확인
- Preview에서 테스트 고객 신청 1건 생성
- Preview에서 어드민 접수완료/취소 상태 저장 확인
- `npm run lint` 통과
- `npm run build` 통과

## 핵심 결정

- `PLATFORM_STRATEGY.md`는 PRD보다 상위 기준이며, 목적은 쇼핑몰이 아니라 고객 여정 통합이다.
- `PLATFORM_TASKS.md`는 플랫폼 제작 일정과 페이즈의 기준 문서다.
- 기존 쇼룸/CMS는 Public Experience로 유지하고, 플랫폼 고객 데이터는 신규 `platform` 스키마로 분리한다.
- 작업자는 Gemini Flash 3.5 High를 기본으로 두되, 고위험/마감 검수는 Codex가 직접 수행할 수 있다.
- 무료방문 실측 견적상담 신청과 AS 접수는 로그인 필수다.
- 무료실측 신청 주소는 Daum/Kakao 주소 검색 기반으로 받는다.
- 방문 희망일은 어드민 운영설정이 반영된 달력 선택으로 받는다.
- 방문 시간은 고객이 지정하지 않고, 전날 담당 매니저가 동선 기준으로 안내한다.
- 관심 제품 카테고리는 다중 선택이며, 품목은 어드민에서 관리한다.
- 어드민은 실제 운영 엔진이므로 모바일/데스크탑 반응형 품질을 계속 높여야 한다.

## 다음 할 일

1. 로컬/Preview에서 고객 수정요청, 취소요청, 어드민 완료 처리까지 실제 브라우저 검수
2. GitHub PR 생성
3. 실제 카카오 계정 callback 확인
4. MVP-03 담당자 배정 + 접수 상태 관리 논의 시작

## 현재 이슈

- `/admin`은 기존 쇼룸 CMS 입구이며, 플랫폼 어드민은 `/admin/platform`이다.
- MVP-02는 완료 상태다. 커밋, 푸시, Vercel Preview 배포, 배포 URL 실검수까지 완료됐다.
- 이전 실검수 Preview URL은 `https://munjanggun-9wo8h2zla-westgeneraldoors-projects.vercel.app`이다.
- 최신 OAuth callback 보정 Preview URL은 `https://munjanggun-knsqon7og-westgeneraldoors-projects.vercel.app`이다.
- Preview 실검수 접수 ID는 `4a23cca6-5794-423e-8a34-c2f4bb204bd4`이며, 테스트 접수 최종 상태는 `cancelled`다.
- GitHub push는 성공했지만, 로컬 `gh` 토큰 만료로 PR 생성은 아직 못 했다.
- GitHub 커넥터 PR 생성도 권한 403으로 막혔다.
- 어드민 모바일 반응형은 최소 동작은 확인했지만, MVP-03 전에 한 번 더 실제 업무 흐름 기준으로 다듬어야 한다.
- 플랫폼 UI 헌법 문서 `docs/platform/PLATFORM_UI_CONSTITUTION.md`를 추가했다. 고객 접수/마이페이지/어드민 UI 변경 전 반드시 확인한다.
- 무료견적과 A/S처럼 같은 성격의 화면이 다른 프레임/로딩/완료 동선을 갖는 것은 재발 방지 대상이다.
- 2026-06-10 이어서 Supabase 스키마 확인, 성능 advisory 확인, Playwright 관통 검수를 완료했다.
- 최신 테스트 A/S ID: `1aba60c7-b5cb-4a3a-91d3-193ccb07e746`
- 최신 테스트 A/S 최종 상태: 고객 `cancel_confirmed`, 큐 `cancel_done`, 액션 이벤트 4건 기록.
- Playwright 스크린샷: `output/platform-queue-qa/`
- Supabase security advisor는 앱 연결 재인증이 필요해 확인하지 못했다. Performance advisor에서 이번 변경으로 생긴 `processed_by` FK 인덱스 누락은 `platform_processed_by_indexes` 마이그레이션으로 해결했다.
# MVP-02 public entry closeout - 2026-06-04

- Current branch: `platform-v1`.
- Production `https://munjanggun.vercel.app/` is not the latest platform work until the PR/branch is promoted or production is redeployed.
- Use the latest Preview deployment for MVP-02 verification.
- The public showroom floating `무료방문견적` CTA is now the official MVP-02 customer entry and points to `/portal/measure/new`.
- The public showroom top-right auth menu is now part of MVP-02 verification.

# MVP-02 guided intake update - 2026-06-04

- `/portal/measure/new` was redesigned as a guided multi-step intake.
- It captures applicant, primary contact recipient, optional additional contacts, service region, and service-region status.
- Chungcheong limited areas are Cheonan, Asan, Cheongju, Sejong, and Daejeon; these are limited to Wednesday/Saturday visit dates.
- Unsupported service regions are blocked in the UI and by the Supabase trigger.
- Admin detail and AppSheet copy block include contact recipient and service-region information.
- Supabase migration applied: `measurement_contact_region_flow`.
- Local verification passed: lint, build, Seoul test submission, Chungcheong calendar restriction, unsupported-region blocking, admin detail rendering.
- Local smoke test request ID: `fb34508a-9e13-4413-9feb-497d81e7b669`.
- Commit/push done: `24872d6` (`MVP-02 무료견적 접수 UX 고도화`).
- Latest Vercel Preview READY: `https://munjanggun-4oea8j2p9-westgeneraldoors-projects.vercel.app`.
- Branch alias READY: `https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app`.
- Preview unauthenticated route check passed: `/portal/measure/new` redirects to `/login?next=/portal/measure/new`.
- Preview authenticated guided-intake submission still requires a real Kakao/user session because `/api/dev/playwright-login` is not available in Preview.
- Administrator accounts confirmed in Supabase `platform.profiles`: `moon@munjanggun.com`, `west1836@gmail.com`.
- Verified locally with Playwright: logged-out CTA redirect keeps `next=/portal/measure/new`, customer menu, administrator menu, and admin navigation.
- OAuth callback was fixed in `beee460` so Supabase session cookies are written to the final redirect response.

# MVP-07 customer AS intake slice - 2026-06-05

- `/portal` now uses the same white customer-facing tone as the guided free-visit estimate intake.
- `/portal` exposes active entries for `무료방문 실측견적 상담` and `A/S 접수`, while estimate viewing and construction history remain prepared states.
- `/portal/as/new` exists and is login-protected.
- AS intake captures requester, optional separate contact recipient, address, issue type, urgency, preferred contact method, message, privacy consent, and optional image/video media.
- Supabase migration applied live: `platform_as_requests_mvp07`.
- Tables added: `platform.as_requests`, `platform.as_media`; RLS allows customer own-row insert/select and admin/sales select/update where appropriate.
- Local verification passed: `npm run lint`, `npm run build`, Playwright customer login -> portal -> AS intake -> media upload -> submit -> done screen -> recent AS display -> mobile portal.
- Local AS smoke request ID: `90dd7f22-db09-41b1-9026-f2aaa9904654`.
- Remaining MVP-07 work: admin AS queue, AS status management, existing construction-history linkage, public floating CTA decision.
