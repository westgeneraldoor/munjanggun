---
document_type: "Platform Task Board"
version: "1.1.0"
status: "active"
last_updated: "2026-06-04"
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

MVP-02는 기능 구현, PM UX 보정, Vercel Preview 실검수가 완료된 상태다.

- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] Playwright 모바일/데스크탑 주요 화면 확인
- [x] 커밋
- [x] 푸시
- [x] Vercel Preview 배포
- [x] 배포 URL에서 로그인 보호, 고객 신청 생성, 어드민 접수 큐 최종 확인

따라서 현재 상태는 `MVP-02 완료`다. GitHub PR 생성과 실제 카카오 계정 callback 확인은 권한/실계정이 필요한 마감 운영 항목으로 별도 추적한다.

## 크리티컬 패스

```text
MVP-01 카카오 로그인
-> MVP-02 무료방문 실측 견적상담 신청 + 어드민 접수 큐
-> MVP-03 담당자 배정 + 접수 상태 관리
-> MVP-04 견적서 작성 + 견적 링크 발송
-> MVP-05 견적 승인 + 결제 전 설문 + 토스페이먼츠 결제
-> MVP-06 결제/견적/시공 이력 대시보드
-> MVP-07 AS 접수
-> MVP-08 시공완료 후기/사진/홍보동의 큐
-> MVP-09 n8n 운영 자동화
-> MVP-10 AppSheet 연동/흡수 전략
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

- [x] `/admin/platform` 접수 큐 구현
- [x] 전체, 신규, 접수완료, 취소 필터 단순화
- [x] 접수 버튼 제공
- [x] 취소 버튼 제공
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

### 검증

- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] Playwright로 고객 신청 모바일 화면 확인
- [x] Playwright로 주소 검색 모달 확인
- [x] Playwright로 어드민 접수 큐 확인
- [x] Playwright로 어드민 설정 화면 확인

### 완료 전 남은 일

- [x] 변경사항 커밋
- [x] GitHub push
- [x] Vercel Preview 배포
- [ ] GitHub PR 생성
- [x] 배포 URL에서 카카오 OAuth 시작 확인
- [ ] 배포 URL에서 실제 카카오 계정 callback 확인
- [x] 배포 URL에서 고객 신청 1건 실제 생성 확인
- [x] 배포 URL에서 어드민 접수완료/취소 상태 저장 확인

검수 기록:

- Preview URL: `https://munjanggun-2owsuqlq0-westgeneraldoors-projects.vercel.app`
- 테스트 고객: `codex-preview-customer@munjanggun.local`
- 테스트 관리자: `codex-preview-administrator@munjanggun.local`
- 테스트 접수 ID: `4a23cca6-5794-423e-8a34-c2f4bb204bd4`
- 테스트 접수명: `Codex Preview Customer 20260604041120`
- 신청 생성 상태: `submitted`
- 어드민 접수완료 저장 후 상태: `appsheet_registered`
- 어드민 취소 저장 후 상태: `cancelled`

## MVP-03 - 담당자 배정 + 접수 상태 관리

상태: 다음 후보

목표: 접수된 신청을 영업 담당자에게 배정하고, 연락, AppSheet 등록, 실측 일정 상태를 관리한다.

- [ ] 담당자 목록/role 확인
- [ ] 미배정 신청 필터
- [ ] 담당자 배정 UI
- [ ] 담당자별 접수 큐
- [ ] 고객 연락 여부 기록
- [ ] 실측 예정일 관리
- [ ] AppSheet 수동 등록 상태 고도화
- [ ] 접수 이벤트 타임라인 표시
- [ ] 영업 담당자 권한 검증
- [ ] 모바일 어드민 사용성 개선

## MVP-04 - 견적서 작성 + 견적 링크 발송

상태: 예정

- [ ] 견적 대분류 템플릿
- [ ] 견적 소분류 템플릿
- [ ] 단가, 수량, 합계 입력
- [ ] 추가 설명 입력
- [ ] 유효기간 입력
- [ ] 담당자 정보 표시
- [ ] 실측일/시공예정일 표시
- [ ] 고객 견적 링크 생성
- [ ] 견적 링크 발송 상태 기록
- [ ] 모바일 견적서 뷰

## MVP-05 - 견적 승인 + 설문 + 토스페이먼츠 결제

상태: 예정

- [ ] 견적 승인 버튼
- [ ] 결제 전 설문
- [ ] 문장군을 선택한 이유 질문
- [ ] 문장군을 알게 된 경로 질문
- [ ] 객관식 버튼 + 직접입력
- [ ] 설문 질문/선택지 어드민 관리
- [ ] 직접입력 응답 정식 선택지 승격
- [ ] 토스페이먼츠 결제
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

상태: 예정

- [ ] AS 접수 로그인 필수
- [ ] 기존 시공 이력 연결
- [ ] AS 접수 폼
- [ ] AS 사진/영상 첨부
- [ ] 어드민 AS 접수 큐
- [ ] AS 상태 관리
- [ ] 하단 플로팅 CTA 재정의

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
