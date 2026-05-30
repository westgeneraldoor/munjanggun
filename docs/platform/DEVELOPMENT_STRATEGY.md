---
document_type: "Development Strategy"
version: "1.0.0"
status: "active"
last_updated: "2026-05-30"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_tasks: "docs/platform/PLATFORM_TASKS.md"
source_order: "_order.md"
---

# DEVELOPMENT_STRATEGY — 문장군 플랫폼 개발 운영 전략

## 0. 이 문서의 역할

이 문서는 "무엇을 만들 것인가"가 아니라 "어떻게 여러 AI와 작업자를 함께 써서 안정적으로 만들 것인가"를 정한다.

문장군 플랫폼은 사용자, Codex, Gemini, Claude, GPT가 함께 만드는 프로젝트다. 따라서 작업의 기억은 채팅이 아니라 파일에 남아야 한다.

핵심 원칙:

- 사용자와 먼저 대화하고, 결정된 내용을 문서에 반영한 뒤 개발한다.
- Codex는 총괄 PM/아키텍트/검수자 역할을 맡는다.
- Gemini Flash 3.5 High는 빠른 구현 작업자 역할을 맡는다.
- Claude Opus급 모델은 복잡한 전략, 설계, 리스크 검수에 투입한다.
- GPT/ChatGPT는 사업 전략, 고객 여정, 문구, 아이디어 발산에 활용한다.
- 모든 작업자는 `docs/platform/PLATFORM_STRATEGY.md`와 `docs/platform/PLATFORM_TASKS.md`를 우선한다.

## 1. 역할 분담

| 역할 | 담당 | 주요 책임 |
|---|---|---|
| 최종 결정자 | 사용자 | 도메인 경험, 영업/운영 현실, 사업 우선순위 결정 |
| 총괄 PM | Codex | 문서 기준 정리, 오더 작성, 설계 판단, 코드 검수, 커밋/PR 관리 |
| 구현 작업자 | Gemini Flash 3.5 High | `_order.md` 기준 빠른 코드 구현, 단위 수정, 결과 보고 |
| 고난도 검수자 | Claude Opus/Thinking | 아키텍처 리스크, 보안/RBAC, 복잡한 설계 검토 |
| 전략 파트너 | GPT/ChatGPT | 고객 관점, 사업 전략, 전환 문구, 콘텐츠/후기 전략 정리 |

## 2. 문서 기준

작업자는 아래 순서로 문서를 읽는다.

1. `AGENTS.md`
2. `GEMINI.md`
3. `docs/platform/PLATFORM_STRATEGY.md`
4. `docs/platform/PLATFORM_TASKS.md`
5. `docs/platform/DEVELOPMENT_STRATEGY.md`
6. `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
7. `docs/platform/PRD_PLATFORM_v1.0.md`
8. `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
9. `docs/platform/DECISION_LOG.md`
10. `_context.md`
11. `_order.md`

우선순위:

| 문서 | 역할 |
|---|---|
| `PLATFORM_STRATEGY.md` | 왜 만드는가. 기능 컷 기준 |
| `PLATFORM_TASKS.md` | 어떤 순서로 만드는가 |
| `DEVELOPMENT_STRATEGY.md` | 누가 어떻게 작업하는가 |
| `PLATFORM_DB_RBAC_DESIGN.md` | DB/RBAC 최소 기술 기준 |
| `_order.md` | 지금 작업자가 실행할 단일 오더 |

## 3. 협업 원칙

사용자의 현장 판단이 먼저다.

Codex는 큰 문서를 혼자 신나게 늘리지 않는다. 중요한 방향은 먼저 질문하고, 사용자의 답을 요약하고, 문서에 반영한다.

좋은 진행 순서:

```text
대화
→ 결정 요약
→ 문서 반영
→ 오더 작성
→ 작업자 구현
→ 작업자 셀프체크
→ Codex 검수
→ 커밋/푸시/PR
```

피해야 할 진행:

```text
질문 없이 대형 문서 작성
→ 사용자가 읽기 어려움
→ 작업자가 방향을 잘못 이해
→ 재작업 발생
```

## 4. 작업자 오더 방식

`_order.md`는 현재 작업 하나만 담는 덮어쓰기 슬롯이다.

작업자에게 주는 오더에는 아래가 반드시 있어야 한다.

- 작업 목표
- 반드시 읽을 문서
- 포함 범위
- 제외 범위
- 예상 파일
- 구현 규칙
- 검증 기준
- 작업 결과 작성란

작업자에게 주면 안 되는 것:

- 장황한 사업 배경 전체
- 구현과 무관한 모든 과거 논쟁
- 전체 컴포넌트 코드 복붙
- Phase 여러 개를 한 번에 구현하라는 지시

## 5. 모델 선택 기준

| 작업 종류 | 권장 모델 | 이유 |
|---|---|---|
| 단순 UI/문서 반영 | Gemini Flash 3.5 High | 빠르고 충분히 정확 |
| MVP-01 같은 중간 구현 | Gemini Flash 3.5 High + Codex 검수 | 속도와 검수 균형 |
| DB/RBAC/security | Codex 또는 Claude 고도 추론 | 실수 비용이 큼 |
| 결제/인증/권한 디버깅 | Codex high reasoning 또는 Claude | 원인 추적 필요 |
| 고객 여정/마케팅 전략 | GPT/Claude + 사용자 | 현장 언어와 전략 발산 |
| 최종 통합/PR | Codex | git, 검수, 기록 책임 |

Gemini가 빠르게 만들고, Codex가 구조와 리스크를 잡는다.

## 6. MVP 개발 순서

현재 실행 순서는 `PLATFORM_TASKS.md`를 따른다.

```text
MVP-01 카카오 로그인
→ MVP-02 무료방문견적 신청 + 어드민 접수 큐
→ MVP-03 담당자 배정 + 접수 상태 관리
→ MVP-04 견적서 작성 + 견적 링크 발송
→ MVP-05 견적 승인 + 결제 전 설문 + 토스페이먼츠 결제
→ MVP-06 결제/견적/시공 이력 대시보드
→ MVP-07 AS 접수
→ MVP-08 시공완료 후기/사진/홍보동의 큐
```

중요:

- MVP-01 이후 바로 고객 신청과 어드민 접수 큐를 만든다.
- 문서만 2주 만들지 않는다.
- 어드민이 실제 운영 엔진이므로 고객 기능과 어드민 큐를 한 세트로 검증한다.

## 7. 브랜치와 GitHub 운영

현재 기준:

| 항목 | 값 |
|---|---|
| Repository | `westgeneraldoor/munjanggun` |
| Base branch | `v2-cms` |
| Working branch | `platform-v1` |
| PR | `platform-v1` → `v2-cms` draft PR |

운영 원칙:

- `main` 직접 수정 금지.
- 플랫폼 작업은 `platform-v1`에서 진행한다.
- 작업 단위가 끝나면 Codex가 변경 범위 확인 후 커밋한다.
- 푸시 권한이 없으면 로컬 커밋까지만 만들고, 권한 복구 후 push/PR 업데이트한다.
- PR은 초기에는 draft로 유지한다.

커밋 기준:

- 문서 정리와 코드 구현은 가능하면 분리한다.
- MVP-01, MVP-02 같은 큰 Phase는 구현 커밋과 후속 수정 커밋을 구분한다.
- 사용자 직접 수정 파일은 되돌리지 않는다.

## 8. 작업자 결과 보고 형식

작업자는 `_order.md`의 "작업 결과" 섹션에 아래를 남긴다.

```text
## 작업 결과

### 변경 파일
- ...

### 구현 내용
- ...

### 검증
- [ ] npm run lint
- [ ] npm run build

### 미완료/주의
- ...
```

Codex는 작업자 보고만 믿지 않고 직접 diff와 핵심 파일을 확인한다.

## 9. 검수 기준

Codex 검수 순서:

1. `PLATFORM_STRATEGY.md`와 충돌 여부 확인
2. `_order.md` 범위 준수 확인
3. 고객/어드민 반응형 UX 영향 확인
4. DB/RBAC/RLS 보안 영향 확인
5. 기존 쇼룸 Public Experience 회귀 확인
6. lint/build 또는 가능한 검증 실행
7. `_context.md`, `DECISION_LOG.md`, `PLATFORM_TASKS.md` 업데이트 필요 여부 판단

## 10. 외부 두뇌 활용 방식

GPT/Claude/Gemini에서 나온 의견은 바로 구현 지시가 아니다.

반영 순서:

```text
외부 의견
→ 사용자 판단
→ Codex가 제품 결정으로 요약
→ DECISION_LOG 또는 PLATFORM_TASKS 반영
→ 필요하면 _order.md 갱신
```

이 규칙은 플랫폼이 장바구니, 포인트, 회원등급 같은 쇼핑몰 방향으로 흐르는 것을 막기 위한 안전장치다.

## 11. 금지

- 사용자의 확인 없이 플랫폼 전략을 뒤집지 않는다.
- `PROJECT_TASKS.md`에 플랫폼 세부 체크리스트를 다시 길게 넣지 않는다.
- AppSheet를 MVP에서 강제로 통합하지 않는다.
- n8n을 인증, 결제, 개인정보 원장으로 쓰지 않는다.
- 작업자가 임의로 `main` 또는 `v2-cms`에 직접 커밋하지 않는다.

## 12. 현재 다음 실행

현재 오더는 `_order.md` #052 `MVP-01 카카오 로그인 기반 구축`이다.

추천 실행:

1. Codex가 문서 업데이트를 커밋한다.
2. Gemini Flash 3.5 High 작업자가 `_order.md` #052를 실행한다.
3. 작업자는 lint/build와 결과 보고를 남긴다.
4. Codex가 diff, auth flow, RLS 설계를 검수한다.
5. 통과하면 MVP-02 오더를 사용자와 협의 후 작성한다.
