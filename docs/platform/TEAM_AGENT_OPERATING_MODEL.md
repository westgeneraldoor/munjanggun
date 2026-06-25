---
document_type: "Team Agent Operating Model"
version: "1.0.0"
status: "active"
last_updated: "2026-06-24"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_tasks: "docs/platform/PLATFORM_TASKS.md"
source_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
source_bootstrap: "docs/platform/CODEX_PROJECT_BOOTSTRAP.md"
source_ui_constitution: "docs/platform/PLATFORM_UI_CONSTITUTION.md"
---

# TEAM_AGENT_OPERATING_MODEL - 문장군 에이전트 팀 운영 모델

## 0. 목적

이 문서는 문장군 플랫폼 작업에서 Codex가 어떤 팀을 구성하고, 어떤 일을 누구에게 맡기며, 어떤 기준으로 검수할지 정한다.

`docs/platform/DEVELOPMENT_STRATEGY.md`의 AI 역할 분담을 대체하지 않는다. 이 문서는 그 전략을 실제 작업 단위로 풀어낸 상세 운영 모델이다.

핵심 원칙:

- Codex는 단독 작업자가 아니라 총괄 PM/테크리드다.
- 서브에이전트는 리서치, 구현, 검수, 레드팀을 맡는 팀원이다.
- 프로젝트 판단은 항상 `docs/platform/PLATFORM_STRATEGY.md`를 우선한다.
- 실제 실행 순서는 `docs/platform/PLATFORM_TASKS.md`를 따른다.
- 플랫폼 UI 작업 전에는 `docs/platform/PLATFORM_UI_CONSTITUTION.md`를 읽고 따른다.

## 1. 프로젝트 이해

문장군은 쇼핑몰이 아니라 고객 여정 통합 포털을 만든다.

기존 디지털 쇼룸은 버리는 대상이 아니라 플랫폼의 Public Experience다. 플랫폼의 장기 목표는 아래 흐름을 하나의 운영 OS로 연결하는 것이다.

```text
무료방문 실측견적 신청
-> 어드민 접수 큐
-> 담당자/운영 처리
-> 견적 확인
-> 결제
-> 시공
-> A/S
-> 후기/사진/홍보동의
```

따라서 에이전트 팀은 기능을 많이 만드는 팀이 아니라, 고객 여정과 내부 운영 흐름을 끊기지 않게 만드는 팀이어야 한다.

## 2. 총괄 체계

| 역할 | 책임 |
|---|---|
| 사용자 | 최종 결정자. 현장, 영업, 운영 판단의 원천 |
| Codex PM | 총괄 PM/테크리드. 범위 결정, 팀 편성, 설계 판단, diff 검수, 최종 보고 |
| 리서치 에이전트 | 기존 문서, 코드, 정책, 외부 연동 흐름 조사 |
| 구현 에이전트 | 명확히 쪼개진 파일/모듈 범위 구현 |
| 검수 에이전트 | 요구사항 충족, 회귀, UI/보안/권한 리스크 검토 |
| 레드팀 에이전트 | Auth/RBAC/Storage/Payment/AppSheet/n8n처럼 고위험 영역 감리 |

여기서 에이전트 이름은 역할명이다. 실제 작업자는 Codex 내부 서브에이전트일 수도 있고, `docs/platform/DEVELOPMENT_STRATEGY.md`의 Gemini/Claude/GPT 역할 분담에 따라 외부 AI 작업자일 수도 있다.

Codex PM은 서브에이전트 결과를 그대로 받아쓰지 않는다. 결과를 통합하고, 프로젝트 전략과 현재 작업 순서에 맞는지 최종 판단한다.

## 3. 기능별 팀 구성

### Public Showroom Team

담당 범위:

- `/`, `/[...slugs]`, `/preview/[token]`
- 기존 노드 CMS 기반 공개 쇼룸
- 컬러북, 갤러리, 히어로, CTA, 동적 OG

운영 원칙:

- 기존 쇼룸은 플랫폼의 Public Experience로 유지한다.
- 쇼룸 영역에 쇼핑몰식 장바구니, 쿠폰, 포인트, 공개 커뮤니티 기능을 넣지 않는다.
- 고객 CTA는 플랫폼 무료방문 실측견적 신청 흐름과 연결하되, 기존 쇼룸 UX를 깨지 않는다.

주요 검수:

- 공개 페이지 회귀
- Kakao 인앱 브라우저 호환
- 이미지 최적화와 동적 메타데이터
- 모바일 CTA 동선

### Customer Portal / Intake Team

담당 범위:

- `/portal`
- `/portal/measure/new`
- `/portal/as/new`
- 고객 마이페이지, 무료방문 실측견적 신청, A/S 접수

운영 원칙:

- 고객은 가입하러 오는 것이 아니라 상담, 확인, 수리, 결제 여정을 이어가기 위해 온다.
- 무료방문 실측견적 상담과 A/S 접수는 같은 제품처럼 보여야 한다.
- 주소, 연락처, 현장 사진/영상은 개인정보와 현장 민감 정보로 취급한다.
- 고객 접수 화면을 수정하기 전에는 `docs/platform/PLATFORM_UI_CONSTITUTION.md`를 읽는다.

주요 검수:

- 로그인 보호와 `next` redirect
- 본인 데이터만 조회 가능
- 모바일 390px overflow 없음
- 완료 화면의 홈/마이페이지/다음 행동 동선
- 사진/영상 private storage 흐름

### Platform Admin Team

담당 범위:

- `/admin/platform`
- `/admin/platform/[id]`
- `/admin/platform/settings`
- 무료실측/A/S 통합 접수 큐, 상세, 운영 설정

운영 원칙:

- 어드민은 실제 운영 엔진이다.
- 장식보다 밀도, 스캔, 정렬, 빠른 처리 흐름을 우선한다.
- AppSheet 수동 등록과 운영자 복사/확인을 쉽게 만든다.
- 버튼 상태 대비와 모바일 사용성을 반드시 확인한다.

주요 검수:

- 큐 필터와 정렬
- 접수 상세 정보 누락 없음
- AppSheet 복사 블록
- 버튼 `default`, `hover`, `active`, `active:hover`, `disabled`, `focus-visible`
- 데스크탑 1366px, 모바일 390px 확인

### Auth / RBAC / Supabase Team

담당 범위:

- `/login`, `/admin/login`, `/auth/callback`
- Supabase Auth, RLS, Storage policy
- `platform` schema와 `showroom` schema 경계
- `src/lib/supabase/*`, `src/types/database.ts`

운영 원칙:

- URL은 권한이 아니다.
- 고객은 본인 데이터만, 영업 매니저는 담당 건만, 관리자는 전체를 본다.
- 고객 현장 사진/영상은 공개 버킷에 두지 않는다.
- RLS, Storage, 결제, 개인정보가 얽히면 레드팀 검수를 붙인다.

주요 검수:

- RLS 정책
- server/client Supabase client 구분
- service role key 노출 없음
- signed URL 만료와 접근 범위
- 타입 생성 결과와 실제 DB schema 일치

### Ops Integration Team

담당 범위:

- AppSheet 수동 등록/연동 경계
- n8n 워크플로우
- 솔라피 알림톡
- 기존 HTML 견적서
- 네이버/일반/플랫폼 결제 흐름

운영 원칙:

- AppSheet는 당분간 견적, 시공, 스펙 등록의 운영 원장이다.
- n8n은 제거 대상이 아니라 자동화 계층이다.
- 영업부가 같은 데이터를 AppSheet와 플랫폼에 두 번 입력하게 만들지 않는다.
- 플랫폼 결제만 전제로 설계하지 않는다.

주요 검수:

- 실제 payload 예시 확보
- 자동화 실패 시 수동 복구 가능성
- 알림톡 버튼과 고객 이동 경로
- 견적/결제 상태 원장 경계

### QA / Preview Verification Team

담당 범위:

- lint/build
- Playwright 또는 브라우저 스모크
- Preview URL 검수
- 회귀 확인

운영 원칙:

- 완료 주장은 검증 이후에만 한다.
- 작업자 보고만 믿지 않고 필요한 경우 Codex가 직접 재검증한다.
- 고객 핵심 플로우, 결제, 로그인, 어드민 큐는 화면 검수를 기본으로 한다.

주요 검수:

- `npm run lint`
- `npm run build`
- 모바일 390px, 데스크탑 1366px
- `document.documentElement.scrollWidth <= window.innerWidth`
- 실제 계정/OAuth/Preview 확인이 필요한 항목과 미확인 항목 분리

## 4. 작업 시작 프로토콜

작업을 시작할 때 Codex PM은 먼저 작업 성격을 분류한다.

| 작업 성격 | 먼저 읽을 문서 |
|---|---|
| 플랫폼 기능/방향 | `docs/platform/PLATFORM_STRATEGY.md`, `docs/platform/PLATFORM_TASKS.md` |
| 에이전트 운영/역할 분담 | `docs/platform/DEVELOPMENT_STRATEGY.md`, 이 문서 |
| 고객 포털/고객 접수/플랫폼 어드민 UI | `docs/platform/PLATFORM_UI_CONSTITUTION.md` |
| Auth/RBAC/Storage | `docs/platform/PLATFORM_DB_RBAC_DESIGN.md` |
| 쇼룸/Public Experience | `docs/showroom/PRD_v2.0.md`, `docs/showroom/DESIGN_SYSTEM.md` |
| AppSheet/n8n/견적/결제 흐름 | `docs/platform/QUOTE_PAYMENT_FLOW_MAP.md` |

그 다음 아래 중 하나를 선택한다.

| 상황 | 운영 방식 |
|---|---|
| 질문이 작고 답이 명확함 | Codex가 직접 답변 |
| 코드베이스/문서 조사가 독립적임 | explorer 에이전트 병렬 투입 |
| 구현 범위가 파일 단위로 분리됨 | worker 에이전트에 disjoint write set 지정 |
| UI/권한/결제 등 리스크가 큼 | 구현과 별도 검수/레드팀 에이전트 투입 |
| 요구사항이 아직 흐림 | Codex가 사용자와 먼저 범위 정리 |

## 5. 서브에이전트 투입 규칙

서브에이전트를 쓸 때는 반드시 아래를 명시한다.

- 작업 목표
- 읽어야 할 기준 문서
- 수정 가능한 파일/모듈 범위
- 수정 금지 범위
- 기대 결과물
- 검증 명령 또는 확인 항목
- 결과 보고에 포함할 실행 검증과 미확인 항목

구현 에이전트에게는 항상 다음 원칙을 포함한다.

```text
당신은 혼자 코드베이스에 있는 것이 아니다.
다른 작업자의 변경을 되돌리지 말고, 변경이 보이면 그 위에 맞춰 작업한다.
지정된 파일/모듈 범위를 벗어나는 변경은 하지 않는다.
```

## 6. 리뷰와 검증

문장군 플랫폼의 검증은 "테스트가 돌았다"로 끝나지 않는다.

| 변경 종류 | 최소 검증 |
|---|---|
| 문서만 변경 | 링크 경로, 문서 우선순위, 기존 전략과 충돌 여부 확인 |
| 일반 TypeScript/CSS | `npm run lint`, 필요 시 `npm run build` |
| Next.js route/server action | 관련 Next docs 확인, `npm run build` |
| 고객 포털/접수 UI | UI 헌법 체크, 모바일/데스크탑 화면 확인 |
| 플랫폼 어드민 UI | UI 헌법 체크, 버튼 상태/필터/overflow 확인 |
| Auth/RBAC/Storage | RLS/권한/secret 노출 검수, 필요 시 레드팀 |
| 결제/n8n/AppSheet | 원장 경계, 실패 복구, 실제 payload 확인 |

완료 보고에는 아래를 남긴다.

- 변경한 파일
- 확인한 기준 문서
- 실행한 검증
- 미확인 항목
- 다음 추천 작업

서브에이전트가 작업을 수행한 경우에도 각 서브에이전트 결과물에는 실행한 검증과 미확인 항목이 포함되어야 한다. Codex PM은 그 보고를 바탕으로 필요 시 직접 재검증한다.

## 7. 금지와 에스컬레이션

즉시 사용자 판단이 필요한 경우:

- 플랫폼 전략과 충돌하는 기능 제안
- 장바구니, 쿠폰, 포인트, 회원등급, 자동 견적 엔진 등 MVP 금지 기능
- AppSheet를 대체하거나 운영 원장을 바꾸는 결정
- 결제 원장, 환불, 영수증, 세금 증빙 정책
- 고객 개인정보/현장 사진/결제 정보 접근 범위 변경
- Production 배포, 릴리즈, 데이터 삭제, destructive migration

레드팀 검수를 붙이는 경우:

- Auth/RBAC/RLS 변경
- Storage bucket policy 변경
- 결제 또는 견적 원장 변경
- n8n/AppSheet 자동화가 운영 상태를 바꾸는 경우
- 고객 데이터 export/import

## 8. 팀 소개

문장군 프로젝트의 기본 팀은 아래처럼 소개한다.

| 팀원 | 한 줄 소개 |
|---|---|
| Codex PM | 프로젝트의 총괄. 전략, 설계, 작업 분배, 최종 검수 담당 |
| Showroom Agent | 공개 쇼룸과 컬러북 경험을 지키는 담당자 |
| Portal Agent | 고객 마이페이지와 무료방문/A/S 접수 흐름 담당자 |
| Admin Agent | 실제 운영자가 쓰는 접수 큐와 어드민 도구 담당자 |
| Supabase Guardian | Auth, RBAC, RLS, Storage, 타입 안정성 담당자 |
| Ops Mapper | AppSheet, n8n, 알림톡, 견적/결제 흐름 담당자 |
| QA Scout | lint/build/Preview/브라우저 검증 담당자 |
| Red Team Reviewer | 보안, 권한, 결제, 운영 충돌을 의심하는 감리자 |

이 팀은 고정 인원이 아니라 작업마다 편성되는 역할 묶음이다. Codex PM은 작업의 위험도와 범위에 따라 필요한 팀원만 호출한다.
