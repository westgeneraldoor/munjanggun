# Blog production readiness

최종 갱신: 2026-07-20

## 1. 현재 운영 정책 (current)

문장군 블로그의 현재 원고 인계와 발행 흐름은 아래와 같다.

```text
Codex 완성 원고 → 승인 원고 등록 → reviewing 콘텐츠 큐 → 사진·검수 → 미리보기 → 발행
```

- Codex는 중앙 브랜드 원본과 블로그 운영 근거를 확인해 완성 원고와 구조화된 메타데이터를 외부에서 작성한다.
- 완성 원고는 인증된 관리자가 CMS의 `승인 원고 등록`에서 제목, slug, SEO/AEO 필드와 본문 블록을 등록한다. 내부 provenance는 서버가 자동 기록한다.
- 중앙 브랜드 manifest의 `privacyStatus = official_reviewed` 자산은 공식 원본 소스다. 관리자는 사진보관함 UI를, Codex는 `scripts/register-official-brand-asset.mjs` 서버 명령을 사용하며 두 경로는 같은 원본 검증 모듈을 호출한다. service-role은 서버에서만 사용한다.
- 새 승인 원고는 명시적으로 `reviewing`으로 등록되며, 사진 연결, 사실·브랜드 검수, 미리보기, 발행은 기존 CMS 게이트를 계속 통과한다.
- 사람용 사진 업로드는 개인정보와 블로그·홍보 활용 가능 여부를 운영자가 각각 확인해야 하며, 서버도 두 확인값이 모두 없으면 업로드를 거부한다. 중앙 `official_reviewed` import는 개인정보 검수를 승계하되 홍보 동의는 `false`인 비공개 후보로 등록하며, 미디어 승인과 발행 전에 프로젝트 홍보 동의를 별도로 확인한다.
- `ready`와 `published` 전환은 대표 사진 또는 비어 있지 않은 사진 부족 사유가 있어야 통과한다.
- 공개 글의 authored title, SEO title, 설명, canonical URL, 대표 사진, 발행·수정일, breadcrumb는 하나의 public presentation model에서 역할을 나눠 metadata, JSON-LD, 화면에 반영한다.
- AI/OpenAI 키, 모델 식별자, 환경 변수, 설정은 이 수동 인계와 발행에 필요 없다. 제거된 AI 초안 기능이나 설정을 다시 도입하지 않는다.
- 기존 enum·RLS와 공개 `/blog`의 `published` 전용 범위는 유지한다. 필요한 DB 변경은 검토 가능한 migration으로만 추가한다. 승인 원고 등록과 `reviewing` 글 연결은 service-role 전용 원자 RPC를 사용하고, 공식 자산의 Storage·메타데이터 등록과 공개 승격은 검증된 서버 흐름과 실패 시 보상 정리를 사용한다. 임의 SQL이나 검증 없는 Storage 쓰기는 허용하지 않는다.

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
| 승인 원고 등록 | Ready | 관리자 권한, 필수 메타데이터·본문 블록 검증, 서버 자동 provenance, 원자 RPC, `reviewing` INSERT와 감사 이벤트 회귀 검증 통과 |
| 콘텐츠 큐·편집·사진 | Ready for reviewing | 실제 중앙 브랜드 베이직 JPG 2건과 GIF 1건을 서버 명령으로 등록했다. 감사 detach 뒤 운영 원고는 27개 블록, image block 2개, active private media 3개이며 원고는 `reviewing`, `published_at = null`이다. |
| 사진 업로드 안전 | Ready | 두 업로드 화면과 서버에서 개인정보·홍보 활용 확인을 함께 요구하고 자동 승인값을 저장하지 않는 회귀 검증 통과 |
| 대표 사진 게이트 | Ready | `ready`와 `published` 모두 대표 사진 또는 관리자가 입력·저장한 비공백 사진 부족 사유를 요구하는 회귀 검증 통과 |
| 공개 표현 정합성 | Ready | authored title은 H1·JSON-LD headline, SEO title은 metadata에만 쓰고 선택된 대표 사진·breadcrumb·날짜가 화면과 구조화 데이터에서 일치하는 회귀 검증 통과 |
| 공개 범위 | Unchanged | `published` 글과 발행된 미디어만 공개 경로와 sitemap에 포함되는 기존 계약 유지 |
| DB/RLS | Ready | provenance·공식 자산·원자 연결, 어드민 원자 저장, Storage·lease, preview, detach migration을 승인된 경로로 원격 적용했다. public anon 객체 목록 권한은 제거했고 service-role RPC는 서버에서만 실행된다. |
| 실제 접근 리허설 | Ready for reviewing; publication not exercised | 알려진 public object URL HTTP 200, anon 객체 목록 0건, private signed URL HTTP 200을 확인했다. 실제 원고의 `ready`·`published` 전환이나 미디어 공개 승격은 수행하지 않았다. |

도입 순서 기준은 `RPC migration 적용·권한 확인 → 웹 배포 → Preview 등록 검증`이다. 현재는 원격 migration, 실제 원고의 `reviewing` 등록, 중앙 자산 세 건의 검증·비공개 업로드·감사 기록·사진 연결, 인증된 편집기와 저장 미리보기 확인까지 완료했다. 실제 등록 행은 발행하지 않고 검수 큐에 유지한다. 새 환경에 배포할 때도 RPC가 없는 DB에 웹 코드를 먼저 배포하지 않는다.

실제 중앙 GIF는 비공개 원본의 checksum, MIME, 860×830 크기와 2-frame 애니메이션을 검증했고 CMS 미리보기에서 원본 경로로 표시했다. 공개 GIF 회귀는 개발 전용 deterministic fixture로 원본 `.gif`, `image/gif`, 두 프레임, alt, caption과 390px 렌더링을 확인했다. 실제 `reviewing` 원고나 그 GIF를 공개 발행했다는 뜻은 아니다.

### 3.1 2026-07-20 통합 증거

- 중앙 source는 clean `e6b6eb618e08b907307497d87f58995bd945531c`(`e6b6eb6`), `DESIGN.md` v5.0, 고유 토큰 114개다. 중앙 저장소는 수정하지 않았다.
- 통합 브랜치는 `codex/platform-admin-blog-stabilization`, base는 `v2-cms`다. 통합 Draft PR은 [#73](https://github.com/westgeneraldoor/munjanggun/pull/73)이다.
- 첫 원고는 `reviewing`, `published_at = null`, 27개 블록, image block 2개, active private media 3개다. `mg-3panel-thumbnail-basic-001`은 감사 detach했으며 중앙 asset과 file row 3개는 보존했다.
- 실제 발행과 public promotion은 수행하지 않았다.

| 상태 | 원격 migration version |
| --- | --- |
| aligned | `20260715090227`, `20260715233310`, `20260715235109`, `20260715235349`, `20260720005042`, `20260720005052` |
| newly applied | `20260720074812`, `20260720074843`, `20260720074917`, `20260720074955`, `20260720075020`, `20260720075047`, `20260720075242`, `20260720084910` |

어드민·블로그 최종 verifier는 token usage CSS 64개를 재귀 탐지하며 state-scope invariant를 유지한다. 최종 결과는 raw color 0, raw shadow 0, 미승인 raw layout 0, 미정의 custom property 0이며 property·value·reason 범위로 명명된 layout 예외는 45개다.

### Preview 환경변수 사전 점검

승인 원고 등록을 검증할 Preview 브랜치에는 아래 세 값이 필요하다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — sensitive로 관리하며 서버에서만 사용

브랜치 전용 값은 필요한 Preview 범위에만 설정하고 작업 종료 후 제거한다. AI/OpenAI 키·모델·AI 초안용 환경변수는 현재 흐름에 필요 없다. 비밀값의 실제 내용은 문서, Git, PR 본문, 로그에 기록하지 않는다.

릴리스 전에는 다음 로컬 검증을 모두 통과한다.

1. `npm run verify:blog-admin-cms`
2. `npm run test:official-brand-asset-import`
3. `npm run test:official-brand-asset-placement`
4. `npm run test:official-media-evidence-docs`
5. `npm run test:blog-public-gif-browser`
6. `npm run verify:blog-public-safety`
7. `npm run verify:blog-body-blocks`
8. `npm run verify:blog-claim-safety`
9. `npm run lint`
10. `npm run build`
11. `git diff --check`

## 4. 운영자 수동 점검 (current)

1. 관리자 계정으로 승인 원고 등록 화면에서 완성 원고를 등록한다. 내부 provenance는 서버가 자동 기록하므로 운영자가 입력하지 않는다.
2. `reviewing` 콘텐츠 큐에서 제목, slug, SEO/AEO, 본문 블록과 금지표현 경고를 검수한다.
3. 필요한 사진을 연결하고 alt, 개인정보, 홍보 활용 확인을 완료한다. 대표 사진이 없으면 구체적인 사진 부족 사유를 기록하고, 사진이 핵심 근거인데 부족하면 `needs_media`에 남긴다.
4. 기존 에디터의 검수 게이트와 관리자 미리보기를 통과한 뒤에만 `ready` 및 `published` 전환을 수행한다.

이 점검은 수동 발행 승인 절차다. 검색 노출이나 발행 성공을 보장하지 않으며, 운영 데이터·계정·비밀값을 이 문서나 Git에 기록하지 않는다.
