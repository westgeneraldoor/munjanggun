# Blog production readiness

최종 갱신: 2026-07-13

## 현재 판정

공개 발행은 아직 금지다. 공개 JSON-LD/화면 불일치와 기존 public 객체 inventory 차단은 코드·집계 검증으로 해소했지만, Preview AI 비밀 설정과 실제 무발행 리허설은 아직 완료되지 않았다.

| 구분 | 상태 | 근거 또는 다음 조치 |
| --- | --- | --- |
| 공개 글 데이터 범위 | Ready | public query, sitemap, robots는 기존의 published 전용 동작을 유지한다. |
| JSON-LD·metadata·화면 일치 | Ready | 하나의 `resolvePublicBlogPresentation`이 title, description, canonical URL, 대표 이미지, 날짜, breadcrumb를 제공한다. 수정일은 화면에도 명시한다. |
| AI draft 저장 계약 | Ready (정적 검증) | AI action은 `ai_draft`, `published_at: null`을 강제한다. 실제 생성 리허설은 아직이다. |
| target question·summary·SEO | Ready (정적 검증) | target question과 canonical description을 화면에 표시하고, summary answer는 서로 다를 때 별도로 표시한다. |
| 근거·금지표현·필수 사진 슬롯 | Ready (정적 검증) | ready/publish gate가 claim safety, forbidden expression, 필수 사진 슬롯, 대표 사진 또는 기록된 예외를 검사한다. |
| private 원본·public 파생본·alt·동의 경계 | Ready (정적 검증) | 업로드는 private original과 public derivatives를 분리하고, 개인정보·홍보 사용 확인을 서버와 두 관리자 업로드 화면에서 모두 요구한다. |
| public media inventory | Ready | `INV-BLOG-MEDIA-20260625-01`의 미추적 후보 1건을 삭제했고, 미추적 수가 0인지 재집계했다. |
| Preview AI 환경 | Blocked | Preview에서만 세 환경변수의 존재·유효 모델을 비밀값 없이 확인해야 한다. Production은 수정하지 않는다. |
| 테스트 administrator 계정 | Needs operator action | Preview에서 로그인 가능한 최소 권한 administrator 계정을 준비·확인해야 한다. |
| 무발행 리허설 | Blocked | Preview AI enabled와 administrator 확인 뒤에만 실행한다. |
| 첫 3개 실제 AI 초안 | Blocked | 리허설 cleanup이 0 잔여로 확인되고 재승인된 뒤에만 시작한다. |

## 구현 및 정적 검증 근거

### Canonical public render model

- 공개 `/blog/[slug]`의 metadata, Open Graph, JSON-LD `BlogPosting`, JSON-LD `BreadcrumbList`, visible article hero가 공용 resolver를 사용한다.
- 대표 이미지는 실제 hero가 쓰는 단일 cover 계약만 JSON-LD/OG에 사용한다. cover가 없으면 세 표면 모두 image를 생략한다.
- JSON-LD의 `dateModified`는 hero의 `업데이트` 표기로 항상 함께 보인다.
- sitemap, robots, published 필터는 변경하지 않았다.

### 사진과 발행 gate

- `required_media` 문단 슬롯은 바로 앞 image block의 동일 post media 연결이 없으면 ready/publish 모두 차단한다.
- ready/publish는 cover가 있거나 기록된 media missing reason이 있어야 통과한다.
- 실제 사용 사진은 alt, 개인정보 확인, 홍보 사용 확인, private 원본 연결을 계속 요구한다.

### 수행한 검증

| 명령 | 결과 |
| --- | --- |
| `npm run verify:blog-public-safety` | 통과 |
| `npm run verify:blog-body-blocks` | 통과 |
| `npm run verify:blog-claim-safety` | 통과 |
| `npm run verify:blog-ai-draft-schema` | 통과 |
| `npm run lint` | 통과 (기존 경고 6건, 오류 0건) |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |

## Preview AI 설정: 운영자 단일 조치

Preview 환경에만 다음을 비밀 관리 화면에서 설정하거나 존재를 확인한다. 값, 키, 설정 화면의 비밀값은 채팅·문서·git diff·로그에 복사하지 않는다.

| 변수 | Preview 요구값 |
| --- | --- |
| `CONTENT_OS_AI_DRAFTS_ENABLED` | `enabled` |
| `OPENAI_API_KEY` | 현재 OpenAI project의 유효한 서버 전용 key |
| `OPENAI_BLOG_DRAFT_MODEL` | 해당 key로 호출 가능한 승인된 model identifier |

확인 기준은 Preview admin에서 AI 초안 생성 기능이 enabled로 표시되고, 실제 생성 직전 안전한 config view가 세 변수를 충족한다고 판단하는 것이다. Production 환경은 열람·수정하지 않는다.

## 무발행 리허설 절차

시작 전: 위 Preview AI 조건, 테스트 administrator 로그인, 이 문서의 JSON-LD 및 inventory 항목 Ready를 모두 확인한다.

1. 개인정보가 없는 합성 evidence와 식별 불가능한 테스트 주제로 AI draft를 정확히 1건 생성한다.
2. 상태가 `ai_draft`, `published_at = null`인지 확인한다. publish action은 실행하지 않는다.
3. target question, summary answer, SEO 필드, source evidence, 금지표현 검수 결과를 관리자 편집 화면에서 점검·보완한다.
4. 필수 사진 슬롯이 차단되는 것을 먼저 확인한다. 비식별 테스트 이미지를 쓰는 경우 private original, public derivative, alt, 개인정보 확인, 홍보 사용 확인을 연결한다.
5. `ai_draft → reviewing/needs_media → ready → preview`를 통과한다. public URL, sitemap, robots, publish action은 확인 대상이 아니다.
6. Preview에서 noindex, 390px 폭, CTA, private path 비노출, JSON-LD와 visible title/description/image/date/breadcrumb 일치, 가로 overflow 없음을 확인한다.
7. publish 버튼은 누르지 않는다. test post, blocks, media links, assets, storage objects를 전부 제거한다.
8. 전후 inventory를 비식별 집계해 동일한지 확인하고, 이 문서에 생성 수·정리 수·잔여 수만 기록한다.

## 첫 실제 AI 초안: 재승인 후의 운영 체크리스트

재승인 전에는 아래 주제를 작성하거나 발행하지 않는다. 재승인 뒤에도 세 글은 `ai_draft`와 `published_at = null`에서 멈춘다.

| 순서 | category | 제목 | candidate slug |
| ---: | --- | --- | --- |
| 1 | `price_guide` | 중문 가격은 왜 집마다 달라질까? | `why-interior-door-price-varies` |
| 2 | `product_guide` | 중문 종류, 우리 집엔 뭐가 맞을까? | `which-interior-door-fits-my-home` |
| 3 | `field_knowhow` | 신발장이 있으면 중문 설치가 어려울까? | `interior-door-shoe-cabinet-condition` |

각 글마다 담당 운영자는 `/admin/platform/blog`에서 다음을 확인한다.

1. AI 초안 상태와 `published_at = null`.
2. target question, summary answer, SEO title/description/canonical URL, source evidence, fact-check date.
3. 금지표현·근거 검수 결과와 ready gate blocker 0건.
4. 문단별 필수 사진 슬롯, cover 또는 no-media reason, alt, 개인정보·홍보 사용 확인.
5. 관리자 preview의 noindex와 390px 화면.
6. 위 다섯 조건을 기록한 두 명의 사람 검수 승인.

공개 발행 버튼은 위 확인이 끝난 뒤 별도 재승인한 운영자만 누를 수 있다. 이 문서는 아직 그 권한을 부여하지 않는다.
