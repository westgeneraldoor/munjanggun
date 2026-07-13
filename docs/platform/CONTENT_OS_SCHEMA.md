---
document_type: "Content OS Schema"
version: "1.0.0"
status: "draft"
created: "2026-06-24"
owner: "Codex PM"
source_prd: "docs/platform/CONTENT_OS_PRD.md"
source_strategy: "docs/platform/CONTENT_OS_STRATEGY.md"
---

# CONTENT_OS_SCHEMA - MVP-CONTENTOS-01 DB/RLS/Storage 설계

## 0. 목적

이 문서는 문장군 SEO/AEO 콘텐츠 OS의 최소 Supabase schema를 정의한다.

목표:

- 검토 대상 원고와 공개 발행 글을 명확히 분리한다.
- 본문을 블록 단위로 관리한다.
- 문단별 사진 슬롯, alt, caption, 개인정보/홍보동의 확인을 관리한다.
- 공개 조회는 `published` 글과 승인된 미디어로 제한한다.
- 관리자만 검토 대상, 내부 검수 결과, 비공개 사진 후보에 접근한다.

## 1. Schema 위치

MVP는 기존 공개 쇼룸/CMS와 같은 `showroom` schema에 둔다.

이유:

- 블로그는 공개 콘텐츠 자산이다.
- 기존 `showroom` schema는 공개 콘텐츠와 CMS 성격을 가진다.
- 고객 신청, A/S, 견적/결제 같은 운영 데이터는 `platform` schema에 남긴다.

단, 고객 개인정보가 포함된 원본 자료와 private media는 `platform` 도메인 정책을 따른다. 블로그 공개용으로 승격된 미디어만 `showroom` 공개 콘텐츠로 취급한다.

## 2. Enum

### `showroom.blog_post_status`

```text
ai_draft
reviewing
needs_media
ready
published
archived
```

`ai_draft`는 기존 DB enum과 과거 운영 기록을 보존하기 위한 레거시 값이다. 현재 제품은 이 값을 새 원고 생성에 쓰지 않으며, UI에서는 `검토 필요`로 표시해 `reviewing`으로만 전환한다. enum과 기존 데이터는 이 변경에서 수정하지 않는다.

### `showroom.blog_block_type`

```text
heading
paragraph
image
link_button
guide_box
cta
qa
```

### `showroom.blog_media_usage_status`

```text
candidate
approved
published
rejected
```

### `showroom.blog_media_source_type`

```text
manual_upload
measurement_media
as_media
external_reference
showroom_asset
```

### `showroom.blog_content_category`

MVP에서는 enum보다 text/check 또는 lookup 테이블을 우선 검토한다. 카테고리는 운영 중 추가될 수 있기 때문이다.

초기 카테고리:

- `case_study`
- `product_guide`
- `customer_qa`
- `field_knowhow`
- `price_guide`
- `area_guide`

## 3. Tables

### `showroom.blog_posts`

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `title` | text | yes | 공개 제목 |
| `slug` | text | yes | `/blog/[slug]` URL |
| `excerpt` | text | no | 목록 요약 |
| `seo_title` | text | no | metadata title |
| `meta_description` | text | no | metadata description |
| `canonical_url` | text | no | canonical URL. 비어 있으면 slug 기반 생성 |
| `status` | blog_post_status | yes | 발행 상태 |
| `category` | text | yes | 콘텐츠 유형 |
| `primary_keyword` | text | no | 핵심 검색어 |
| `target_question` | text | no | 글이 답하는 질문 |
| `summary_answer` | text | no | AI 답변 친화형 짧은 결론 |
| `related_questions` | jsonb | no | 관련 질문 배열 |
| `service_area` | text | no | 지역 |
| `product_type` | text | no | 중문/ABS도어/현관문/몰딩 등 |
| `source_evidence` | jsonb | no | 근거 자료 목록 |
| `brand_check_result` | jsonb | no | 금지표현/사실관계 체크 결과 |
| `ai_model` | text | no | 레거시 생성 메타데이터. 현재 CMS는 기록하거나 사용하지 않음 |
| `source_prompt` | text | no | 레거시 생성 입력 요약. 현재 CMS는 기록하거나 사용하지 않음 |
| `ai_citation_ready` | boolean | yes | AI 답변 친화 필드 충족 여부 |
| `last_fact_checked_at` | timestamptz | no | 사실 확인일 |
| `created_by` | uuid | no | 생성자 |
| `reviewed_by` | uuid | no | 검수자 |
| `published_by` | uuid | no | 발행자 |
| `published_at` | timestamptz | no | 발행 시각 |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

제약:

- `slug` unique
- `slug`는 영문 소문자, 숫자, 하이픈만 허용
- `published_at`은 `status = published`일 때 필수
- `summary_answer`, `target_question`, `meta_description`은 `ready` 또는 `published` 전환 시 필수

인덱스:

- `(status, published_at desc)`
- `(category, status, published_at desc)`
- `(slug)`
- `(product_type, service_area)`
- GIN index 후보: `related_questions`, `source_evidence`, `brand_check_result`

### `showroom.blog_blocks`

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `post_id` | uuid | yes | `blog_posts.id` |
| `display_order` | integer | yes | 본문 순서 |
| `type` | blog_block_type | yes | 블록 유형 |
| `text` | text | no | heading/paragraph/qa/cta 텍스트 |
| `media_id` | uuid | no | image 블록일 때 연결 미디어 |
| `metadata` | jsonb | yes | 문단 의도, 필요한 사진 유형, CTA target 등 |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

제약:

- `(post_id, display_order)` unique
- `type = image`이면 `media_id` 필수
- `type != image`이면 `text` 또는 `metadata`에 의미 있는 값 필요

`metadata` 예시:

```json
{
  "intent": "고객 고민 설명",
  "target_keyword": "문짝교체 비용",
  "required_media": "before",
  "photo_slot_label": "시공 전 문짝 상태",
  "qa_answer": null,
  "cta_kind": null
}
```

PR-19 본문 확장 블록은 별도 테이블 없이 같은 `blog_blocks` 구조를 사용한다. 현재 렌더러와 에디터는 `metadata`를 문자열 맵으로 좁혀 읽으므로 배열/객체를 넣지 않는다.

`link_button`:

```json
{
  "type": "link_button",
  "text": "우리 집 조건 확인하기",
  "metadata": {
    "href": "/portal/measure/new",
    "description": "무료 방문실측으로 현장 조건을 확인합니다."
  }
}
```

원칙:

- `href`는 `/`로 시작하는 내부 공개 경로만 사용한다.
- `/admin`, `/api`, `/preview`, `/drafts`, `/private` 경로는 공개 본문 링크로 쓰지 않는다.
- 외부 URL은 별도 보안/운영 정책이 생기기 전까지 지원하지 않는다.

`guide_box`:

```json
{
  "type": "guide_box",
  "text": "신발장, 스위치, 바닥 단차는 실측 때 함께 확인하면 판단하기 쉽습니다.",
  "metadata": {
    "title": "실측 전에 보면 좋은 조건",
    "tone": "condition"
  }
}
```

허용 `tone`:

- `guide`: 안내
- `notice`: 알아두세요
- `condition`: 현장 조건
- `caution`: 주의

`guide_box`는 고객 판단을 돕는 본문 요소다. AEO/GEO/LLMO 같은 내부 최적화 언어를 고객 화면에 노출하지 않는다.

### `showroom.blog_media`

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `post_id` | uuid | no | 특정 글에 귀속된 미디어 |
| `source_type` | blog_media_source_type | yes | 업로드/실측사진/A/S사진/외부참고/쇼룸자산 |
| `source_measurement_media_id` | uuid | no | 실측 원본 후보 참조. 공개 URL로 직접 사용 금지 |
| `source_as_media_id` | uuid | no | A/S 원본 후보 참조. 공개 URL로 직접 사용 금지 |
| `bucket` | text | yes | storage bucket |
| `object_path` | text | yes | storage path |
| `public_url` | text | no | 공개 URL |
| `alt_text` | text | no | 이미지 alt |
| `caption` | text | no | 캡션 |
| `source` | text | no | upload/appsheet/showroom/other |
| `usage_status` | blog_media_usage_status | yes | 후보/승인/발행/거절 |
| `privacy_checked` | boolean | yes | 개인정보 확인 |
| `promotion_consent_checked` | boolean | yes | 홍보 활용 동의 확인 |
| `used_as_cover` | boolean | yes | 대표 이미지 여부 |
| `approved_by` | uuid | no | 승인자 |
| `approved_at` | timestamptz | no | 승인 시각 |
| `published_at` | timestamptz | no | 공개 사용 시작 시각 |
| `rejection_reason` | text | no | 거절 사유 |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

제약:

- `(bucket, object_path)` unique
- `source_type = measurement_media`이면 `source_measurement_media_id` 필수
- `source_type = as_media`이면 `source_as_media_id` 필수
- `usage_status in (approved, published)` 전환 시 `alt_text` 필수
- `usage_status in (approved, published)` 전환 시 `approved_by`, `approved_at` 필수
- `published` 전환 시 `privacy_checked = true`
- `published` 전환 시 `promotion_consent_checked = true`
- `published` 전환 시 `bucket`, `object_path`, `published_at` 필수

### `showroom.blog_post_events`

MVP에서도 감사 이력을 남긴다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `post_id` | uuid | yes | `blog_posts.id` |
| `event_type` | text | yes | 상태변경/검수/발행/보관 등 |
| `from_status` | blog_post_status | no | 이전 상태 |
| `to_status` | blog_post_status | no | 이후 상태 |
| `actor_id` | uuid | no | 수행자 |
| `metadata` | jsonb | yes | 변경 요약 |
| `created_at` | timestamptz | yes | 생성 시각 |

## 4. Storage

### Buckets

| bucket | 공개 여부 | 용도 |
|---|---|---|
| `blog-media-private` | private | 검수 전 후보, AppSheet 후보, 임시 업로드 |
| `blog-media` | public | 발행 승인된 블로그 이미지 |

구현 시 bucket 이름은 기존 쇼룸 자산과 분리하기 위해 `content-os-media-private`, `content-os-media`로 명명해도 된다. 단, 문서와 migration, Storage policy의 이름은 한 번 정하면 동일하게 유지한다.

원칙:

- 고객 신청 사진이 있는 `measurement-media`는 그대로 private 유지.
- 블로그에 쓰려면 별도 승인 과정을 거쳐 `blog-media`로 복사/승격한다.
- `blog-media`에 올라간 이미지만 공개 글에서 사용한다.
- 공개 이미지에는 alt, caption, 개인정보 확인, 홍보 활용 동의 확인이 있어야 한다.
- 공개 bucket 업로드는 upsert를 쓰지 않는다. 새 object path만 허용해 기존 발행 이미지를 실수로 덮어쓰지 않는다.
- public bucket `SELECT`는 공개 가능하지만, `INSERT`, `UPDATE`, `DELETE`는 관리자 권한으로 제한한다.

## 5. RLS 정책 의도

### Public anon

허용:

- `blog_posts`에서 `status = published`
- `blog_blocks`는 연결된 post가 `published`
- `blog_media`는 `usage_status = published`이고 연결된 post가 `published`

차단:

- 레거시 `ai_draft`, `reviewing`, `needs_media`, `ready`, `archived`
- `source_prompt`, 내부 검수 JSON 등 민감 필드 직접 노출
- private bucket 접근

### Authenticated admin

허용:

- 모든 blog post/block/media 조회
- 생성/수정/상태 변경/발행/보관
- private 후보 이미지 signed URL 조회

조건:

- `platform.profiles.role = administrator` 또는 기존 관리자 판정 helper 사용
- 영업 매니저 권한은 MVP에서 블로그 관리 권한 없음
- RLS policy는 기존 `platform_private.is_admin()`류 helper가 있으면 재사용한다.
- Supabase 노출 schema에 추가되는 모든 신규 테이블은 RLS를 반드시 enable 한다.

## 6. 상태 전환 규칙

허용 전환:

```text
ai_draft -> reviewing
reviewing -> needs_media
reviewing -> ready
needs_media -> ready
ready -> published
published -> archived
archived -> reviewing
```

새 원고의 운영 흐름은 `reviewing`에서 시작한다. `ai_draft -> reviewing`은 이미 존재하는 레거시 레코드를 정리하기 위한 호환 전환이며, AI 생성 server action이나 환경변수와 연결되지 않는다.

차단:

- `ai_draft -> published`
- `needs_media -> published`
- 필수 검수 필드 없이 `ready`
- 승인되지 않은 미디어가 연결된 상태에서 `published`

`ready` 필수 조건:

- 제목, slug, meta description
- target_question
- summary_answer
- 본문 블록
- CTA 블록 또는 CTA 설정
- 금지표현 없음
- last_fact_checked_at

`published` 필수 조건:

- `ready` 상태에서만 가능
- 대표 이미지 또는 사진 부족 사유 기록
- 공개 이미지 alt 입력
- 모든 public media privacy/promotional consent checked
- 발행자 기록
- event 기록
- client에서 `status = published`를 직접 update하지 않는다. 관리자 server action 또는 route handler에서 검수 게이트를 재검증한 뒤 전환한다.

## 7. 타입 생성

DB migration 이후 `src/types/database.ts`를 재생성한다.

구현 시 `any` 금지. Supabase 자동 생성 타입 또는 명시 타입을 사용한다.

## 8. 검증

- anon으로 미발행 글 조회 불가
- anon으로 private media 접근 불가
- published 글만 sitemap 후보로 조회
- slug 중복 차단
- 승인되지 않은 미디어로 published 전환 차단
- 발행 이벤트 기록 생성
