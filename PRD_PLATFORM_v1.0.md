---
document_type: "Platform PRD"
version: "1.0.0"
status: "canonical"
last_updated: "2026-05-29"
source_strategy: "PLATFORM_STRATEGY.md"
source_db_rbac: "PLATFORM_DB_RBAC_DESIGN.md"
source_audit: "PLATFORM_MIGRATION_AUDIT.md"
current_public_experience_prd: "PRD_v2.0.md"
legacy_public_experience_prd: "PRD_v1.1.md"
agent_bootstrap: "CODEX_PROJECT_BOOTSTRAP.md"
---

# 문장군 플랫폼 v1.0

## 프로젝트 정의

문장군 플랫폼은 디지털 쇼룸의 후속 버전이 아니다.

문장군 플랫폼은 기존 디지털 쇼룸을 기반으로 확장되는 고객 포털(Customer Portal)이다.

목표는 고객이

무료 실측 신청
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

문장군의 핵심 자산은 상품이 아니라 무료 방문 실측 프로세스이다.

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
| 무료 실측 신청 | O  | -     | -   |
| 실측 조회    | 본인 | 담당 고객 | 전체  |
| 담당자 배정   | -  | -     | O   |
| 견적 생성    | -  | O     | O   |
| 견적 수정    | -  | 담당 건  | O   |
| 견적 조회    | 본인 | 담당 건  | 전체  |
| 결제       | O  | -     | -   |

---

# MVP Scope

## MVP-01

간편 로그인

* 카카오
* 네이버
* 구글

---

## MVP-02

무료 방문 실측 신청

입력:

* 이름
* 연락처
* 주소
* 제품군
* 희망 일정
* 현장 사진

상태:

접수대기
→ 담당자배정
→ 실측예정
→ 실측완료

---

## MVP-03

담당자 배정

관리자는 접수 건을 담당 매니저에게 배정한다.

---

## MVP-04

견적 생성

영업 매니저는

* 제품
* 옵션
* 추가금
* 메모

를 입력하여 견적을 생성한다.

---

## MVP-05

견적 링크

URL 예시:

/quote/{quoteId}

정책:

* 고객 본인만 조회
* 로그인 필수
* 담당 매니저 조회 가능
* 관리자 조회 가능
* 링크 만료 없음
* 결제 후에도 보관

---

## MVP-06

토스페이먼츠 결제

상태:

견적작성중
→ 견적발송
→ 결제대기
→ 결제완료

---

# Explicit Non Goals

v1에서 구현 금지

* 쇼핑몰
* 장바구니
* 포인트
* 쿠폰
* 리뷰
* 회원등급
* AS
* 시공 일정 조회
* 고객 포트폴리오
* 3D 시뮬레이터
* 자동 견적 엔진

---

# Success Metrics

* 무료 실측 신청 수
* 견적 생성 수
* 견적→결제 전환율
* 고객 결제 완료율
* 영업 매니저 견적 작성 시간

---

# Future Roadmap

v2

* 내 주문
* 시공 진행 조회

v3

* AS

v4

* 견적 시뮬레이터

v5

* 문장군 OS
