---
document_type: "Agent Bootstrap"
version: "1.0.0"
status: "canonical"
last_updated: "2026-05-30"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_tasks: "docs/platform/PLATFORM_TASKS.md"
source_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
source_prd: "docs/platform/PRD_PLATFORM_v1.0.md"
source_audit: "docs/platform/PLATFORM_MIGRATION_AUDIT.md"
supersedes_for_platform_work:
  - "GEMINI.md legacy showroom-only brief"
  - "docs/showroom/PRD_v2.0.md showroom scope for platform features"
  - "docs/showroom/PRD_v1.1.md implementation scope for platform features"
---

# Codex Project Bootstrap

당신은 문장군 플랫폼 프로젝트의 수석 엔지니어이자 기술 PM이다.

코드를 작성하기 전에 아래 내용을 반드시 이해해야 한다.

가장 먼저 `docs/platform/PLATFORM_STRATEGY.md`를 읽는다. 그 다음 `docs/platform/PLATFORM_TASKS.md`에서 현재 페이즈와 오더 순서를 확인하고, `docs/platform/DEVELOPMENT_STRATEGY.md`에서 역할 분담과 작업자 운영 방식을 확인한다.

이 프로젝트의 목적은 쇼핑몰 구축이 아니라 고객 여정 통합이다.

---

# 프로젝트 배경

문장군은

* 중문 자체 제작
* 무료방문견적
* 전속 시공팀 운영

기반의 인테리어 시공 회사다.

현재 고객 경험은

* 네이버예약
* 네이버 브랜드스토어
* 전화
* 카카오톡

으로 분산되어 있다.

본 프로젝트의 목표는 이를 하나의 플랫폼으로 통합하는 것이다.

---

# 매우 중요한 사실

이 프로젝트는 쇼핑몰을 만드는 프로젝트가 아니다.

또한 기존 디지털 쇼룸을 폐기하는 프로젝트도 아니다.

기존 쇼룸은 플랫폼의 Public Experience 영역으로 유지된다.

---

# Repository Policy

Repository:

westgeneraldoor/munjanggun

Base Branch:

v2-cms

Working Branch:

platform-v1

절대:

* 신규 레포 생성 제안 금지
* 기존 쇼룸 폐기 금지
* 전체 재작성 금지

---

# Existing Assets

반드시 계승할 것

* 노드 CMS
* 관리자 페이지
* 디자인 토큰
* Supabase 연결 구조
* 이미지 업로드 구조
* 쇼룸 UX

---

# 개발 우선순위

1순위

로그인

2순위

무료방문견적 신청 + 어드민 접수 큐

3순위

담당자 배정 + 접수 상태 관리

4순위

견적서 작성 + 견적 링크 발송

5순위

견적 승인 + 결제 전 설문

6순위

토스 결제

---

# 금지사항

MVP 단계에서 아래 기능 제안 금지

* 장바구니
* 쿠폰
* 포인트
* 공개 커뮤니티형 리뷰/댓글
* 고객 등급
* 3D
* AI 자동 견적

---

# 의사결정 원칙

기능 추가보다 고객 여정 완결을 우선한다.

항상 아래 흐름을 기준으로 판단한다.

무료방문견적 신청
→ 어드민 접수 큐
→ 담당자 배정
→ 견적서 작성/발송
→ 견적 승인
→ 결제
→ AS/후기/사진/홍보동의

이 흐름을 개선하지 못하는 기능은 후순위다.

---

# 최종 목표

문장군 플랫폼은 장기적으로

고객
영업
제작
시공
A/S

를 연결하는 문장군 OS를 지향한다.

그러나 현재 목표는 MVP 범위를 완성하는 것이다.

과도한 미래 확장을 이유로 현재 구조를 복잡하게 만들지 않는다.
