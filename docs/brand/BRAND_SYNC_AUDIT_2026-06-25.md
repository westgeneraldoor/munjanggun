---
document_type: "Brand Sync Audit"
version: "1.0.0"
status: "complete"
created: "2026-06-25"
owner: "Codex PM"
central_brand_root: "C:\\Users\\hjh\\안티그래비티\\문장군_브랜드"
---

# BRAND_SYNC_AUDIT_2026-06-25 - 중앙 브랜드 원본 동기화 감사

## 0. 감사 목적

문장군 중앙 브랜드 원본과 이 프로젝트 내부 문서를 비교해, 앞으로 어떤 문서를 우선하고 어떤 규칙을 프로젝트 전용으로 남길지 정리한다.

이번 작업은 기존 프로젝트 브랜드 문서를 삭제하거나 덮어쓰기 위한 작업이 아니다. 중앙 브랜드 원본과 프로젝트 어댑터 구조를 만들어, 앞으로 글, 디자인, 영상, 자동화, QA가 같은 기준을 보도록 만드는 작업이다.

## 1. 확인한 중앙 원본

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_CONTEXT.md
C:\Users\hjh\안티그래비티\문장군_브랜드\FIELD_JUDGMENT_RULES.md
C:\Users\hjh\안티그래비티\문장군_브랜드\DESIGN.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PROJECT_ADAPTERS.md
C:\Users\hjh\안티그래비티\문장군_브랜드\CHANGELOG.md
```

## 2. 확인한 프로젝트 문서

주요 확인 문서:

```text
AGENTS.md
README.md
docs/README.md
docs/platform/BRAND_CONTEXT.md
docs/platform/PLATFORM_STRATEGY.md
docs/platform/PLATFORM_TASKS.md
docs/platform/DEVELOPMENT_STRATEGY.md
docs/platform/TEAM_AGENT_OPERATING_MODEL.md
docs/platform/PLATFORM_UI_CONSTITUTION.md
docs/platform/CONTENT_OS_STRATEGY.md
docs/platform/CONTENT_OS_PRD.md
docs/platform/CONTENT_OS_ADMIN_UX.md
docs/platform/CONTENT_OS_SEO_AEO_SPEC.md
docs/platform/CONTENT_OS_OPERATION_CHECKLIST.md
docs/showroom/DESIGN_SYSTEM.md
```

검색 범위:

```text
AGENTS.md
README.md
docs/**/*.md
```

검색 키워드:

```text
문장군, 브랜드, BRAND_CONTEXT, DESIGN, SEO, AEO, Content OS, 무료 방문, 실측, 금지, 리뷰, 개인정보, privacy
```

## 3. 중앙 우선

아래는 중앙 브랜드 원본이 맞고, 프로젝트 문서나 새 출력물이 중앙 기준을 따라야 하는 항목이다.

| 항목 | 중앙 기준 | 프로젝트 처리 |
| --- | --- | --- |
| 브랜드 정의 | 무료 방문실측으로 집에 맞는 선택을 돕고 직접 제작과 전속 시공으로 끝까지 책임지는 도어·중문 전문 브랜드 | `BRAND_SOURCE.md`와 `PROJECT_BRAND_ADAPTER.md`에 중앙 우선으로 고정 |
| 핵심 카피 | "좋은 문을 고르는 일, 어렵지 않게 도와드립니다." | 블로그/브랜드/CTA의 기본 톤 기준으로 사용 |
| 리뷰 표현 | 전체 상품 리뷰 3만 개+, 대표상품 단일 리뷰 1.4만 개+ | 기존 15,000개+ 전체 브랜드 표현은 공개 글에서 사용 금지 |
| 가격 표현 | 가격은 숨기지 않되 조건과 무료 실측 필요성을 함께 설명 | 구체 가격 단정 대신 범위+조건+실측 CTA 사용 |
| 금지 표현 | 최저가, No.1, 100%, 무조건 가능, 절대 추가금 없음, 보양 작업 후 청소 등 금지 | Content OS 발행 게이트와 브랜드 체크 기준으로 유지 |
| 현장 판단 | 제품명보다 고객 오해, 구조, 추가금, 시공 가능 여부를 먼저 설명 | 글 구조와 QA 기준에 반영 |
| 사진 활용 | 실제 고객 사진은 개인정보/홍보동의 확인 후 사용 | Content OS private/public media gate와 연결 |
| 디자인 방향 | Warm Home, Guided Choice, Verified Work | 새 블로그/브랜드형 화면은 중앙 DESIGN 우선 |

## 4. 프로젝트 우선

아래는 이 프로젝트의 특성상 중앙 원본에 섞지 않고 프로젝트 어댑터나 플랫폼 문서에 남겨야 한다.

| 항목 | 이유 | 유지 위치 |
| --- | --- | --- |
| Content OS 발행 플로우 | 이 앱의 구현/운영 구조 | `docs/platform/CONTENT_OS_*`, `PROJECT_BRAND_ADAPTER.md` |
| AI 초안과 사람 승인 분리 | 중앙 브랜드 원칙보다 구체적인 시스템 정책 | `CONTENT_OS_PRD.md`, `CONTENT_OS_ADMIN_UX.md` |
| private/public media bucket 구조 | Supabase 구현과 보안 정책 | `CONTENT_OS_SCHEMA.md`, `CONTENT_OS_OPERATION_CHECKLIST.md` |
| publish server action 검수 게이트 | 앱 구현 로직 | Content OS 구현/운영 문서 |
| sitemap/robots/metadata/JSON-LD | Next.js 기술 사양 | `CONTENT_OS_SEO_AEO_SPEC.md` |
| 플랫폼 고객 여정 | 쇼핑몰이 아닌 고객 여정 통합 포털 전략 | `PLATFORM_STRATEGY.md` |
| 플랫폼 UI 헌법 | 고객 포털/어드민 화면 사용성 규칙 | `PLATFORM_UI_CONSTITUTION.md` |
| 쇼룸 다크 갤러리 톤 | 기존 컬러북/쇼룸 전용 경험 | `docs/showroom/DESIGN_SYSTEM.md` |

## 5. 중앙 업데이트 후보

아래는 이 프로젝트에서 발견된 운영 지식 중 중앙 브랜드 폴더로 승격을 검토할 만한 항목이다.

| 후보 | 이유 | 제안 |
| --- | --- | --- |
| Content OS형 발행 게이트 | 문장군 콘텐츠 운영 전체에 재사용 가능 | 중앙 `PROJECT_ADAPTERS.md`의 블로그 예시에 "AI 초안 -> 사람 검수 -> 사진 승인 -> 발행" 구조를 추가 검토 |
| public/private 사진 분리 원칙 | 인스타, 릴스, 블로그 모두 고객 사진 보호에 필요 | 중앙 프로젝트 어댑터 예시에 "후보 원본과 공개본 분리" 원칙 추가 검토 |
| Q&A 자산 원칙 | 블로그뿐 아니라 고객 상담/릴스/FAQ에도 유용 | 중앙 콘텐츠 전략 보조 항목으로 승격 검토 |
| 운영 리허설 체크리스트 | 실제 발행 전 storage, public leak, sitemap, robots 확인 구조 | 중앙 QA 템플릿 후보로 검토 |
| 플랫폼 고객 여정 표현 | "쇼핑몰이 아니라 고객 여정 통합 포털"은 문장군 장기 방향에 중요 | 중앙 브랜드 전략 또는 프로젝트 예시로 승격 검토 |

## 6. 확인 필요

아래는 사실 여부나 운영 범위가 불확실하므로 사장 확인 전 공개 글에 확정 표현으로 쓰지 않는다.

| 항목 | 이유 | 처리 |
| --- | --- | --- |
| 리뷰 수 최신값 | 중앙 기준은 2026-06 캡처 기준 | 발행 전 최신 캡처 또는 근거 확인 |
| 대표상품 단일 리뷰 1.4만 개+ | 특정 상품 기준이므로 범위 오해 가능 | 문구에 "대표상품 단일" 명시 |
| 월 납입 가격대 | 조건, 카드/할부, 상품 기준에 따라 달라질 수 있음 | 가격 콘텐츠 발행 전 최신 정책 확인 |
| 리뷰 이벤트 혜택 | 기존 프로젝트 문서의 이벤트는 변경 가능성이 큼 | 공개 사용 전 현재 이벤트 확인 |
| 서비스 가능 지역 | 운영 정책과 요일 제한이 바뀔 수 있음 | 플랫폼 설정/운영자 확인 후 사용 |
| 현관문/기타 품목 범위 | 중앙 원본도 프로젝트별 확인 필요로 표시 | 글 주제로 잡기 전 운영 범위 확인 |
| 하루 최대 시공 현장 수 | 기존 문서에는 최대 35현장 등 숫자가 있으나 맥락 필요 | 공개 콘텐츠에는 보수적으로 표현 |
| 중앙 CHANGELOG의 `BLOG_BRAND_ADAPTER.md` 명칭 | 이 프로젝트는 `PROJECT_BRAND_ADAPTER.md`를 채택 | 중앙 문서와 명칭 통일 여부 확인 |

## 7. 충돌 또는 차이

### `docs/platform/BRAND_CONTEXT.md`

이 문서는 중앙 원본보다 오래된 프로젝트 브랜드 문서다.

중앙과 같은 방향:

- 회사 기본 정보
- 무료 방문실측 중심
- 직접 제작/전속 시공
- AppSheet 운영 체계
- A/S 기간
- 고객 불안과 추가금 설명

중앙과 다른 점:

- 리뷰를 `15,000개+ / 4,000개+` 중심으로 표현한다.
- 일부 문구가 "현장 갑작스런 추가금 없음"처럼 단정적으로 읽힐 수 있다.
- 이벤트 혜택과 서비스 지역 등 시점 민감 정보가 포함되어 있다.
- 블로그 금지 표현 중 "구체적 가격 수치" 금지가 중앙의 "가격대+조건 설명" 원칙보다 강하다.

처리:

- 삭제하지 않는다.
- 공식 브랜드 원본으로 보지 않는다.
- 중앙 업데이트 후보와 확인 필요 항목을 발굴하는 참고 문서로 둔다.

### `docs/showroom/DESIGN_SYSTEM.md`

중앙 DESIGN은 밝고 따뜻한 주거 전문가 톤을 기준으로 한다. 쇼룸 DESIGN_SYSTEM은 다크 미니멀 갤러리 톤을 기준으로 한다.

처리:

- 쇼룸/컬러북 전용 규칙으로 유지한다.
- 새 블로그, 브랜드형 랜딩, 플랫폼 고객 여정에는 중앙 DESIGN을 우선한다.

### Content OS 문서

Content OS 문서는 브랜드 자체보다 발행 시스템을 정의한다.

처리:

- 프로젝트 우선으로 유지한다.
- 다만 `source_brand_context`가 기존 `docs/platform/BRAND_CONTEXT.md`를 가리키는 문서는 후속으로 `docs/brand/BRAND_SOURCE.md`와 `PROJECT_BRAND_ADAPTER.md`를 참조하도록 정리할 수 있다.

## 8. 이번 작업으로 수정한 파일

새로 만든 파일:

```text
docs/brand/BRAND_SOURCE.md
docs/brand/PROJECT_BRAND_ADAPTER.md
docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md
```

수정한 파일:

```text
AGENTS.md
docs/README.md
docs/platform/BRAND_CONTEXT.md
```

## 9. 최종 판단

중앙 브랜드 원본 연결은 완료했다.

앞으로 이 프로젝트에서 문장군 콘텐츠, 디자인, 글, 영상, 자동화, QA를 만들 때는 중앙 브랜드 원본을 먼저 읽고, 이 프로젝트 전용 발행/검수/보안 규칙은 `PROJECT_BRAND_ADAPTER.md`를 따른다.

운영 판단:

```text
중앙 브랜드 원본: 공식 기준
프로젝트 어댑터: 이 앱의 적용/검수 기준
기존 platform BRAND_CONTEXT: 레거시 참고 및 중앙 업데이트 후보 발굴 자료
```

## 10. 2026-07-14 현재 정책 (current)

이 감사는 2026-06-25의 동기화 판단을 보존하는 문서다. 이후 Content OS의 현행 원고 인계 정책은 Codex가 외부에서 완성한 원고를 인증된 관리자가 구조화해 등록하고, `reviewing` 콘텐츠 큐에서 사진·검수·미리보기·발행을 진행하는 모델이다.

이 감사의 과거 AI 초안 언급은 historical evidence이며 current policy가 아니다. 제거된 AI 초안 생성, 키·모델·환경변수 설정은 현재 CMS 정책이나 운영 선행조건으로 복구하지 않는다.
