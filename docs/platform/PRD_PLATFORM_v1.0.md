---
document_type: "Platform PRD"
version: "1.0.0"
status: "canonical"
last_updated: "2026-05-30"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_tasks: "docs/platform/PLATFORM_TASKS.md"
source_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
source_db_rbac: "docs/platform/PLATFORM_DB_RBAC_DESIGN.md"
source_audit: "docs/platform/PLATFORM_MIGRATION_AUDIT.md"
current_public_experience_prd: "docs/showroom/PRD_v2.0.md"
legacy_public_experience_prd: "docs/showroom/PRD_v1.1.md"
agent_bootstrap: "docs/platform/CODEX_PROJECT_BOOTSTRAP.md"
---

# 문장군 플랫폼 v1.0

## 프로젝트 정의

문장군 플랫폼은 디지털 쇼룸의 후속 버전이 아니다.

문장군 플랫폼은 기존 디지털 쇼룸을 기반으로 확장되는 고객 포털(Customer Portal)이다.

목표는 고객이

무료방문견적 신청
→ 상담
→ 견적
→ 결제
→ 시공
→ A/S

까지의 전 과정을 하나의 플랫폼에서 처리할 수 있도록 만드는 것이다.

---

# Repository Strategy

Repository:
westgeneraldoor/munjanggun

Base Branch:
v2-cms

New Branch:
platform-v1

중요:

기존 프로젝트를 폐기하지 않는다.

기존 디지털 쇼룸은 플랫폼의 Public Experience 영역으로 유지한다.

노드 CMS 시스템은 플랫폼의 핵심 엔진으로 계승한다.

신규 레포 생성 및 전체 재작성은 현재 범위에서 금지한다.

---

# Core Principles

## Principle 1

문장군 플랫폼은 쇼핑몰이 아니다.

고객 포털(Customer Portal)이다.

---

## Principle 2

문장군의 핵심 자산은 상품이 아니라 무료방문견적 프로세스이다.

모든 기능은 제품 중심이 아니라 고객 여정 중심으로 설계한다.

---

## Principle 3

기존 디지털 쇼룸은 플랫폼의 일부다.

외부 링크로 분리하지 않는다.

---

## Principle 4

URL은 권한이 아니다.

모든 고객 데이터는 인증 및 권한 검증을 통과해야 한다.

---

## Principle 5

AI가 운영하는 시스템이 아니라 사람이 운영 가능한 시스템을 만든다.

코드 수정 없이 운영 가능한 CMS 우선.

---

## Principle 6

어드민이 진짜 운영 엔진이다.

고객뷰는 신청, 견적 확인, 결제를 쉽게 만드는 입구다.

하지만 실제 사내 운영은 어드민에서 접수 확인, AppSheet 수동 등록, 담당자 배정, 견적서 작성, 링크 발송, 결제 확인, 후기 요청, AS 접수 처리로 이어진다.

어드민은 데스크탑뿐 아니라 모바일에서도 반응형으로 쓸 수 있어야 한다.

---

# Architectural Constraints

## Frontend

* Next.js App Router
* React
* TypeScript Strict Mode

## Backend

* Supabase

  * PostgreSQL
  * Auth
  * Storage

## Payment

* 토스페이먼츠

## Hosting

* Vercel

## Styling

* CSS Variables 기반 디자인 토큰
* Tailwind 사용 금지

## Design System

* 기존 munjanggun 쇼룸 디자인 시스템 계승
* 기존 토큰 최대 활용

---

# User Roles

## Customer

고객

## Sales Manager

영업 매니저

## Administrator

관리자

---

# RBAC

| 기능       | 고객 | 영업매니저 | 관리자 |
| -------- | -- | ----- | --- |
| 로그인      | O  | O     | O   |
| 무료방문견적 신청 | O  | -     | -   |
| 실측 조회    | 본인 | 담당 고객 | 전체  |
| 담당자 배정   | -  | -     | O   |
| 견적 생성    | -  | O     | O   |
| 견적 수정    | -  | 담당 건  | O   |
| 견적 조회    | 본인 | 담당 건  | 전체  |
| 결제       | O  | -     | -   |

---

# MVP Scope

## MVP-01

카카오 로그인 기반

* 카카오
* 이름 필수
* 휴대폰 번호 필수
* 기본 role: `customer`
* Google/Naver 간편로그인은 후속 확장

---

## MVP-02

무료방문견적 신청 + 어드민 접수 큐

고객 입력:

* 이름
* 연락처
* 주소
* 제품군
* 희망 일정
* 현장 사진 여러 장 선택 첨부
* 현장 동영상 첨부

정책:

* 로그인 필수
* 사진/영상은 선택사항
* 사진/영상은 private storage
* 고객은 본인 신청만 조회

어드민:

* 신규 접수 큐
* 접수 상세
* AppSheet 수동 등록에 필요한 정보 확인
* 고객 정보 복사/확인 편의 UI
* 모바일/데스크탑 반응형

상태:

접수대기
→ AppSheet 등록대기
→ AppSheet 등록완료
→ 담당자배정
→ 실측예정
→ 실측완료

---

## MVP-03

담당자 배정 + 접수 상태 관리

관리자는 접수 건을 담당 매니저에게 배정한다.

영업 매니저는 담당 고객 큐를 확인하고 연락, 실측 일정, 상담 메모, 상태 변경을 관리한다.

---

## MVP-04

견적서 작성 + 견적 링크 발송

영업 매니저는

* 견적 대분류
* 견적 소분류
* 단가
* 수량
* 합계
* 추가 설명
* 유효기간
* 담당자 정보
* 실측일/시공예정일

를 입력하여 견적을 생성한다.

대분류/소분류는 매번 새로 쓰지 않고 어드민 템플릿에서 선택한다.

복잡한 옵션 계산기와 자동견적은 후속 검토다.

---

## MVP-05

견적 승인 + 결제 전 설문 + 토스페이먼츠 결제

URL 예시:

/quote/{quoteId}

정책:

* 고객 본인만 조회
* 로그인 필수
* 담당 매니저 조회 가능
* 관리자 조회 가능
* 링크 만료 없음
* 결제 후에도 보관
* 고객이 견적 승인 후 결제 진행

결제 전 설문:

* 문장군을 선택한 이유
* 문장군을 알게 된 경로
* 객관식 버튼 + 직접입력
* 질문/선택지는 어드민에서 추가/삭제 가능
* 반복 직접입력은 정식 선택지로 승격 가능

결제:

* 토스페이먼츠
* 일반영수증/현금영수증/지출증빙 UX 고려

---

## MVP-06

결제/견적/시공 이력 대시보드

어드민은 아래 상태를 확인한다.

* 견적 작성중
* 견적 발송
* 견적 열람
* 견적 승인
* 결제 대기
* 결제 완료
* 증빙 상태
* 시공 예정일
* 담당자별 처리 현황

---

## MVP-07

AS 접수

* 로그인 필수
* 기존 시공 이력 연결
* AS 사진/영상 첨부
* 어드민 AS 접수 큐
* AS 상태 관리

---

## MVP-08

시공완료 후기/사진/홍보동의 큐

* 후기 요청 대상 리스트
* 후기 요청 링크 생성
* 링크 토큰으로 간편 작성
* 민감한 시공/결제 내역은 로그인 후 표시
* 시공완료 사진 업로드
* 짧은 후기 작성
* 홍보 활용 동의
* 동의 상태 관리

---

## MVP-09

n8n 운영 자동화 연결

* 후기 요청 대기 알림
* 후기 미응답 리마인드
* 결제 완료 후 내부 알림
* 시공 예정/완료 이벤트 후속 알림

n8n은 자동화 비서이며, 로그인/견적/결제/개인정보 권한의 원장이 아니다.

---

## MVP-10

AppSheet 연동/흡수 전략

MVP에서는 AppSheet 수동 등록을 유지한다.

장기적으로 AppSheet의 접수, 실측, 제작, 발주, 시공, 정산 등 운영 데이터를 플랫폼과 어떻게 연결하거나 흡수할지 별도 전략으로 다룬다.

---

# Explicit Non Goals

v1에서 구현 금지

* 쇼핑몰
* 장바구니
* 포인트
* 쿠폰
* 회원등급
* 공개 커뮤니티형 리뷰/댓글
* 고객 포트폴리오 공개 기능
* 3D 시뮬레이터
* 자동 견적 엔진

---

# Success Metrics

* 무료방문견적 신청 수
* 견적 생성 수
* 견적→결제 전환율
* 고객 결제 완료율
* 영업 매니저 견적 작성 시간
* 어드민 접수 처리 시간
* AppSheet 수동 등록 대기 건수
* 결제 전 설문 응답률
* AS 접수 처리 상태
* 후기/사진/홍보동의 확보 건수

---

# Future Roadmap

v2

* n8n 자동화 고도화
* 후기/사진 요청 자동화

v3

* AppSheet 일부 연동

v4

* 견적 시뮬레이터

v5

* 문장군 OS
