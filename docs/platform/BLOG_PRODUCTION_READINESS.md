# Blog production readiness

최종 갱신: 2026-07-14

## 1. 현재 운영 정책 (current)

문장군 블로그의 현재 원고 인계와 발행 흐름은 아래와 같다.

```text
Codex 완성 원고 → 승인 원고 등록 → reviewing 콘텐츠 큐 → 사진·검수 → 미리보기 → 발행
```

- Codex는 중앙 브랜드 원본과 블로그 운영 근거를 확인해 완성 원고와 구조화된 메타데이터를 외부에서 작성한다.
- 인증된 관리자만 CMS의 `승인 원고 등록`에서 제목, slug, SEO/AEO 필드, 본문 블록, 근거를 구조화해 등록한다.
- 새 승인 원고는 명시적으로 `reviewing`으로 등록되며, 사진 연결, 사실·브랜드 검수, 미리보기, 발행은 기존 CMS 게이트를 계속 통과한다.
- AI/OpenAI 키, 모델 식별자, 환경 변수, 설정은 이 수동 인계와 발행에 필요 없다. 제거된 AI 초안 기능이나 설정을 다시 도입하지 않는다.
- DB schema, RLS 정책, 공개 `/blog` 렌더링 범위는 이 등록 경로 때문에 변경하지 않는다.

## 2. 과거 Preview 증거 (historical)

이 절은 2026-07-13 `codex/content-os-production-readiness`의 Preview 점검 기록을 보존한 historical evidence다. 아래는 현재 운영 선행조건이나 재현 절차가 아니다.

원본 근거는 Git commit `a7fc8c0`의 같은 파일이며, 현재 문서는 그 증적을 삭제하지 않고 수동 원고 인계 정책과 분리해 요약한다.

| 당시 점검 항목 | 당시 결과 | 보존 이유 |
| --- | --- | --- |
| 공개 데이터 범위, sitemap, robots | published 전용 동작을 정적으로 확인 | 공개 범위가 별도 전환 없이 유지됨을 기록 |
| JSON-LD·metadata·화면 | 공용 public presentation resolver로 정합성 확인 | 공개 렌더링 계약의 과거 검증 근거 |
| private 원본·public 파생본·alt·동의 | 서버와 관리자 화면의 게이트를 정적으로 확인 | 사진 공개 경계의 과거 근거 |
| public media inventory | `INV-BLOG-MEDIA-20260625-01` 재집계에서 미추적 후보 0건 | 당시 inventory 정리 결과 보존 |
| Preview AI 설정과 무발행 리허설 | 당시 Preview 환경/테스트 계정 준비가 막혀 미완료 | 제거된 AI 초안 모델의 미완료 상태를 현행 요구사항으로 오인하지 않기 위함 |

당시 정적 검증은 `verify:blog-public-safety`, `verify:blog-body-blocks`, `verify:blog-claim-safety`, AI draft schema 검증, lint, build, `git diff --check`를 기록했다. 공개 `/blog` 응답과 인증 없는 관리자 경로의 로그인 redirect도 Preview에서 관찰했으며, production·Supabase 운영 데이터를 수정하지 않았다고 기록했다.

과거 Preview 문서에 있던 AI 환경, 비밀값, AI draft 리허설, 첫 AI 초안 관련 문구는 historical evidence로만 남긴다. 현재 CMS는 외부 완성 원고의 수동 등록을 사용하며, 과거 설정을 확인하거나 복구하지 않는다.

## 3. 현재 릴리스 준비도 (current)

| 구분 | 현재 판정 | 확인 방법 |
| --- | --- | --- |
| 승인 원고 등록 | Ready when verified | 관리자 권한, 필수 메타데이터·본문 블록 검증, `reviewing` INSERT와 감사 이벤트를 확인 |
| 콘텐츠 큐·편집·사진 | Ready when verified | 등록 후 `reviewing` 큐에서 기존 에디터로 이동하고 사진·브랜드·사실 검수를 진행 |
| 공개 범위 | Unchanged | `published` 글과 발행된 미디어만 공개 경로와 sitemap에 포함되는 기존 계약 유지 |
| DB/RLS | Unchanged | 기존 enum과 관리자 정책을 재사용하며 migration 또는 RLS 변경 없음 |
| 외부 접근 리허설 | Not run by this change | 원격 데이터, 계정, 배포 상태를 변경하거나 테스트하지 않음 |

릴리스 전에는 다음 로컬 검증을 모두 통과한다.

1. `npm run verify:blog-admin-cms`
2. `npm run verify:blog-public-safety`
3. `npm run verify:blog-body-blocks`
4. `npm run verify:blog-claim-safety`
5. `npm run lint`
6. `npm run build`
7. `git diff --check`

## 4. 운영자 수동 점검 (current)

1. 관리자 계정으로 승인 원고 등록 화면에서 완성 원고와 근거를 등록한다.
2. `reviewing` 콘텐츠 큐에서 제목, slug, SEO/AEO, 본문 블록, 근거와 금지표현 경고를 검수한다.
3. 필요한 사진을 연결하고 alt, 개인정보, 홍보 활용 확인을 완료한다. 사진이 핵심 근거인데 부족하면 `needs_media`에 남긴다.
4. 기존 에디터의 검수 게이트와 관리자 미리보기를 통과한 뒤에만 `ready` 및 `published` 전환을 수행한다.

이 점검은 수동 발행 승인 절차다. 검색 노출이나 발행 성공을 보장하지 않으며, 운영 데이터·계정·비밀값을 이 문서나 Git에 기록하지 않는다.
