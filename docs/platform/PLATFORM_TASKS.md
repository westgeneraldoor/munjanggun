---
document_type: "Platform Task Board"
version: "1.2.0"
status: "active"
last_updated: "2026-07-21"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_prd: "docs/platform/PRD_PLATFORM_v1.0.md"
source_db_rbac: "docs/platform/PLATFORM_DB_RBAC_DESIGN.md"
source_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
---

# PLATFORM_TASKS - 문장군 플랫폼 MVP

## 역할

이 문서는 문장군 플랫폼 제작 일정의 기준 문서다.

`PROJECT_TASKS.md`는 기존 V2 쇼룸 히스토리와 전체 상태 포인터로 유지한다. 플랫폼 개발의 실제 페이즈, 오더 순서, 완료 기준은 이 파일을 우선한다.

핵심 원칙:

- 플랫폼은 쇼핑몰이 아니라 고객 여정 통합 포털이다.
- 고객뷰는 신청, 견적 확인, 결제를 쉽게 만드는 입구다.
- 어드민은 접수, AppSheet 수동 등록, 담당자 배정, 견적, 결제, 후기, AS를 이어주는 실제 운영 엔진이다.
- 문서만 오래 만들지 않는다. 실제 신청과 운영 큐가 돌아가는 화면을 빠르게 검증한다.
- 고객 개인정보, 주소, 현장 사진, 결제, 권한은 MVP라도 대충 만들지 않는다.

## 현재 판단

기존 고객 여정 크리티컬 패스는 유지한다. 다만 2026-07-20 현재 블로그/Content OS와 플랫폼 어드민 안정화 작업은 `v2-cms`를 base로 한 통합 브랜치 `codex/platform-admin-blog-stabilization`에서 아래 상태까지 완료됐다.

- [x] `/blog` 이미지 쇼룸 경험과 블로그 전용 scoped 디자인 시스템 병합 — PR #27, `8280546`
- [x] 관리자 AI 초안 생성 흐름 제거, 메뉴 명칭 `블로그 콘텐츠` 통일 — PR #29, `ca6e5aa`
- [x] 관리자 승인 원고 등록, `reviewing` 시작, 감사 이력, 원자 RPC 병합 — PR #30
- [x] 원격 RPC migration과 `service_role` 전용 실행 권한 확인
- [x] `v2-cms` Preview에서 관리자 로그인·콘텐츠 큐와 공개 `/blog` 응답 확인
- [x] 실제 승인 원고 1건을 `reviewing`으로 등록하고 글·블록·감사 이벤트 확인
- [x] 관리자 편집·저장 미리보기와 사진 연결 확인: 27개 블록, image block 2개, active private media 3개
- [x] 미사용 `mg-3panel-thumbnail-basic-001` 연결을 감사 RPC로 분리하고 중앙 자산 행과 파일 행 3개는 보존
- [x] public Storage 경계 확인: anon 목록 0건, 알려진 public object URL HTTP 200, private signed URL HTTP 200
- [x] 어드민 원자 저장·순서 변경, 미리보기 payload, Storage·lease, 공식 자산 detach migration 원격 적용
- [ ] 실제 원고의 `ready`/`published` 전환 및 미디어 공개 승격. 원고는 `reviewing`, `published_at = null`로 유지한다.

블로그 운영 모델은 확정됐다. Codex가 중앙 브랜드와 블로그 운영 본진을 근거로 완성 원고를 외부에서 작성하고, CMS는 등록·편집·사진 연결·미리보기·발행·이력을 담당한다. 관리자 AI 초안 생성, OpenAI 키, 모델 설정은 다시 도입하지 않는다.

현재 통합 기준점은 `v2-cms`를 base로 한 `codex/platform-admin-blog-stabilization`이며 통합 Draft PR은 [#73](https://github.com/westgeneraldoor/munjanggun/pull/73)이다. Production 배포·공개 글 발행·미디어 공개 승격은 이번 완료 사실에 포함하지 않는다. 어드민·블로그 최종 검증기는 state-scope invariant를 유지하며, 최종 실행 전에는 통과 개수를 임의로 적지 않는다.

## 크리티컬 패스

```text
MVP-01 카카오 로그인
-> MVP-02 무료방문 실측 견적상담 신청 + 어드민 접수 큐
-> MVP-03A n8n/AppSheet 견적·결제 흐름 지도화
-> MVP-03 접수 상태 관리 보강
-> MVP-04 견적/결제 허브 설계
-> MVP-05 결제 경로별 실행: 네이버/일반/플랫폼/split
-> MVP-06 결제/견적/시공 이력 대시보드
-> MVP-07 AS 접수
-> MVP-08 시공완료 후기/사진/홍보동의 큐
-> MVP-09 n8n 운영 자동화
-> MVP-10 AppSheet 연동/흡수 전략
```

블로그/Content OS 병렬 작업선:

```text
외부 완성 원고
-> 관리자 승인 원고 등록(reviewing)
-> 사실·브랜드·사진 검수
-> 관리자 미리보기
-> 발행 승인
-> published 글/미디어만 공개
```

## Phase 0 - 기준선 정리

상태: 완료

- [x] `platform-v1` 브랜치 생성
- [x] 플랫폼 기준 문서 `docs/platform/`로 분리
- [x] `docs/platform/PLATFORM_STRATEGY.md` 최상위 기준 문서화
- [x] `docs/platform/PLATFORM_MIGRATION_AUDIT.md` 작성
- [x] `docs/platform/PRD_PLATFORM_v1.0.md` 기준 문서 승격
- [x] `docs/platform/CODEX_PROJECT_BOOTSTRAP.md` 기준 문서 승격
- [x] `docs/platform/PLATFORM_DB_RBAC_DESIGN.md` 작성
- [x] `docs/platform/PLATFORM_TASKS.md` 플랫폼 전용 태스크 보드화
- [x] 기존 쇼룸/아카이브 문서와 플랫폼 문서 분리

## MVP-01 - 카카오 로그인 기반

상태: 완료

- [x] Supabase `platform` schema 생성
- [x] `platform.profiles`, `platform.staff_profiles` 생성
- [x] 카카오 최초 로그인 시 customer profile 자동 생성
- [x] 관리자, 영업 담당자, 고객 role helper 및 RLS 구성
- [x] 로그인 페이지 구현
- [x] OAuth callback 구현
- [x] 고객 포털 placeholder 구현
- [x] `/portal`, `/manager`, `/admin/platform` 보호
- [x] 기존 쇼룸 CMS `/admin` 회귀 방지
- [x] `platform` Data API 노출 설정 확인
- [x] 로컬 카카오 로그인 및 customer profile 생성 확인
- [x] `npm run lint` 통과
- [x] `npm run build` 통과

## MVP-02 - 무료방문 실측 견적상담 신청 + 어드민 접수 큐

상태: 완료

### 고객 신청

- [x] 로그인 고객만 신청 가능
- [x] 고객 이름 필수
- [x] 휴대폰 번호 필수
- [x] Daum 주소 검색 기반 주소 입력
- [x] 주소 검색 실패/blank 상황에서 수동 입력 fallback 제공
- [x] 상세주소 입력
- [x] 관심 제품 다중 선택
- [x] 관심 제품 최소 1개 필수
- [x] 관심 제품 품목 이미지 표시
- [x] 희망 방문일 달력 선택
- [x] 운영 불가 날짜 비활성화
- [x] 방문시간대 선택 제거
- [x] 상담 희망 내용 선택사항 처리
- [x] 추천인 선택사항 추가
- [x] 개인정보 수집 동의 필수
- [x] 사진 여러 장 업로드 지원
- [x] 동영상 업로드 지원
- [x] 첨부 파일 미리보기와 삭제
- [x] 모바일 390px 기준 주요 입력 흐름 확인
- [x] 고객 포털로 돌아가기 버튼 명확화
- [x] 신청 전 확인사항 버튼형 강조
- [x] 가능 지역, 충청권 지정 요일, 접수 시간, 방문 시간, FAQ 안내 보강
- [x] 이모지 제거
- [x] 다크 UI 가독성 개선

### 어드민 접수 큐

- [x] `/admin/platform` 통합 접수 큐 구현
- [x] 무료방문 실측 접수 표시
- [x] A/S 접수 표시
- [x] 신규접수, 접수완료, 수정접수, 수정완료, 취소접수, 취소완료 필터
- [x] 종류, 접수일시, 고객명, 큐상태, 고객상태 정렬
- [x] 데스크탑 우측 상세 패널
- [x] 모바일 상세 동일 정보 구조
- [x] 큐 완료 처리 버튼 제공
- [x] 신규 주소 필드 표시
- [x] 관심 제품 다중 표시
- [x] 희망 방문일 표시
- [x] 수동 주소 검토 필요 뱃지 표시
- [x] 접수 상세 화면 구현
- [x] 사진/영상 signed URL 뷰어 구현
- [x] AppSheet 복사용 텍스트 블록 제공
- [x] 추천인 정보 AppSheet 복사 블록에 반영

### 어드민 운영 설정

- [x] `/admin/platform/settings` 구현
- [x] 관심 제품 품목 추가
- [x] 품목명 수정
- [x] 품목설명 수정
- [x] 품목이미지 등록
- [x] 품목 활성/비활성
- [x] 품목 순서 변경
- [x] 식별키 직접 입력 제거
- [x] 신청 가능 최소/최대 일수 설정
- [x] 토요일, 일요일, 공휴일 닫기 설정
- [x] 특정 날짜 수동 닫기/열기
- [x] 공휴일 seed 적용

### DB/RLS/Storage

- [x] `platform.measurement_requests` 생성
- [x] `platform.measurement_media` 생성
- [x] `platform.measurement_request_events` 생성
- [x] `platform.measurement_product_categories` 생성
- [x] `platform.measurement_booking_settings` 생성
- [x] `platform.measurement_date_overrides` 생성
- [x] private `measurement-media` bucket 정책 구성
- [x] 고객 본인 신청만 조회 가능
- [x] 관리자는 신청 전체 관리 가능
- [x] 예약 가능일 DB trigger 검증
- [x] 추천인 `referrer_name` 컬럼 추가
- [x] 고객 상태 `customer_request_status` enum 추가
- [x] 어드민 큐 상태 `queue_work_status` enum 추가
- [x] 실측/A/S 요청에 고객 상태, 큐 상태, 고객 요청 메모, 처리자, 처리시각 컬럼 추가
- [x] 통합 액션 이벤트 `platform.request_action_events` 추가
- [x] AS 주소 검색 메타데이터 컬럼 추가

### 고객 마이페이지 / A/S 보강

- [x] 마이페이지 최근 견적상담 수정요청 버튼
- [x] 마이페이지 최근 견적상담 취소요청 버튼
- [x] 마이페이지 최근 A/S 수정요청 버튼
- [x] 마이페이지 최근 A/S 취소요청 버튼
- [x] 고객 요청은 어드민 큐에 수정접수/취소접수로 재노출
- [x] AS 접수 Daum 주소 검색 적용
- [x] AS 급함/확인 우선도 제거
- [x] AS 연락 선호 방식 제거
- [x] AS 사진/동영상 안내 문구 개선

### 검증

- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] Playwright로 고객 신청 모바일 화면 확인
- [x] Playwright로 AS 주소 검색 모달 확인
- [x] Playwright로 고객 수정/취소 요청 확인
- [x] Playwright로 어드민 통합 접수 큐 확인
- [x] Playwright로 어드민 설정 화면 확인
- [x] Playwright로 무료견적/A/S 공통 접수 프레임 확인
- [x] Playwright로 마이페이지 모바일 overflow 없음 확인
- [x] Playwright로 어드민 필터 active-hover 대비 확인

### UI/운영 헌법

- [x] `docs/platform/PLATFORM_UI_CONSTITUTION.md` 추가
- [x] `AGENTS.md`에 플랫폼 UI 헌법 확인 규칙 추가
- [x] 고객 접수 화면 상단바/로딩/완료 동선 공통화
- [x] 어드민 견적 접수 운영설정 명칭 정리
- [x] 어드민 버튼 상태 대비 보정

### 완료 전 남은 일

- [x] 변경사항 커밋
- [x] GitHub push
- [x] Vercel Preview 배포
- [ ] GitHub PR 생성
- [x] 배포 URL에서 카카오 OAuth 시작 확인
- [ ] 배포 URL에서 실제 카카오 계정 callback 확인
- [x] 배포 URL에서 고객 신청 1건 실제 생성 확인
- [x] 배포 URL에서 어드민 접수완료/취소 상태 저장 확인

### Preview 최종 검수 체크리스트

- [ ] 실제 카카오 계정으로 Preview 로그인 callback 확인
- [ ] 고객 무료방문 실측견적 상담 1건 생성
- [ ] 고객 A/S 접수 1건 생성
- [ ] 고객 수정요청 생성
- [ ] 고객 취소요청 생성
- [ ] 관리자 `moon@munjanggun.com` 접수 큐 확인
- [ ] 관리자 `west1836@gmail.com` 접수 큐 확인
- [ ] 어드민 접수완료/수정완료/취소완료 처리 확인
- [ ] 모바일 390px에서 마이페이지/접수/어드민 설정 좌우 overflow 없음 확인
- [ ] 기존 쇼룸 Public Experience 회귀 없음 확인

검수 기록:

- 2026-06-10 보강 검수
  - 로컬 테스트 A/S ID: `1aba60c7-b5cb-4a3a-91d3-193ccb07e746`
  - 최종 고객 상태: `cancel_confirmed`
  - 최종 큐 상태: `cancel_done`
  - 액션 이벤트: 4건
  - 스크린샷: `output/platform-queue-qa/`
  - 통과: AS 신규 접수, 고객 수정요청, 어드민 수정완료, 고객 취소요청, 어드민 취소완료
  - Supabase performance advisor: 이번 변경의 `processed_by` FK 인덱스 누락 해결
  - Supabase security advisor: 앱 연결 재인증 필요로 미확인
- 이전 Preview URL: `https://munjanggun-knsqon7og-westgeneraldoors-projects.vercel.app`
- 최신 Preview URL: `https://munjanggun-p9d8j6thb-westgeneraldoors-projects.vercel.app`
- Branch alias: `https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app`
- 최신 callback 보정 커밋: `beee460`
- 테스트 고객: `codex-preview-customer@munjanggun.local`
- 테스트 관리자: `codex-preview-administrator@munjanggun.local`
- 테스트 접수 ID: `4a23cca6-5794-423e-8a34-c2f4bb204bd4`
- 테스트 접수명: `Codex Preview Customer 20260604041120`
- 신청 생성 상태: `submitted`
- 어드민 접수완료 저장 후 상태: `appsheet_registered`
- 어드민 취소 저장 후 상태: `cancelled`

## MVP-03A - n8n/AppSheet 견적·결제 흐름 지도화

상태: 다음 후보

목표: 플랫폼 견적/결제 기능을 구현하기 전에 현재 AppSheet, n8n, 솔라피 알림톡, HTML 견적서, 네이버/일반/향후 플랫폼 결제 흐름을 지도화한다.

원칙:

- AppSheet는 당분간 견적, 시공, 스펙 등록의 운영 원장이다.
- n8n은 제거 대상이 아니라 핵심 자동화 계층이다.
- 영업부 담당자가 AppSheet와 플랫폼에 같은 견적/시공/스펙을 두 번 입력하게 만들지 않는다.
- 플랫폼 결제만 전제로 하지 않는다.

- [x] `docs/platform/QUOTE_PAYMENT_FLOW_MAP.md` 초안 작성
- [ ] AppSheet에서 n8n으로 넘어가는 실제 payload 예시 확보
- [ ] n8n 기존 워크플로우 단계 지도화
- [ ] 솔라피 알림톡 템플릿 버튼 구조 확인
- [ ] 기존 HTML 견적서 필드 목록 확정
- [ ] 네이버 결제 / 일반 결제 / 플랫폼 결제 / 계약금·잔금 split 분기표 확정
- [ ] 플랫폼이 맡을 역할과 끼어들 위치 결정
- [ ] n8n MCP 연결 필요 영역과 단순 API/Webhook 연동 영역 분리

## MVP-03 - 접수 상태 관리 보강

상태: 보류/재정의 필요

목표: 접수된 신청의 확인필요/확인완료, 수정/취소 요청, AppSheet 반영 여부를 관리한다. 현장 담당자나 코스 배정은 AppSheet가 계속 담당하므로 플랫폼에서 성급하게 담당자 배정 기능을 만들지 않는다.

- [ ] 담당자 배정 필요 여부 재검토
- [ ] 고객 연락 여부 기록
- [ ] 실측 예정일 관리
- [ ] AppSheet 수동 등록 상태 고도화
- [ ] 접수 이벤트 타임라인 표시
- [ ] 영업 담당자 권한 검증
- [ ] 모바일 어드민 사용성 개선

## MVP-04 - 견적/결제 허브 설계

상태: MVP-03A 이후 재설계

원칙: 플랫폼에서 견적서를 처음부터 다시 작성하는 기능은 보류한다. 기존 AppSheet+n8n payload를 활용해 고객 견적/결제 허브를 만들 수 있는지 먼저 검토한다.

- [ ] AppSheet/n8n payload 기반 견적 허브 가능성 판단
- [ ] 기존 HTML 견적서 유지/전환/백업 역할 결정
- [ ] 담당 매니저 카카오톡/전화 연결 방식 확정
- [ ] 고객 로그인 필수 범위 결정
- [ ] 마이페이지 견적 보관 구조 정의
- [ ] 알림톡 버튼을 플랫폼으로 보낼지 단계별 전환안 작성

## MVP-05 - 결제 경로별 실행

상태: MVP-03A 이후 재설계

원칙: 플랫폼 결제만 전제로 하지 않는다. 네이버 결제, 일반/계좌 결제, 플랫폼 결제, 계약금/잔금 split을 함께 다룬다.

- [ ] 결제 경로 `naver` UX 정의
- [ ] 결제 경로 `bank_transfer` UX 정의
- [ ] 결제 경로 `platform` UX 정의
- [ ] 결제 경로 `split` UX 정의
- [ ] 결제/입금 확인필요 큐 정의
- [ ] 결제 전 설문
- [ ] 문장군을 선택한 이유 질문
- [ ] 문장군을 알게 된 경로 질문
- [ ] 객관식 버튼 + 직접입력
- [ ] 설문 질문/선택지 어드민 관리
- [ ] 직접입력 응답 정식 선택지 승격
- [ ] 플랫폼 결제 PG 선택
- [ ] 일반영수증/현금영수증/지출증빙 UX
- [ ] 결제 성공/실패/취소 상태 저장

## MVP-06 - 결제/견적/시공 이력 대시보드

상태: 예정

- [ ] 견적 발송 대기/완료 큐
- [ ] 견적 열람 여부
- [ ] 승인 여부
- [ ] 결제 대기/완료/실패
- [ ] 시공 예정일
- [ ] 담당자별 현황
- [ ] 고객별 시공 이력

## MVP-07 - AS 접수

상태: 고객 접수와 어드민 통합 큐는 MVP-02 보강에 흡수 완료. 기존 시공 이력 연결과 AS 전용 상태 관리는 후속 범위.

- [x] AS 접수 로그인 필수
- [ ] 기존 시공 이력 연결
- [x] AS 접수 폼
- [x] AS 사진/영상 첨부
- [x] 어드민 AS 접수 큐
- [ ] AS 상태 관리 고도화
- [ ] 하단 플로팅 CTA 재정의

진행 기록:

- 2026-06-05: `/portal` 마이페이지를 무료방문 견적상담 화면과 같은 화이트톤으로 재구성했다.
- 2026-06-05: `/portal/as/new` 고객 AS 접수 화면을 추가했다.
- 2026-06-05: `platform.as_requests`, `platform.as_media` 및 RLS를 추가하고 실제 Supabase migration을 적용했다.
- 2026-06-05: Playwright로 고객 로그인, 마이페이지 진입, AS 접수, 사진 첨부, 완료 화면, 마이페이지 최근 AS 표시, 모바일 화면을 검수했다.
- 남은 범위: 어드민 AS 접수 큐, 상태 관리, 기존 시공 이력 연결, 공개 CTA 재정의는 후속 MVP-07 운영 범위로 남긴다.

## MVP-08 - 후기/사진/홍보동의 큐

상태: 예정

- [ ] 후기 요청 대상 큐
- [ ] 요청 보냄/미발송/작성완료 상태
- [ ] 후기 요청 링크 생성
- [ ] 고객 완료 사진 업로드
- [ ] 고객 후기 작성
- [ ] 홍보 활용 동의 UI
- [ ] 동의/미동의 상태 관리
- [ ] n8n 자동화 전환을 위한 이벤트 기록

## MVP-09 - n8n 운영 자동화

상태: 후순위

- [ ] 후기 요청 대기 알림
- [ ] 후기 미응답 리마인드
- [ ] 결제 완료 내부 알림
- [ ] 시공 예정/완료 후속 알림
- [ ] Webhook 호출 이력과 실패 로그

원칙: n8n은 자동화 비서다. 로그인, 결제 원장, 견적 원장, 개인정보 권한 판단은 플랫폼 DB와 서버가 담당한다.

## MVP-10 - AppSheet 연동/흡수 전략

상태: 후순위

- [ ] AppSheet 핵심 테이블 목록 파악
- [ ] 접수/실측/견적/시공/정산 중 연결 우선순위 결정
- [ ] API 연동 가능성 검토
- [ ] CSV export/import 가능성 검토
- [ ] 플랫폼 원장과 AppSheet 원장 경계 정의
- [ ] 단계별 마이그레이션 전략 작성

## 금지 또는 후순위 기능

아래 기능은 문장군 플랫폼 목적과 맞지 않거나 MVP 흐름을 늦추므로 금지 또는 후순위다.

- [ ] 장바구니
- [ ] 쿠폰
- [ ] 포인트
- [ ] 회원 등급
- [ ] 자동 견적 엔진
- [ ] 공개 커뮤니티형 리뷰/댓글
- [ ] 쇼핑몰식 상품 상세/옵션 장바구니
- [ ] 불필요한 랜딩페이지

## PM 체크 규칙

각 Phase 완료 전 PM은 아래를 확인한다.

- [ ] `docs/platform/PLATFORM_STRATEGY.md`와 충돌하지 않는가?
- [ ] 고객이 무료방문 실측 견적상담을 더 쉽게 신청하게 만드는가?
- [ ] 영업 매니저와 관리부의 반복 업무가 줄어드는가?
- [ ] 대표가 운영 상태를 더 잘 보게 하는가?
- [ ] 고객 개인정보, 주소, 현장 사진이 보호되는가?
- [ ] 기존 V2 쇼룸 Public Experience가 깨지지 않는가?
- [ ] 어드민이 모바일에서도 실제로 쓸 수 있는가?
## MVP-02 public entry completion - 2026-06-04

Status: complete.

- [x] Existing showroom bottom floating `무료방문견적` CTA routes to `/portal/measure/new`.
- [x] Protected customer routes preserve `next` when redirecting to `/login`.
- [x] Public showroom top-right login entry is visible when signed out.
- [x] Signed-in customer menu exposes `마이페이지` and `무료방문견적 신청`.
- [x] Signed-in administrator menu exposes `플랫폼 어드민`.
- [x] `moon@munjanggun.com` administrator role confirmed in `platform.profiles`.
- [x] `west1836@gmail.com` administrator role confirmed in `platform.profiles`.
- [x] Local Playwright smoke verified logged-out CTA redirect, customer menu, administrator menu, and admin navigation.

## MVP-02 guided intake UX closeout - 2026-06-04

Status: complete locally, ready for Preview deployment verification after push.

- [x] `/portal/measure/new` changed from one long form to a step-by-step guided intake.
- [x] Core reassurance copy uses `무료방문 실측견적 상담은 무료입니다.`
- [x] Applicant and contact recipient can be different people.
- [x] Additional contact recipients are supported for landlord/tenant/spouse cases.
- [x] Visit-time guidance explains the prior-day 4-5 PM route closeout and direct contact flow.
- [x] Cheonan, Asan, Cheongju, Sejong, and Daejeon are limited to Wednesday/Saturday visit dates.
- [x] Unsupported service regions are blocked before submission.
- [x] Contact recipient and service-region fields are saved to Supabase.
- [x] Admin detail and AppSheet copy block include contact recipient and service-region details.
- [x] Database trigger blocks unsupported regions and invalid Chungcheong weekdays.
- [x] Local Playwright smoke verified Seoul submission, Chungcheong calendar restriction, unsupported-region blocking, and admin detail rendering.
