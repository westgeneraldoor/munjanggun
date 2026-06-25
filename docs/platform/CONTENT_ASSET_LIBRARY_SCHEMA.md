---
document_type: "Content Asset Library Schema"
version: "1.0.0"
status: "draft"
created: "2026-06-25"
owner: "Codex PM"
source_strategy: "docs/platform/CONTENT_ASSET_LIBRARY_STRATEGY.md"
source_prd: "docs/platform/CONTENT_ASSET_LIBRARY_PRD.md"
---

# CONTENT_ASSET_LIBRARY_SCHEMA - 사진보관함 DB/Storage 설계 초안

## 0. 목적

이 문서는 PR-08에서 구현할 사진보관함 DB, Storage, RLS, 변환 구조의 초안이다.

이번 문서는 설계 문서이며 migration을 작성하지 않는다.

## 1. 설계 방향

사진보관함은 글에 종속되지 않는 공용 자산 구조를 가진다.

핵심 분리:

```text
content_assets
-> 사진 자산의 의미와 메타데이터

content_asset_files
-> 원본, 웹용, 썸네일 같은 실제 파일 변환본

content_asset_usages
-> 어떤 글/페이지/콘텐츠에서 사용했는지
```

기존 `showroom.blog_media`는 바로 제거하지 않는다. 사진보관함과 블로그 발행 흐름을 연결하는 bridge가 필요하다.

## 2. 권장 테이블

### `showroom.content_assets`

문장군 전체 공용 사진 자산의 대표 레코드다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `title` | text | no | 내부용 사진명 |
| `description` | text | no | 사진 설명 |
| `category` | text | no | 중문, ABS도어, 시공전, 시공후 등 |
| `labels` | jsonb | yes | 운영 라벨 배열 또는 객체 |
| `product_type` | text | no | 중문, ABS도어, 현관문 등 |
| `space_type` | text | no | 현관, 거실, 방, 화장실 등 |
| `region` | text | no | 동탄, 수원 등 비식별 지역 |
| `usage_purpose` | text | no | 블로그용, 인스타용, 쇼룸용 등 |
| `library_state` | text | yes | 사용가능, 숨김, 보관 등 내부 상태 |
| `sensitive_checked` | boolean | yes | 얼굴/차량번호/주소 단서 확인 |
| `promotion_use_allowed` | boolean | yes | 블로그/홍보 사용 가능 여부 |
| `used_count` | integer | yes | 사용 횟수 cache |
| `created_by` | uuid | no | 업로드 또는 생성자 |
| `updated_by` | uuid | no | 마지막 수정자 |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

`library_state`는 운영자 화면에 그대로 노출하지 않는다. 화면에서는 `사용 가능`, `숨김`, `보관`처럼 번역된 상태만 사용한다.

`labels` 예시:

```json
{
  "mood": ["화이트", "우드톤"],
  "field_condition": ["신발장간섭", "바닥단차"],
  "content": ["before", "after"]
}
```

### `showroom.content_asset_files`

하나의 사진 자산에 연결된 실제 파일 변환본이다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `asset_id` | uuid | yes | `content_assets.id` |
| `file_role` | text | yes | original, web, thumbnail |
| `storage_bucket` | text | yes | 내부 storage bucket |
| `storage_object_path` | text | yes | 내부 object path |
| `public_url` | text | no | 공개용 파일 URL |
| `mime_type` | text | yes | 파일 MIME |
| `width` | integer | no | 이미지 폭 |
| `height` | integer | no | 이미지 높이 |
| `size_bytes` | bigint | no | 파일 크기 |
| `checksum_sha256` | text | no | 중복 감지 후보 |
| `transform_status` | text | yes | pending, ready, failed |
| `transform_error` | text | no | 변환 실패 요약 |
| `created_at` | timestamptz | yes | 생성 시각 |

권장 `file_role`:

- `original`: 원본. private 보관.
- `web`: 공개 페이지 또는 preview에 쓰는 WebP.
- `thumbnail`: 목록과 선택 모달용 작은 이미지.

### `showroom.content_asset_tags`

운영자가 반복 사용하는 태그 사전이다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `name` | text | yes | 태그명 |
| `slug` | text | yes | 검색/정렬용 식별자 |
| `tag_group` | text | no | 제품, 공간, 현장조건, 분위기 등 |
| `created_at` | timestamptz | yes | 생성 시각 |

제약:

- `slug` unique
- 태그명은 운영자가 이해하는 자연어 우선

### `showroom.content_asset_tag_links`

사진과 태그의 다대다 연결이다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `asset_id` | uuid | yes | `content_assets.id` |
| `tag_id` | uuid | yes | `content_asset_tags.id` |
| `created_at` | timestamptz | yes | 생성 시각 |

제약:

- `(asset_id, tag_id)` unique

### `showroom.content_asset_usages`

사진이 어디에 쓰였는지 기록한다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `asset_id` | uuid | yes | `content_assets.id` |
| `target_type` | text | yes | blog_post, blog_block, showroom_node, instagram_card, reel_thumbnail 등 |
| `target_id` | uuid 또는 text | yes | 사용 대상 id |
| `usage_role` | text | no | cover, inline, before, after, thumbnail 등 |
| `caption_override` | text | no | 사용처별 캡션 override |
| `alt_text_override` | text | no | 사용처별 alt override |
| `created_by` | uuid | no | 연결한 사람 |
| `created_at` | timestamptz | yes | 연결 시각 |

이 테이블로 나중에 다음 질문에 답할 수 있어야 한다.

- 이 사진이 어디에 쓰였나?
- 블로그에 한 번도 안 쓴 사진은 무엇인가?
- 인스타 카드뉴스로 재활용 가능한 사진은 무엇인가?
- 대표사진으로 자주 쓰이는 사진은 무엇인가?

### `showroom.content_asset_events`

감사 이력이다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `asset_id` | uuid | yes | `content_assets.id` |
| `event_type` | text | yes | uploaded, updated, transformed, used, hidden, archived 등 |
| `actor_id` | uuid | no | 수행자 |
| `metadata` | jsonb | yes | 변경 요약 |
| `created_at` | timestamptz | yes | 생성 시각 |

## 3. Storage 전략

권장 bucket 초안:

| bucket | 공개 여부 | 용도 |
|---|---|---|
| `content-assets-original` | private | 업로드 원본 |
| `content-assets-web` | public 또는 controlled public | WebP 공개용 파생 파일 |
| `content-assets-thumb` | public 또는 controlled public | 썸네일 파생 파일 |

PR-08에서 결정할 사항:

- `web`과 `thumbnail`을 public bucket으로 둘지, 발행된 사용처만 public으로 복사할지
- 기존 `blog-media` public bucket과 통합할지, 새 bucket으로 분리할지
- public object overwrite 방지 정책을 어떻게 둘지

기본 원칙:

- 원본은 private 유지.
- 공개 페이지는 원본을 직접 사용하지 않음.
- 공개 파일은 WebP 중심.
- EXIF 제거 후 저장.
- public bucket은 upsert/overwrite 금지.
- 관리자 preview는 signed URL 또는 proxy route를 사용.

## 4. 기존 `blog_media` bridge 전략

### 단기 bridge

사진보관함에서 블로그 본문에 사진을 넣을 때 기존 Content OS가 이해할 수 있도록 `showroom.blog_media` row를 생성한다.

가능한 방식:

```text
content_assets.id
-> blog_media row 생성
-> blog_blocks.media_id 연결
-> 기존 publish gate 통과
```

이 방식은 기존 publish flow를 최소 변경으로 유지한다.

### 중기 bridge

`showroom.blog_media`에 nullable `content_asset_id`를 추가한다.

장점:

- 기존 media id 기반 에디터와 발행 흐름 유지
- asset 사용 이력 추적 가능
- 나중에 blog_media 축소 가능

주의:

- 이번 PR-07에서는 migration 작성 금지
- 실제 추가는 PR-08 또는 PR-10에서 검토

### 장기 구조

블로그 image block이 직접 asset usage를 참조한다.

```text
blog_blocks
-> content_asset_usages
-> content_assets
-> content_asset_files
```

단, 이 단계는 기존 MVP 안정화 후에만 진행한다.

## 5. RLS 원칙

### anon

허용:

- 공개 페이지에 실제 사용되는 public 파생 파일 조회
- published 블로그에서 참조하는 이미지 렌더링

차단:

- `content_assets` 원본 목록 직접 조회
- 원본 bucket 접근
- 내부 labels, 사용 이력, 숨김/보관 상태 조회
- 미발행 콘텐츠에서만 쓰는 사진 조회

### authenticated administrator

허용:

- 사진보관함 목록 조회
- 업로드
- 메타데이터 수정
- 태그 관리
- 사용 이력 조회
- 숨김/보관 처리

### service role

허용:

- 원본 다운로드
- WebP 변환본 업로드
- 썸네일 생성
- checksum 계산
- 사용 횟수 cache 갱신
- 발행 시 public 파일 확정

## 6. Migration 주의사항

PR-08 구현 시 주의:

- 기존 `showroom.blog_media` 삭제 금지
- 기존 `blog-media-private`, `blog-media` bucket 정책 변경 최소화
- public bucket에 update policy 추가 금지
- 테스트용 object와 asset row cleanup 절차 포함
- 타입 재생성 필요
- RLS enable 누락 금지
- admin/service role helper를 기존 방식과 맞춤
- 민감정보가 담긴 파일명 사용 금지

## 7. 검증 기준

PR-08 구현 후 검증할 항목:

- 여러 장 업로드 후 asset/file row 생성
- 원본은 private 접근만 가능
- web/thumbnail 파일 생성
- EXIF 제거 확인
- public 파일은 overwrite 불가
- anon은 사진보관함 목록을 직접 조회할 수 없음
- admin은 목록/검색/수정 가능
- 기존 Content OS publish flow가 깨지지 않음
- public HTML에 original bucket path 미노출

## 8. PR-08 implementation result

Date: 2026-06-25

Project ref: `cebafroyvmllbyivevjd`

Migration:

- `supabase/migrations/20260625051019_content_asset_library_foundation.sql`

Created schema objects:

- `showroom.content_assets`
- `showroom.content_asset_files`
- `showroom.content_asset_tags`
- `showroom.content_asset_tag_links`
- `showroom.content_asset_usages`
- `showroom.content_asset_events`

Created enum objects:

- `showroom.content_asset_library_state`
- `showroom.content_asset_file_role`
- `showroom.content_asset_transform_status`
- `showroom.content_asset_usage_context`
- `showroom.content_asset_usage_role`

Storage buckets:

- `content-assets-private`: private originals, max 100MB, image/jpeg, image/png, image/webp, image/heic, image/heif.
- `content-assets-public`: public web/thumbnail derivatives, max 20MB, image/webp only.

Storage policies:

- `content_assets_public_select`
- `content_assets_public_admin_insert`
- `content_assets_public_admin_delete`
- `content_assets_private_admin_select`
- `content_assets_private_admin_insert`
- `content_assets_private_admin_delete`

No `storage.objects` UPDATE policy is created. Public overwrite/upsert remains intentionally unsupported.

Bridge:

- `showroom.blog_media.content_asset_id` was added as a nullable bridge to `showroom.content_assets`.
- Existing `blog_media`, existing blog image blocks, and existing Content OS publish flow remain the active MVP path.
- PR-09 can create `blog_media` rows from selected content assets without replacing the existing publish gate.

Server-only transform utility:

- `src/lib/content-assets/image-transforms.ts`

Responsibilities:

- Validate allowed image MIME and max original size.
- Generate safe object paths.
- Calculate SHA-256 checksums.
- Generate WebP web derivatives.
- Generate WebP thumbnails.
- Rotate by metadata and strip original metadata from derivatives through re-encoding.

RLS summary:

- anon can see only minimal asset/file/usage data for assets used by published blog content.
- anon cannot read original file rows, internal object paths, tag internals, events, or hidden/unpublished asset metadata.
- authenticated administrators can CRUD the library tables through `platform_private.is_admin()`.
- service role is granted server-side access for upload, transform, cleanup, and future publish/bridge jobs.

Out of scope for PR-08:

- Photo library UI.
- Multi-upload UI.
- Blog editor `+ image` modal.
- Publish flow changes.
- Existing `blog-media` and `blog-media-private` policy changes.
- Body component expansion.
