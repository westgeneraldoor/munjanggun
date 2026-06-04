# 프로젝트 컨텍스트

마지막 업데이트: 2026-06-04
현재 오더: MVP-02 마감 정리

## 현재 상태

V2 쇼룸은 `v2-cms` 기준 Public Experience로 유지한다. 현재 브랜치 `platform-v1`에서는 쇼룸을 유지하면서 문장군 플랫폼 MVP를 확장 중이다.

플랫폼 기준 문서는 `docs/platform/`에 있고, 제작 일정 기준은 `docs/platform/PLATFORM_TASKS.md`다.

## 최근 완료

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

1. GitHub PR 생성
2. 실제 카카오 계정 callback 확인
3. 신규 세션에서 MVP-03 담당자 배정 + 접수 상태 관리 논의 시작

## 현재 이슈

- `/admin`은 기존 쇼룸 CMS 입구이며, 플랫폼 어드민은 `/admin/platform`이다.
- MVP-02는 완료 상태다. 커밋, 푸시, Vercel Preview 배포, 배포 URL 실검수까지 완료됐다.
- 이전 실검수 Preview URL은 `https://munjanggun-9wo8h2zla-westgeneraldoors-projects.vercel.app`이다.
- 최신 OAuth callback 보정 Preview URL은 `https://munjanggun-knsqon7og-westgeneraldoors-projects.vercel.app`이다.
- Preview 실검수 접수 ID는 `4a23cca6-5794-423e-8a34-c2f4bb204bd4`이며, 테스트 접수 최종 상태는 `cancelled`다.
- GitHub push는 성공했지만, 로컬 `gh` 토큰 만료로 PR 생성은 아직 못 했다.
- GitHub 커넥터 PR 생성도 권한 403으로 막혔다.
- 어드민 모바일 반응형은 최소 동작은 확인했지만, MVP-03 전에 한 번 더 실제 업무 흐름 기준으로 다듬어야 한다.
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
- Administrator accounts confirmed in Supabase `platform.profiles`: `moon@munjanggun.com`, `west1836@gmail.com`.
- Verified locally with Playwright: logged-out CTA redirect keeps `next=/portal/measure/new`, customer menu, administrator menu, and admin navigation.
- OAuth callback was fixed in `beee460` so Supabase session cookies are written to the final redirect response.
