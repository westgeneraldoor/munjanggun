---
document_type: "Development Strategy"
version: "1.2.0"
status: "lightweight"
last_updated: "2026-07-21"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
related_team_operating_model: "docs/platform/TEAM_AGENT_OPERATING_MODEL.md"
---

# DEVELOPMENT_STRATEGY — AI 작업 운영 규칙

## 0. 역할

이 문서는 무거운 개발 전략서가 아니다.

문장군 플랫폼에서 여러 AI를 어떻게 나눠 쓸지 정하는 가벼운 운영 규칙이다.

실제 Codex 세션 안에서 서브에이전트를 어떤 팀 역할로 편성하고, 어떤 기준으로 리서치/구현/검수를 나눌지는 `docs/platform/TEAM_AGENT_OPERATING_MODEL.md`를 따른다.

| 담당 | 역할 |
|---|---|
| 사용자 | 최종 결정자. 문장군 현장/영업/운영 판단의 원천 |
| Codex | 총괄 PM. 오더 작성, 설계 판단, diff 검수, 필요 시 커밋/PR 관리 |
| Gemini Flash 3.5 High | 기본 구현 작업자. 빠르게 만들고 1차 검증 결과를 남김 |
| Claude Opus/Thinking | 고정 작업자가 아님. 사용자 또는 Codex가 필요할 때만 감리/레드팀으로 호출 |
| GPT/ChatGPT | 사업 전략, 고객 여정, 문구, 아이디어 발산 보조 |

## 1. 기본 흐름

```text
사용자와 대화
→ Codex가 결정 요약
→ 필요 문서만 가볍게 갱신
→ 승인된 목표를 검증 가능한 작업 계획으로 구체화
→ Gemini가 구현 + 1차 검증
→ Codex가 diff/범위/위험 검수
→ 필요 시 Claude 감리 요청
→ 커밋/푸시/PR 또는 다음 오더
```

원칙:

- 전략 문서는 Codex가 혼자 완성하지 않는다.
- 중요한 방향은 사용자와 먼저 상의한다.
- `PROJECT_TASKS.md`에는 플랫폼 세부 체크리스트를 다시 길게 넣지 않는다.
- 현재 작업의 범위와 순서는 사용자가 승인한 목표와 해당 세션의 검증 가능한 계획이 기준이다.
- 영구 태스크 보드, 오더 파일, 컨텍스트 인수인계 파일을 실행 조건으로 만들지 않는다.

## 2. Claude 사용 기준

Claude는 상시 작업자가 아니다.

아래 경우에만 사용자 또는 Codex가 호출한다.

| 호출 상황 | 목적 |
|---|---|
| Auth/RBAC/Storage/Payment 설계가 찝찝할 때 | 보안/구조 리스크 감리 |
| AppSheet 연동/흡수처럼 운영 충돌이 큰 결정을 할 때 | 반대 의견과 장기 리스크 확인 |
| Codex와 사용자가 모두 확신이 없을 때 | 외부 고추론 리뷰 |
| 중요한 PR 머지 전 추가 시선이 필요할 때 | 레드팀 검수 |

Claude에게 맡기지 않는 일:

- 단순 구현
- 일반 CSS/UI 수정
- 문서 정리
- Gemini가 빠르게 처리할 수 있는 CRUD 작업

## 3. 검증 책임

중복 검증을 기본값으로 두지 않는다.

| 작업 | 기본 담당 | Codex 재검증 조건 |
|---|---|---|
| `npm run lint` | Gemini | 실패/불확실/고위험 작업/PR 머지 전 |
| `npm run build` | Gemini | 실패/불확실/고위험 작업/배포 전 |
| 화면 스모크 테스트 | Gemini | 고객 핵심 플로우, 결제, 로그인, 어드민 큐 |
| diff 검수 | Codex | 항상 |
| 보안/RBAC 검수 | Codex | 항상, 필요 시 Claude 추가 |

작업자는 최종 보고에 실행한 검증과 미확인 항목을 반드시 남긴다.

예:

```text
검증:
- npm run lint: 통과
- npm run build: 통과
- 미확인: 실제 Kakao OAuth 원격 callback
```

## 4. GitHub, 배포, 릴리즈

커밋, 푸시, 배포, 릴리즈는 반드시 Codex만 해야 하는 작업이 아니다.

기본 운영:

- Gemini는 구현과 1차 검증까지 담당한다.
- Codex는 변경 범위와 의미를 보고 커밋 단위를 정리한다.
- 단순 작업은 작업자가 커밋까지 해도 된다.
- PR 본문, 최종 diff, 머지 전 판단은 Codex가 맡는 것을 기본으로 한다.
- 배포/릴리즈는 사용자 승인 후 진행한다.

Codex가 직접 다시 명령을 돌리는 경우:

- Auth/RBAC/Storage/Payment 작업
- 작업자 검증 보고가 비어 있거나 애매한 경우
- PR 머지 직전
- 배포 직전
- 보고는 통과인데 diff가 수상한 경우

## 5. 현재 실행 원칙

현재 작업자는 Gemini Flash 3.5 High로 확정한다.

Codex는 중복 실행자가 아니라 총괄 감리자다.

Claude는 필요할 때만 꺼내 쓰는 비싼 감리 카드다.

문서보다 실제 MVP 흐름을 우선한다.
