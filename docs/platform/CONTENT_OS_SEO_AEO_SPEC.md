---
document_type: "Content OS SEO/AEO Spec"
version: "1.0.0"
status: "draft"
created: "2026-06-24"
owner: "Codex PM"
source_prd: "docs/platform/CONTENT_OS_PRD.md"
source_strategy: "docs/platform/CONTENT_OS_STRATEGY.md"
next_docs_checked:
  - "node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md"
  - "node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md"
  - "node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md"
  - "node_modules/next/dist/docs/01-app/02-guides/json-ld.md"
---

# CONTENT_OS_SEO_AEO_SPEC - 검색/AI 답변 친화 기술 사양

## 0. 목적

이 문서는 MVP-CONTENTOS-01의 공개 SEO/AEO 구현 기준을 정의한다.

원칙:

- AEO/GEO는 SEO의 확장으로 다룬다.
- 검색 노출이나 AI 답변 포함을 보장한다고 표현하지 않는다.
- 고유한 현장 경험 기반 콘텐츠, 크롤링 가능한 구조, 명확한 메타데이터, 구조화 데이터, sitemap/robots를 구현한다.
- FAQ는 Google FAQ rich result 보장 목적이 아니라 Q&A 자산으로 관리한다.

## 1. 공개 URL

MVP 공개 경로:

```text
/blog
/blog/[slug]
```

후속 후보:

```text
/blog/category/[slug]
/blog/tag/[slug]
/areas/[slug]
/services/[slug]
/guides/[slug]
```

MVP sitemap에는 아래만 포함한다.

- `/`
- `/blog`
- `published` 상태의 `/blog/[slug]`
- 필요 시 기존 공개 쇼룸 URL

미발행 글, 초안, preview, admin, api, private 경로는 포함하지 않는다.

## 2. Metadata

Next.js App Router의 `generateMetadata`를 사용한다.

요구사항:

- `/blog`는 정적 metadata 또는 서버에서 계산 가능한 metadata를 사용한다.
- `/blog/[slug]`는 slug로 published 글을 조회해 동적 metadata를 생성한다.
- `generateMetadata`는 Server Component에서만 export한다.
- route params는 현재 Next.js 규칙에 맞춰 Promise 형태를 고려한다.
- `metadataBase`는 root layout 또는 공통 metadata에서 설정한다.
- 상대 URL metadata를 사용할 경우 `metadataBase` 누락으로 build error가 나지 않게 한다.
- `generateMetadata`와 페이지 본문은 같은 published 콘텐츠 조회 함수를 공유한다. title, canonical, OG, JSON-LD 값이 서로 어긋나면 안 된다.
- 존재하지 않거나 미발행인 slug는 공개 경로에서 `notFound()`로 처리한다.

`/blog/[slug]` metadata:

- `title`: `seo_title` 우선, 없으면 `title`
- `description`: `meta_description` 우선, 없으면 `excerpt`
- `alternates.canonical`: `canonical_url` 우선, 없으면 `/blog/[slug]`
- `openGraph.title`
- `openGraph.description`
- `openGraph.url`
- `openGraph.type = article`
- `openGraph.publishedTime`
- `openGraph.modifiedTime`
- `openGraph.images`
- `robots.index = true` only for published
- `robots.follow = true` only for published

미발행 글:

- 일반 공개 경로에서는 404.
- 미리보기 경로는 관리자 인증 필요.
- preview에는 `robots.index = false`, `robots.follow = false`.

## 3. Sitemap

Next.js App Router의 `app/sitemap.ts` file convention을 사용한다.

로컬 Next 문서 기준:

- `sitemap.(xml|js|ts)`는 검색엔진이 URL을 더 효율적으로 찾도록 돕는 sitemap XML 형식이다.
- TypeScript에서는 `MetadataRoute.Sitemap` 타입을 사용할 수 있다.
- `sitemap.ts`는 기본적으로 캐시되는 special route handler다.

요구사항:

- `NEXT_PUBLIC_SITE_URL` 또는 확정된 production URL을 기준으로 절대 URL 생성.
- `published` 상태 글만 포함.
- `lastModified`는 `published_at` 또는 `updated_at`.
- `/blog`는 `changeFrequency = weekly`, `priority = 0.7` 후보.
- `/blog/[slug]`는 `changeFrequency = monthly`, `priority = 0.6` 후보.
- 대표 이미지가 승인/발행된 경우 image sitemap 속성 사용을 검토한다.

제외:

- `/admin/*`
- `/api/*`
- `/drafts/*`
- `/private/*`
- preview URL
- `ai_draft`, `reviewing`, `needs_media`, `ready`, `archived` 글

## 4. Robots

Next.js App Router의 `app/robots.ts` file convention을 사용한다.

로컬 Next 문서 기준:

- `robots.txt`는 app root에 추가하거나 `robots.ts`로 생성할 수 있다.
- `MetadataRoute.Robots` 타입을 사용할 수 있다.
- 특정 user agent별 rules 배열을 구성할 수 있다.

기본 정책:

```text
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /drafts/
Disallow: /private/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /drafts/
Disallow: /private/

Sitemap: https://munjanggun.vercel.app/sitemap.xml
```

정책 결정:

- `OAI-SearchBot`은 ChatGPT 검색 노출 관점에서 허용 검토.
- `GPTBot`은 모델 학습 사용과 관련될 수 있으므로 별도 정책으로 둔다.
- robots는 보안 장치가 아니다. private 데이터는 인증/RLS로 막아야 한다.
- `SITE_URL` 또는 production URL이 바뀌면 robots의 sitemap URL도 함께 바꾼다.

## 5. JSON-LD

Next.js JSON-LD 가이드 기준:

- JSON-LD는 `layout` 또는 `page` 컴포넌트에서 native `<script type="application/ld+json">`로 렌더링한다.
- `next/script`가 아니라 native script tag를 사용한다.
- `JSON.stringify` 결과에 포함될 수 있는 `<` 문자는 `\u003c`로 치환해 XSS 위험을 줄인다.
- 필요 시 `schema-dts` 같은 타입 패키지를 후속 검토한다.

MVP 포함:

- `BlogPosting`
- `BreadcrumbList`

검토:

- `Organization`
- `LocalBusiness`
- `Service`

### BlogPosting

필드 후보:

- `@context`
- `@type = BlogPosting`
- `headline`
- `description`
- `image`
- `datePublished`
- `dateModified`
- `author` as Organization
- `publisher` as Organization
- `mainEntityOfPage`

주의:

- 페이지에 보이지 않는 정보를 구조화 데이터에 넣지 않는다.
- 구조화 데이터는 노출 보장 장치가 아니다.

### BreadcrumbList

필드 후보:

- Home
- Blog
- Current Post

### Organization / LocalBusiness

MVP에서 공통 site-level JSON-LD로 검토한다.

필수 검토 데이터:

- 회사명: 문장군
- 업종: 도어/중문/현관문 시공 전문업체
- 소재지: 경기도 화성
- 서비스: 중문, ABS도어, 현관문, 몰딩
- 서비스 지역: 실제 가능 지역만

정확성이 확인되지 않은 전화번호, 주소 상세, 영업시간은 넣지 않는다.

### Service

서비스 페이지 확장 시 검토한다.

예:

- 무료방문 실측견적 상담
- 중문 시공
- ABS도어 교체
- A/S 접수

## 6. FAQ/Q&A

FAQ는 MVP에서 다음처럼 관리한다.

- `blog_blocks.type = qa`
- `blog_blocks.type = link_button` / `guide_box`는 본문 안에서 보이는 고객 안내와 내부 이동을 보강한다.
- `related_questions`
- 글 내부 Q&A 섹션
- AI 초안 생성과 내부 링크 추천의 입력 데이터

명시 원칙:

- FAQ JSON-LD는 Google FAQ rich result 노출 보장 목적이 아니다.
- MVP 필수 구현은 Q&A 블록 렌더링과 데이터 관리다.
- FAQ rich result 제거/deprecation을 고려해, 리치결과 기대 문구를 제품/관리자 UI에 쓰지 않는다.
- `link_button`과 `guide_box`는 JSON-LD 필드를 늘리는 장치가 아니다. 화면에 보이는 본문 이해와 자연스러운 내부 이동을 돕는 블록으로만 다룬다.

## 7. AEO 필드

각 글은 아래 필드를 갖는다.

- `target_question`
- `summary_answer`
- `related_questions`
- `source_evidence`
- `last_fact_checked_at`
- `ai_citation_ready`

작성 기준:

- `target_question`은 고객이 실제로 물을 법한 질문형 문장.
- `summary_answer`는 2-4문장으로 결론을 먼저 제시.
- `related_questions`는 검색 변형을 양산하기 위한 필드가 아니라 내부 Q&A 자산.
- `source_evidence`는 AppSheet, 리뷰, 브랜드 문서, 현장 기록 등 근거를 요약.
- `ai_citation_ready`는 구조가 갖춰졌다는 내부 상태일 뿐 AI 인용을 보장하지 않는다.

## 8. Open Graph

요구사항:

- 대표 이미지가 있으면 OG image로 사용.
- 이미지 alt는 metadata와 본문 모두에 맞게 관리.
- OG title/description은 SEO title/meta description과 일관되게 둔다.
- 카카오톡 공유 호환성을 확인한다.

## 9. Canonical

요구사항:

- 모든 공개 글은 canonical URL을 가진다.
- `canonical_url`이 비어 있으면 production base URL + `/blog/[slug]`.
- preview URL은 canonical로 사용하지 않는다.
- 같은 글이 카테고리/태그 목록에서 보이더라도 canonical은 상세 글 URL.

## 10. 검증

구현 완료 시 확인:

- published 글 metadata 생성
- 미발행 글 404
- preview noindex
- sitemap에 published 글만 포함
- robots 출력 확인
- JSON-LD script 렌더링
- JSON-LD 문자열에서 `<` 이스케이프
- BlogPosting/BreadcrumbList 기본 필드 확인
- FAQ 리치결과 보장 문구 없음
- Search Console/Rich Results Test/Schema Markup Validator 수동 확인 항목 문서화
- published 콘텐츠만 sitemap, metadata, JSON-LD에 포함되는지 확인
