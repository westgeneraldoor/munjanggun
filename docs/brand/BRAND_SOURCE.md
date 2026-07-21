---
document_type: "Brand Source Reference"
version: "1.1.0"
status: "active"
created: "2026-06-25"
last_updated: "2026-07-15"
owner: "Codex PM"
central_brand_root: "C:\\Users\\hjh\\안티그래비티\\문장군_브랜드"
---

# BRAND_SOURCE - 문장군 중앙 브랜드 원본 참조

## 0. 목적

이 문서는 이 프로젝트가 문장군 콘텐츠, 디자인, 글, 영상, 자동화, QA를 만들 때 어떤 브랜드 원본을 먼저 읽어야 하는지 정한다.

앞으로 문장군 브랜드 정보는 프로젝트 안에 흩어진 오래된 문서를 우선하지 않는다. 중앙 브랜드 원본을 먼저 읽고, 이 프로젝트의 특수한 출력/검수 규칙은 `docs/brand/PROJECT_BRAND_ADAPTER.md`에서 보정한다.

## 1. 중앙 브랜드 원본 위치

공식 중앙 브랜드 원본:

```text
C:\Users\hjh\안티그래비티\문장군_브랜드
```

필수 확인 파일:

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_CONTEXT.md
C:\Users\hjh\안티그래비티\문장군_브랜드\FIELD_JUDGMENT_RULES.md
C:\Users\hjh\안티그래비티\문장군_브랜드\DESIGN.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PROJECT_ADAPTERS.md
C:\Users\hjh\안티그래비티\문장군_브랜드\CHANGELOG.md
```

## 2. 읽는 순서

문장군 브랜드, 콘텐츠, 디자인, 블로그, 영상, 자동화, QA와 관련된 작업은 아래 순서로 읽는다.

1. 중앙 `BRAND_CONTEXT.md`
2. 중앙 `FIELD_JUDGMENT_RULES.md`
3. 중앙 `DESIGN.md`
4. 중앙 `PROJECT_ADAPTERS.md`
5. 중앙 `CHANGELOG.md`
6. 이 문서 `docs/brand/BRAND_SOURCE.md`
7. 프로젝트 어댑터 `docs/brand/PROJECT_BRAND_ADAPTER.md`
8. 작업별 구현 문서

Content OS 작업은 추가로 아래를 확인한다.

```text
docs/platform/CONTENT_OS_STRATEGY.md
docs/platform/CONTENT_OS_PRD.md
docs/platform/CONTENT_OS_SCHEMA.md
docs/platform/CONTENT_OS_ADMIN_UX.md
docs/platform/CONTENT_OS_SEO_AEO_SPEC.md
docs/platform/CONTENT_OS_OPERATION_CHECKLIST.md
```

플랫폼 UI 작업은 기존 규칙대로 `docs/platform/PLATFORM_UI_CONSTITUTION.md`도 확인한다.

## 3. 우선순위

중앙 원본과 프로젝트 문서가 충돌하면 바로 덮어쓰지 않고 아래처럼 판단한다.

| 분류 | 뜻 | 처리 |
| --- | --- | --- |
| 중앙 우선 | 문장군 전체 브랜드 기준 | 프로젝트 문서와 출력물을 중앙 기준에 맞춘다 |
| 프로젝트 우선 | 이 웹앱/Content OS/쇼룸에만 필요한 규칙 | `PROJECT_BRAND_ADAPTER.md`에 남긴다 |
| 중앙 업데이트 후보 | 프로젝트 문서가 더 최신이거나 더 정확한 정보 | 중앙 브랜드 폴더 업데이트 후보로 감사 문서에 남긴다 |
| 확인 필요 | 사실 여부가 불확실하거나 운영 결정이 필요한 정보 | 사장 확인 전 공개 콘텐츠에 쓰지 않는다 |

## 4. 중앙 원본 접근이 안 될 때

중앙 브랜드 폴더를 읽을 수 없으면 임의로 오래된 프로젝트 문서를 공식 기준으로 간주하지 않는다.

fallback 순서:

1. 이 문서와 `PROJECT_BRAND_ADAPTER.md`의 요약 기준을 사용한다.
2. `docs/platform/BRAND_CONTEXT.md`는 레거시 참고 문서로만 사용한다.
3. 최신 숫자, 가격, 리뷰 수, 서비스 지역, 이벤트, A/S 조건은 공개 발행 전 확인 필요로 표시한다.
4. 중앙 원본 접근 실패 사실을 작업 보고에 남긴다.

## 5. 민감정보 금지

중앙 브랜드 폴더와 이 프로젝트 문서에는 아래 정보를 넣지 않는다.

- 고객명
- 전화번호
- 상세 주소와 동호수
- AppSheet 원본 레코드
- 상담 원문
- 네이버 관리자 통계 원본 XLSX/PNG
- 현장 사진 원본
- 비공개 매출, 계정, 토큰, 쿠키

필요한 경우 아래처럼 비식별 요약 또는 `evidence_ref`만 남긴다.

```text
비식별 요약: 수원 구축 아파트에서 신발장 간섭 때문에 중문틀 고정 공간을 확인한 사례
evidence_ref: appsheet_case_2026_06_redacted_001
```

## 6. 이 프로젝트의 기존 브랜드 문서 처리

`docs/platform/BRAND_CONTEXT.md`는 중앙 원본 이전에 만들어진 프로젝트 문서다. 삭제하지 않는다. 다만 앞으로 공식 브랜드 기준은 중앙 원본이며, 이 문서는 다음 용도로만 사용한다.

- 중앙 원본과 비교할 레거시 참고 자료
- 플랫폼 전략 수립 당시의 판단 근거
- 중앙 업데이트 후보 발굴 자료

새 콘텐츠를 작성할 때 `docs/platform/BRAND_CONTEXT.md`만 보고 발행하면 안 된다.

## 7. 중앙 승인 자산의 프로젝트 재사용 계약

중앙 브랜드 저장소의 product asset manifest가 가리키는 파일 중 `privacyStatus = official_reviewed`인 항목은 문장군 프로젝트가 검증된 서버 경로로 가져올 수 있는 공식 원본 소스다. 이 상태는 개인정보·OCR 재검수를 반복하지 않아도 된다는 뜻이지, 자동 공개 승인이라는 뜻은 아니다.

프로젝트 재사용 시 다음을 모두 지킨다.

- manifest의 `assetId`, `productId`, `sourceId`, `proofId`, `repositoryPath`, byte size, dimensions, GIF frame count, SHA-256을 실제 파일과 대조한다.
- 중앙 저장소의 허용된 root 밖 경로, symlink 탈출, Git LFS pointer, MIME magic 불일치 파일은 거부한다.
- `usageStatus`, `privacyStatus`, `claimRisk`, `externalPublish`, 중앙 commit을 프로젝트 provenance와 감사 이벤트에 보존한다.
- 중앙 `candidate`는 프로젝트에서도 비공개 후보로 시작한다. `official_reviewed`를 `approved_public`이나 홍보 사용 동의로 바꾸지 않는다.
- 가격·이벤트·스펙·운영 조건이 들어갈 수 있는 자산은 `claimRisk`와 `externalPublish`에 따라 최신성 검수를 별도로 통과해야 한다.

금지되는 것은 서버측 등록 자체가 아니라 검증·권한·감사·발행 승격 경계를 우회한 등록이다.

## 8. v5 토큰 스냅샷

이 프로젝트는 중앙 토큰을 런타임 로컬 경로에서 직접 읽지 않는다. 중앙 디자인 v5의 아래 커밋을 결정론적 생성물로 고정한다.

```text
source commit: e6b6eb618e08b907307497d87f58995bd945531c
source CSS: tokens/brand.css
source JSON: tokens/brand.tokens.json
generated CSS: src/styles/generated/brand.css
generated JSON: src/styles/generated/brand.tokens.json
manifest: src/styles/generated/brand.manifest.json
```

`brand.manifest.json`은 소스/생성 파일의 SHA-256과 고유 토큰 수를 기록한다. 오프라인 검증기는 이 가변 파일만 신뢰하지 않고, 코드에 고정된 커밋·경로·버전·토큰 수·소스/생성 SHA-256 계약과 manifest 전체가 일치하는지 먼저 확인한다. 절대 경로, 작업자, 생성 시각은 넣지 않는다. 중앙 저장소는 읽기 전용이며 동기화는 프로젝트 쪽 생성물만 갱신한다.

2026-07-20 통합 검증에서 중앙 source는 clean worktree의 `e6b6eb618e08b907307497d87f58995bd945531c`(`e6b6eb6`), `DESIGN.md` v5.0, 고유 토큰 114개로 확인했다. `codex/platform-admin-blog-stabilization`은 `v2-cms`를 base로 프로젝트 생성물만 다루며 중앙 저장소를 수정하지 않았다. Draft PR 번호는 생성 후 기록할 pending 값이다.

```text
npm run sync:brand-tokens
npm run verify:brand-tokens
npm run check:brand-token-drift
npm run verify:ui-token-policy
```

기본 중앙 경로 탐색은 Git common directory를 기준으로 하므로 linked worktree에서도 동작한다. 다른 중앙 체크아웃을 확인해야 할 때만 `MUNJANGGUN_BRAND_ROOT`를 명시한다. 명시한 경로가 잘못됐거나 없으면 실패하며, 기본 경로가 없는 환경의 drift 확인만 명확한 skip으로 처리한다.
