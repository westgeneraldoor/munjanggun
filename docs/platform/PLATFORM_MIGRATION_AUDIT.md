---
document_type: "Platform Migration Audit"
status: "superseded-historical-audit"
created: "2026-05-29"
auditor: "Codex"
canonical_prd: "docs/platform/PRD_PLATFORM_v1.0.md"
canonical_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
canonical_bootstrap: "docs/platform/CODEX_PROJECT_BOOTSTRAP.md"
canonical_strategy: "docs/platform/PLATFORM_STRATEGY.md"
development_status: "minimum_design_then_mvp_build"
---

# 문장군 플랫폼 전환 감사 보고서

> 보존용 역사 감사 문서다. 현재 실행 순서나 활성 파일 목록의 정본이 아니다. 2026-07-21부터 실행 범위와 순서는 사용자가 승인한 현재 목표와 해당 세션의 검증 가능한 계획을 따르며, 이 문서 안의 `PLATFORM_TASKS.md`, `_order.md`, `_context.md`, `GEMINI.md` 언급은 당시 상태 기록으로만 읽는다.

## 0. 결론

현재 `munjanggun` 프로젝트는 플랫폼으로 확장 가능하다.

단, 기존 쇼룸 제품을 "수정해서 쇼핑몰처럼 키우는 방식"은 위험하다. 올바른 방향은 기존 디지털 컬러북을 플랫폼의 `Public Experience`로 계승하고, 그 옆에 고객 포털, 영업 매니저, 견적, 결제 도메인을 단계적으로 추가하는 것이다.

이번 감사의 판정은 다음과 같다.

| 영역 | 판정 | 이유 |
|---|---|---|
| 기존 쇼룸 UX | 계승 | 브랜드의 프리미엄 진입 경험으로 이미 목적이 명확하고 구현도 완성되어 있음 |
| 기존 CMS | 핵심 엔진으로 계승 | 컬렉션, 컬러, 이미지, 공개/초안, 미리보기 구조가 플랫폼의 콘텐츠 운영 기반이 됨 |
| 기존 쇼룸 PRD v2.0 | Current/Public Experience Reference | V2 만능 노드 CMS와 `showroom` 스키마 기준을 정의하므로 플랫폼의 공개 쇼룸 영역 기준으로 계승 |
| 기존 PRD v1.1 | Legacy Reference로 전환 | V1 컬러북 실행 PRD이므로 플랫폼 구현 기준으로 쓰면 충돌 |
| 플랫폼 PRD | 기준 문서로 승격 | 고객 포털, 무료방문견적, 담당자 배정, 견적, 결제의 새 목표를 정의 |
| Codex Bootstrap | 기준 문서로 승격 | 에이전트가 개발 전에 읽어야 할 정책 문서로 사용 |
| 플랫폼 개발 | 최소 설계 후 MVP 구현 | DB/RBAC와 개인정보 경계는 먼저 잡되, 카카오 로그인과 무료방문견적 신청까지 빠르게 검증해야 함 |

## 1. 감사 범위

### 1.1 직접 확인한 문서

| 문서 | 현재 역할 | 전환 판정 |
|---|---|---|
| `docs/platform/PRD_PLATFORM_v1.0.md` | 플랫폼 목표 초안 | Canonical |
| `docs/platform/PLATFORM_STRATEGY.md` | 플랫폼을 왜 만드는지 정의하는 북극성 문서 | Canonical |
| `docs/platform/PLATFORM_TASKS.md` | 플랫폼 제작 페이즈와 오더 순서 | Canonical |
| `docs/platform/CODEX_PROJECT_BOOTSTRAP.md` | 플랫폼 개발 에이전트 부트스트랩 | Canonical |
| `docs/showroom/PRD_v2.0.md` | V2 만능 노드 CMS 쇼룸 PRD | Current/Public Experience Reference |
| `docs/showroom/PRD_v1.1.md` | V1 디지털 컬러북 실행 PRD | Legacy/Public Experience Reference |
| `docs/showroom/PROJECT_BRIEF.md` | 쇼룸 아이디어 검증과 문제 정의 | Legacy/Public Experience Reference |
| `PROJECT_TASKS.md` | V2 쇼룸 구현 히스토리 + 플랫폼 태스크 포인터 | Active state board |
| `docs/platform/BRAND_CONTEXT.md` | 브랜드, 영업, 시공, 세일즈 플로우 맥락 | Active Business Context |
| `_context.md` | 최근 작업 상태 | Active, 플랫폼 전환 상태로 갱신 |
| `_order.md` | MVP-01 카카오 로그인 구현 오더 #052 | Active order |
| `docs/showroom/DESIGN_SYSTEM.md` | 쇼룸 디자인 시스템 | Active Design Base |
| `README.md` | 현재 구현된 쇼룸 설명 | Current Product README |
| `GEMINI.md` | 에이전트 진입 문서 | Active, 플랫폼 기준 문서 반영 |
| `docs/archive/showroom/_audit_2026-04-21.md` | 쇼룸 PRD 감사 | Historical audit, 일부 해결됨 |
| `docs/archive/showroom/_launch_check.md` | 쇼룸 출시 점검 | Historical launch evidence |
| `promo-video/*` | 프로모션 영상 제작 문서 | Out of platform migration scope |

### 1.2 PRD v2.0 확인 결과

`v2-cms` 기준 현재 저장소에는 `docs/showroom/PRD_v2.0.md`가 존재한다.

`docs/showroom/PRD_v2.0.md`는 플랫폼 PRD가 아니라 기존 쇼룸을 V2 만능 노드 CMS로 확장한 실행 PRD다. 이 문서는 플랫폼의 Public Experience 영역 기준으로 계승한다.

현재 플랫폼 제품 문서는 `docs/platform/PRD_PLATFORM_v1.0.md`이며, 이 문서를 플랫폼 PRD의 기준 문서로 승격한다. 기존 `docs/showroom/PRD_v1.1.md`는 V1 디지털 컬러북 실행 PRD로 Legacy 참고 문서다.

## 2. 기준 문서 승격

### 2.1 승격된 기준 문서

| 기준 문서 | 역할 |
|---|---|
| `docs/platform/PRD_PLATFORM_v1.0.md` | 플랫폼 제품 범위, 원칙, MVP, RBAC, 로드맵 기준 |
| `docs/platform/PLATFORM_TASKS.md` | 플랫폼 페이즈, 오더 순서, 완료 기준 |
| `docs/platform/CODEX_PROJECT_BOOTSTRAP.md` | Codex/에이전트가 개발 전 반드시 읽는 실행 정책 |
| `docs/platform/PLATFORM_STRATEGY.md` | 고객/영업/대표 관점의 플랫폼 존재 이유와 네이버 전환 전략 |
| `docs/platform/DEVELOPMENT_STRATEGY.md` | Codex/Gemini/Claude/GPT 역할 분담과 작업 운영 전략 |
| `docs/platform/PLATFORM_MIGRATION_AUDIT.md` | 기존 자산 승계/Legacy 전환/최소 설계 게이트 근거 |

### 2.2 승격하면서 정정한 사항

초기 초안의 `CODEX_PROJECT_BOOTSTRAP.md.md` 파일명은 기준 문서 역할에 맞지 않았다. 기준 문서로 쓰기 위해 `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`로 정정한다.

두 기준 문서에는 `status: canonical` frontmatter를 부여한다.

### 2.3 기준 문서 우선순위

플랫폼 작업에서는 아래 순서를 따른다.

1. `docs/platform/PLATFORM_STRATEGY.md`
2. `docs/platform/PLATFORM_TASKS.md`
3. `docs/platform/DEVELOPMENT_STRATEGY.md`
4. `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
5. `docs/platform/PRD_PLATFORM_v1.0.md`
6. `docs/platform/PLATFORM_MIGRATION_AUDIT.md`
7. `docs/platform/BRAND_CONTEXT.md`
8. `docs/showroom/DESIGN_SYSTEM.md`
9. `docs/showroom/PRD_v2.0.md`
10. `docs/showroom/PRD_v1.1.md`
11. `docs/showroom/PROJECT_BRIEF.md`

`docs/showroom/PRD_v2.0.md`, `docs/showroom/PRD_v1.1.md`, `docs/showroom/PROJECT_BRIEF.md`는 더 이상 신규 플랫폼 기능의 범위 판단 기준이 아니다. 다만 기존 쇼룸을 보존하거나 Public Experience 영역을 수정할 때는 여전히 근거 문서로 사용한다.

## 3. 문서별 상세 감사

### 3.1 `docs/platform/PRD_PLATFORM_v1.0.md`

강점:

| 항목 | 평가 |
|---|---|
| 제품 정의 | "쇼핑몰이 아니라 고객 포털"이라는 경계가 명확함 |
| 승계 전략 | 기존 쇼룸과 CMS를 폐기하지 않는다고 명시함 |
| MVP 흐름 | 로그인, 무료방문견적, 담당자 배정, 견적, 결제 순서가 비즈니스 흐름과 맞음 |
| 금지 범위 | 쇼핑몰, 장바구니, 쿠폰, 포인트, 리뷰, 자동 견적 엔진을 금지해 스코프 크립을 막음 |

보완 필요:

| 이슈 | 위험 | 개발 전 필요한 결정 |
|---|---|---|
| RBAC가 기능 표로만 있음 | DB 정책/RLS/라우트 보호로 번역되지 않으면 URL 접근이 권한처럼 오해될 수 있음 | `profiles`, `roles`, `manager_assignments` 등 권한 모델 확정 |
| 무료방문견적 신청 데이터 모델 없음 | 접수 상태와 고객 PII 처리 방식이 불명확 | `measurement_requests` 스키마, 사진/영상 저장 정책, 개인정보 보관 정책 정의 |
| 견적 모델 없음 | quote URL만 만들면 결제/수정/보관 상태가 쉽게 꼬임 | `quotes`, `quote_items`, `quote_status_history` 설계 |
| 결제 상태 모델 없음 | 토스 결제 승인/실패/취소/환불 흐름 누락 | `payments`, `payment_events`, Toss webhook 정책 정의 |
| AppSheet와의 관계 없음 | 기존 운영 전산과 플랫폼 데이터가 이중 관리될 수 있음 | AppSheet를 유지/연동/대체 중 무엇으로 볼지 결정 |
| OAuth 범위만 있음 | 카카오/네이버/구글 로그인 이후 휴대폰, 주문, 실측 데이터 연결 정책이 없음 | 고객 계정 식별 키와 중복 계정 병합 정책 정의 |

판정:

`docs/platform/PRD_PLATFORM_v1.0.md`는 플랫폼 방향을 정하는 기준 문서로 충분하다. 그러나 바로 구현 오더로 쓰기에는 데이터 모델과 보안 정책이 부족하다. 다음 단계는 거대한 추가 PRD가 아니라 "플랫폼 DB/RBAC 최소 설계 오더"다. 이 설계가 통과되면 MVP-01 카카오 로그인과 MVP-02 무료방문견적 신청 + 어드민 접수 큐 구현으로 바로 들어간다.

### 3.2 `docs/showroom/PRD_v2.0.md`와 `docs/showroom/PRD_v1.1.md`

`docs/showroom/PRD_v2.0.md`는 현재 `v2-cms` 브랜치의 실행 기준이다. `docs/showroom/PRD_v1.1.md`는 V1 컬러북의 과거 실행 기준이다. 플랫폼 작업에서는 두 문서 모두 신규 기능의 최상위 기준이 아니라 Public Experience 참고 문서로 사용한다.

특히 아래 자산은 계승 가치가 높다.

| 계승할 자산 | 근거 |
|---|---|
| App Router 기반 고객/어드민 분리 | 현재 코드 구조와 일치 |
| Supabase `showroom` 스키마 | 노드, 히어로, 갤러리, 미리보기, 사이트 설정이 이미 도메인화됨 |
| 공개/초안/미리보기 워크플로우 | 플랫폼 콘텐츠 운영에도 필요 |
| 동적 OG와 공유 UX | Public Experience 유입과 상담 전환에 필요 |
| 카카오톡 인앱 브라우저 제약 | 브랜드 유입 현실과 맞음 |
| Out-of-Scope 방어벽 | 에이전트의 기능 과잉을 막는 좋은 패턴 |

하지만 플랫폼 작업에서는 아래 충돌이 있다.

| 충돌 | 설명 |
|---|---|
| 고객 회원가입 금지 | 플랫폼 PRD는 고객 로그인/OAuth를 MVP-01로 요구 |
| 결제/장바구니 금지 | 플랫폼 PRD는 토스 결제를 MVP-06으로 요구 |
| 스마트스토어 외부 결제 전제 | 플랫폼은 결제를 내부 흐름으로 흡수하려 함 |
| 단일 관리자 계정 | 플랫폼에는 고객, 영업 매니저, 관리자 3역할이 필요 |

판정:

`docs/showroom/PRD_v2.0.md`는 `Current/Public Experience Reference`로 유지한다. `docs/showroom/PRD_v1.1.md`는 `Legacy/Public Experience Reference`로 전환한다. 두 문서는 "플랫폼에서 쇼룸 영역을 어떻게 보존할지"를 설명하는 참고 문서이며, 신규 플랫폼 기능의 근거 문서가 아니다.

### 3.3 `docs/showroom/PROJECT_BRIEF.md`

이 문서는 쇼룸의 탄생 배경을 잘 설명한다.

핵심은 "실측 후 컬러를 못 고른 고객에게 카톡 링크 하나로 보내는 디지털 컬러북"이다. 플랫폼의 전체 고객 여정과는 다르지만, `무료방문견적 이후 컬러 확신을 만드는 Public Experience`로 계승할 가치가 높다.

판정:

Legacy로 내리되 폐기하지 않는다. 플랫폼의 `Public Experience`와 영업 보조 컨텍스트를 설명하는 출처로 보존한다.

### 3.4 `PROJECT_TASKS.md`

현재 태스크 보드는 쇼룸의 Phase 1-6 완료 기록에 가깝다.

확인된 상태:

| 항목 | 상태 |
|---|---|
| PRD, 디자인, DB, 어드민, 고객 페이지 | 완료로 기록 |
| Phase 6 이미지 성능 최적화 | 완료로 기록 |
| 카카오톡 실기기 테스트, EVAL 전수 검사 | 일부 미완료 |
| 데스크탑 UI 전면 개편 오더 | 과거 상태가 남아 있음 |
| 플랫폼 전환 | 아직 반영되지 않음 |

판정:

`PROJECT_TASKS.md`는 쇼룸 구현 히스토리로 가치가 있으나, 플랫폼 전환의 세부 일정표 역할까지 맡기면 다시 비대해진다.

따라서 `PROJECT_TASKS.md`는 전체 상태 포인터로 유지하고, 플랫폼 구현의 실제 Phase와 오더 순서는 `docs/platform/PLATFORM_TASKS.md`로 분리한다.

### 3.5 `docs/platform/BRAND_CONTEXT.md`

플랫폼 전환에서 가장 중요한 비즈니스 문서다.

플랫폼 PRD와 직접 연결되는 사실:

| 사실 | 플랫폼 의미 |
|---|---|
| 무료방문견적이 핵심 차별점 | MVP-02가 제품의 중심이어야 함 |
| 영업부 5명이 방문실측 견적상담 전담 | Sales Manager 역할은 실제 운영 조직과 맞음 |
| 담당매니저 1인이 실측부터 A/S까지 책임 | 담당자 배정, 견적, 고객 이력 설계의 핵심 |
| 현재 결제는 네이버 브랜드스토어 중심 | 토스 결제 도입은 운영 방식 변경이므로 신중해야 함 |
| AppSheet가 전 업무 전산으로 쓰임 | 플랫폼 DB와 기존 운영 DB의 관계를 먼저 결정해야 함 |
| A/S 보증과 자체 시공팀 | v1 Non Goal이어도 데이터 모델 확장 여지를 남겨야 함 |

판정:

`docs/platform/BRAND_CONTEXT.md`는 Legacy가 아니라 Active Business Context다. 플랫폼 설계자가 `docs/platform/PRD_PLATFORM_v1.0.md` 다음으로 읽어야 한다.

### 3.6 `_context.md`

현재 `_context.md`는 2026-04-27 Phase 6 완료 상태에서 멈춰 있다. 플랫폼 PRD, 부트스트랩, 이번 감사가 반영되어 있지 않다.

판정:

기준 문서 승격 후 `_context.md`는 갱신해야 한다. 단, 이 파일은 실행 상태 요약용이므로 플랫폼 설계 전체를 길게 넣지 않는다.

### 3.7 `docs/showroom/DESIGN_SYSTEM.md`

쇼룸 디자인 시스템은 플랫폼에도 계승한다.

계승할 부분:

| 자산 | 플랫폼 적용 |
|---|---|
| 고객 다크 테마 | Public Experience 유지 |
| 어드민 라이트 테마 | 관리자/영업 매니저 업무 화면의 출발점 |
| CSS Variables 토큰 | Tailwind 금지 조건과 일치 |
| 모바일 퍼스트, 100dvh, 접근성 기준 | 고객 포털에도 유지 |
| Lucide, Pretendard, Playfair Display 전략 | 기존 브랜드 인상 유지 |

보완 필요:

플랫폼에는 폼, 표, 상태 타임라인, 결제 상태, 견적 카드, 고객 포털 대시보드, 영업 매니저 작업 큐가 필요하다. 기존 디자인 시스템은 쇼룸/어드민 CMS 기준이므로 운영형 UI 컴포넌트 규칙을 확장해야 한다.

판정:

Active Design Base로 계승한다. 폐기하지 않는다.

## 4. 코드 구조 감사

### 4.1 현재 구조 요약

| 영역 | 파일/경로 | 현재 역할 |
|---|---|---|
| Public Home | `src/app/page.tsx` | published 최상위 노드를 보여주는 쇼룸 홈 |
| Node Route | `src/app/[...slugs]/page.tsx` | V2 노드 기반 리스트/상세 페이지 |
| Preview | `src/app/preview/[token]/page.tsx` | 토큰 기반 미리보기 |
| Admin | `src/app/admin/*` | 노드/히어로/갤러리/사이트 설정 CMS |
| Supabase | `src/lib/supabase/*` | server/client/admin 클라이언트 |
| Types | `src/types/database.ts` | `showroom` 스키마 타입 |
| Components | `src/components/customer`, `src/components/admin` | 고객/어드민 분리 컴포넌트 |
| Styling | CSS Modules + `src/app/globals.css` | 디자인 토큰 기반 스타일 |
| Auth Guard | `src/proxy.ts` | `/admin` 보호와 로그인 리다이렉트 |

### 4.2 그대로 사용할 수 있는 코드

| 코드 자산 | 재사용 이유 |
|---|---|
| `src/components/customer/*` | 플랫폼의 Public Experience로 유지 가능 |
| `src/components/admin/AdminSidebar.tsx` | 관리자/영업 매니저 업무 네비게이션의 기반 |
| `src/components/admin/ImageUploader.tsx` | 실측 신청 사진, 견적 첨부, 시공 사진 업로드에도 재사용 가능 |
| `src/components/admin/StatusBadge.tsx` | 접수/견적/결제 상태 배지로 확장 가능 |
| `src/lib/supabase/server.ts`, `client.ts` | Supabase SSR/Browser client 패턴 계승 |
| `src/lib/logger.ts` | 에러 로깅 정책 계승 |
| `src/app/globals.css` | 토큰과 브랜드 룩 계승 |
| `src/proxy.ts` | 인증 가드의 출발점으로 계승 |
| 동적 metadata 패턴 | 견적 링크, 실측 신청 완료 페이지 등의 SEO/OG에도 응용 가능 |

### 4.3 수정해서 사용할 코드

| 코드 자산 | 필요한 변경 |
|---|---|
| `src/proxy.ts` | 단일 `/admin` 보호에서 `/customer`, `/manager`, `/admin` 역할 기반 보호로 확장 |
| `src/types/database.ts` | `showroom` 외 플랫폼 스키마 또는 확장 테이블 타입 추가 |
| `src/components/admin/*List.tsx` | 컬렉션/컬러 전용 CRUD 패턴을 업무 큐와 견적 목록 패턴으로 일반화 |
| `SiteSettingsForm` | 외부 예약/스토어 링크 중심 설정에서 플랫폼 내부 플로우 설정으로 확장 |
| `CTABar` | 외부 예약 링크 CTA에서 내부 무료방문견적 신청 CTA로 전환 가능 |
| `ImageUploader` | 고객 업로드 권한, PII 사진, Storage 경로 분리 정책 추가 필요 |
| `generateSlug` | 쇼룸 slug에는 충분하지만 고객/견적 도메인에는 별도 식별자 정책 필요 |

### 4.4 그대로 쓰면 위험한 코드/전제

| 항목 | 위험 |
|---|---|
| 단일 관리자 Auth 전제 | 플랫폼 RBAC와 충돌 |
| `site_settings.single()` 호출 | 일부 파일은 `id = 'singleton'`을 쓰고 일부는 `.single()`만 사용해 정합성 위험 |
| 브라우저 클라이언트 직접 CRUD | 관리자 CMS에는 가능했지만 견적/결제/개인정보에는 서버 액션/API 검증이 필요 |
| 공개 Storage URL 중심 이미지 | 고객 현장 사진은 개인정보가 포함될 수 있어 공개 버킷 정책 재검토 필요 |
| 외부 예약/스토어 CTA | 플랫폼에서는 내부 실측/견적/결제 플로우가 우선 |
| `showroom` 도메인 중심 타입 | 플랫폼 도메인을 억지로 쇼룸 CMS 스키마에 섞으면 장기 유지보수 위험 |

## 5. 플랫폼 구현에 새로 필요한 도메인

현재 코드에는 아래 도메인이 없다.

| 도메인 | 필요 이유 |
|---|---|
| 사용자 프로필 | 고객/영업매니저/관리자 식별 |
| 역할/RBAC | 기능별 조회/수정 권한 |
| 무료방문견적 신청 | 플랫폼 MVP의 시작점 |
| 담당자 배정 | 관리자와 영업 매니저 업무 분리 |
| 견적 | 고객 결제 전 핵심 문서 |
| 견적 항목/옵션/추가금 | 문장군의 현장 특이사항/추가금 구조 반영 |
| 결제 | 토스페이먼츠 승인, 실패, 취소, 웹훅 처리 |
| 상태 이력 | 접수, 배정, 실측, 견적, 결제 상태 추적 |
| 알림/연락 정책 | v1에 알림 기능을 만들지 않더라도 운영 연락 흐름은 정의 필요 |
| 감사 로그 | 견적/결제/개인정보 접근 기록 |

권장 테이블 초안:

| 테이블 | 목적 |
|---|---|
| `profiles` | Supabase Auth 사용자 확장 정보 |
| `roles` 또는 `profile_roles` | Customer/Sales Manager/Admin 권한 |
| `measurement_requests` | 무료방문견적 신청 |
| `measurement_request_media` | 고객 업로드 현장 사진/영상 |
| `manager_assignments` | 담당자 배정 |
| `quotes` | 견적 헤더 |
| `quote_items` | 제품/옵션/추가금 항목 |
| `quote_events` | 견적 상태 변경 이력 |
| `payments` | 결제 상태 |
| `payment_events` | 토스 웹훅/승인 이벤트 |
| `audit_logs` | 민감 작업 기록 |

이 초안은 구현 지시가 아니다. 다음 설계 오더에서 확정해야 한다.

## 6. 주요 리스크

### 6.1 브랜치 정책

`docs/platform/PRD_PLATFORM_v1.0.md`는 Base Branch를 `v2-cms`, New Branch를 `platform-v1`로 지정한다.

현재 문서 베이스라인은 `v2-cms`에서 분기한 `platform-v1` 브랜치 위에서 정리한다. 플랫폼 구현도 이 브랜치에서 시작한다.

### 6.2 AppSheet 전산 리스크

`docs/platform/BRAND_CONTEXT.md`에 따르면 AppSheet가 접수, 실측, 제작, 발주, 시공, 정산, 출결, 차량, 카드 등 전 업무 전산이다.

플랫폼이 AppSheet를 대체하는지, 일부만 연동하는지, 고객 포털 데이터만 별도로 들고 가는지 결정되지 않았다. 이 결정을 하지 않고 플랫폼 DB를 만들면 운영팀이 이중 입력을 하게 될 가능성이 높다.

### 6.3 개인정보/사진 보안 리스크

현재 쇼룸 이미지는 공개 자산이다. 반면 실측 신청 사진은 고객 집 내부 사진일 수 있다. 기존 `showroom-images` 공개 버킷 정책을 그대로 쓰면 안 된다.

### 6.4 결제 운영 리스크

현재 결제는 네이버 브랜드스토어가 담당한다. 토스페이먼츠를 내부 결제로 들이면 결제 승인, 영수증, 취소, 환불, 정산, 세금계산/현금영수증 등의 운영 범위가 생긴다.

### 6.5 문서 드리프트 리스크

`GEMINI.md`, `PROJECT_TASKS.md`, `_context.md`, `_order.md`는 루트 실행 진입점으로 유지하되, 플랫폼 세부 기준은 `docs/platform/`으로 모은다. 이 경로가 어긋나면 다음 에이전트가 기존 쇼룸 PRD 기준으로 되돌아갈 수 있다.

## 7. 승계/Legacy 전환 결정표

| 대상 | 결정 | 다음 처리 |
|---|---|---|
| 기존 쇼룸 고객 화면 | 계승 | `/`, `/collection`, `/color`를 Public Experience로 유지 |
| 기존 어드민 CMS | 계승 | CMS 엔진으로 유지, 플랫폼 운영 UI와 분리 확장 |
| 기존 디자인 시스템 | 계승 | 업무형 컴포넌트 규칙 추가 |
| 기존 Supabase client 구조 | 계승 | 플랫폼 스키마/RBAC에 맞게 확장 |
| 기존 `showroom` 스키마 | 계승 | 플랫폼 핵심 테이블과 분리하거나 명확한 schema boundary 설정 |
| `docs/showroom/PRD_v1.1.md` | Legacy | Public Experience 참고 문서로만 사용 |
| `docs/showroom/PROJECT_BRIEF.md` | Legacy | 쇼룸 탄생 배경/영업 보조 맥락으로 보존 |
| `_order.md` | Active | MVP-01 카카오 로그인 구현 오더로 유지 |
| `docs/archive/showroom/_launch_check.md` | Legacy evidence | 쇼룸 품질 근거로 보존 |
| `promo-video/*` | Out of scope | 플랫폼 개발 기준에서 제외 |
| 외부 예약/스토어 CTA | 단계적 전환 | MVP에서 내부 신청/결제 흐름으로 대체 여부 결정 |

## 8. 최소 설계 게이트

아래 게이트는 개발을 오래 막기 위한 장치가 아니다.

목적은 개인정보와 권한을 망치지 않을 만큼만 먼저 정하고, 곧바로 실제 고객이 무료방문견적을 신청하는 첫 화면까지 가는 것이다.

| 게이트 | 완료 기준 |
|---|---|
| DB/RBAC 최소 설계 | MVP-01 카카오 로그인과 MVP-02 무료방문견적 신청에 필요한 테이블, RLS, role별 접근 흐름 확정 |
| Auth 설계 | 카카오 로그인과 고객 식별자 정책 확정 |
| Storage 정책 | 고객 현장 사진/영상은 공개 쇼룸 이미지와 분리하고 비공개 원칙 확정 |
| Route map | 고객 신청, 매니저 접수 목록, 관리자 배정 경로 확정 |
| Implementation order | 개발자가 읽을 수 있는 첫 `_order.md` 작성 |

아래 항목은 중요하지만 첫 무료방문견적 신청 화면을 막을 정도로 깊게 설계하지 않는다.

| 후속 설계 | 처리 원칙 |
|---|---|
| AppSheet 관계 | MVP-02 신청 구현은 막지 않되, MVP-03 접수/배정 운영 전에는 확정 |
| Toss 결제 설계 | 견적 생성 이후 단계에서 별도 설계 |
| A/S/시공 일정 | v1 이후 확장 여지만 보존 |

## 9. 권장 다음 순서

1. `docs/platform/PLATFORM_STRATEGY.md`를 PRD 상위 기준 문서로 유지한다.
2. `docs/platform/PLATFORM_TASKS.md`를 플랫폼 제작 일정 기준으로 유지한다.
3. MVP-01 카카오 로그인을 구현한다.
4. MVP-02 무료방문견적 신청 + 어드민 접수 큐를 바로 구현한다.
5. AppSheet와 플랫폼 DB의 운영 관계를 확정한다.
6. 관리자/영업 매니저가 접수 건을 확인하고 담당자를 배정하는 화면으로 확장한다.
7. 견적과 결제는 실측 신청/담당자 배정 데이터가 안정화된 뒤 진행한다.

## 10. 최종 판정

문장군 플랫폼 전환은 가능하다.

기존 프로젝트는 폐기 대상이 아니라 좋은 출발점이다. 특히 쇼룸 UX, CMS, 디자인 토큰, Supabase 연결 구조, 이미지 업로드 구조는 그대로 살릴 가치가 높다.

그러나 플랫폼의 본체는 아직 코드에 없다. 다음 작업은 장기 문서화가 아니라 `docs/platform/PLATFORM_TASKS.md`의 순서에 따라 카카오 로그인과 무료방문견적 신청 구현으로 바로 들어가는 것이다.
