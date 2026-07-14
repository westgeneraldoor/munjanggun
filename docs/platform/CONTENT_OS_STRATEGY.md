---
document_type: "Content OS Strategy"
version: "1.0.0"
status: "active"
created: "2026-06-24"
owner: "Codex PM"
source_brand_context: "docs/platform/BRAND_CONTEXT.md"
source_platform_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_team_operating_model: "docs/platform/TEAM_AGENT_OPERATING_MODEL.md"
---

# CONTENT_OS_STRATEGY - 문장군 SEO/AEO 콘텐츠 OS

## 0. 결론

문장군은 단순 블로그 CMS가 아니라 **문장군 SEO/AEO 콘텐츠 OS**를 만든다.

이 시스템의 목적은 네이버 블로그를 복제하는 것이 아니다. 문장군의 실제 현장 데이터, 가격 기준, 시공사례, 고객 질문, 리뷰 기반 지식을 문장군 소유 도메인에 쌓고, 검색엔진과 AI 답변 시스템이 이해할 수 있는 공식 콘텐츠 자산으로 관리하는 것이다.

단, AEO/GEO는 검색 노출을 보장하는 해킹 기법이 아니다. Google 공식 기준에서는 생성형 AI 검색 최적화 역시 기본 SEO, 고유한 경험 기반 콘텐츠, 크롤링 가능한 기술 구조, 명확한 정보 구조의 연장선으로 본다.

따라서 이 문서에서 AEO/GEO는 아래 의미로만 쓴다.

```text
AEO/GEO는 별도 꼼수가 아니라,
문장군의 실제 현장 경험, 가격 기준, 시공사례, FAQ를
검색엔진과 AI가 이해하기 쉬운 공식 지식 자산으로 정리하는 전략이다.
```

## 1. 왜 지금 필요한가

문장군은 네이버 블로그와 네이버 브랜드스토어에 강점이 있지만, 장기적으로는 문장군 도메인 자체에 검색 자산을 쌓아야 한다.

고객 검색은 단어 검색에서 질문형 검색과 AI 답변형 검색으로 이동하고 있다.

예:

```text
동탄 중문 시공
ABS도어 교체 비용
```

에서

```text
아이 있는 집에는 어떤 중문 유리가 좋은가요?
문짝만 교체해도 되는 경우와 문틀세트 교체가 필요한 경우는 어떻게 구분하나요?
중문 가격은 왜 집마다 달라지나요?
```

로 바뀐다.

문장군 콘텐츠 OS는 이런 질문에 대해 문장군의 현장 경험 기반 답변을 축적한다.

## 2. 핵심 원칙

### 원칙 1. Codex가 외부에서 작성하고, 사람은 발행을 승인한다

Codex는 글을 작성하기 전에 문장군_브랜드에서 브랜드 사실, 금지표현, 현장 판단 기준을 조사하고, 문장군블로그에서 네이버 글, 카테고리, 중복 주제, 검색 성과, 발행 운영을 조사한다. 이 조사는 관리자 화면이나 AI 생성 server action이 아니라 외부 작성 업무에서 수행한다.

기본 흐름:

```text
Codex 외부 원고 작성
-> SEO/AEO 필드 작성
-> 어드민 콘텐츠 큐
-> 사람이 사실관계와 금지표현 검수
-> 사람이 문단별 사진 삽입
-> 미리보기
-> 발행
```

사진은 특히 자동 사용하지 않는다. 고객 집 내부, 얼굴, 차량번호, 주소 단서, 홍보 활용 동의 여부가 섞일 수 있기 때문이다.

### 원칙 2. 사진은 문단별 슬롯으로 사람이 넣는다

글 전체에 사진 몇 장을 붙이는 방식이 아니라, 문단의 의도에 맞춰 사진을 배치한다.

예:

```text
도입 문단
-> 대표 사진

고객 고민 문단
-> Before 사진

시공 설명 문단
-> 작업/제품 사진

완료 문단
-> After 사진

CTA
-> 무료방문 실측견적 신청
```

사진이 부족하면 AI 생성 이미지로 대체하지 않는다. `사진 부족` 상태로 남겨 사람이 판단한다.

### 원칙 3. FAQ는 리치결과용 꼼수가 아니라 Q&A 자산이다

FAQ는 Google FAQ rich result 노출을 보장하기 위한 기능으로 정의하지 않는다.

Google은 FAQ rich result 기능이 더 이상 Google 검색 결과에 표시되지 않는다고 문서 업데이트에서 밝혔다.

따라서 FAQ는 아래 목적을 위해 관리한다.

- 사용자 질문에 짧고 정확하게 답하기
- AI 답변 친화형 Q&A 구조 만들기
- 내부 콘텐츠 재사용
- 검색 의도 정리
- Codex 외부 작성과 에디터 검수의 기준 자료 제공

FAQ JSON-LD는 MVP 필수 게이트가 아니다. 필요 시 보조 구조로만 검토한다.

### 원칙 4. 구조화 데이터는 필수 인프라이지만 만능키가 아니다

구조화 데이터는 검색엔진이 페이지 내용을 이해하도록 돕는 SEO 인프라다.

하지만 구조화 데이터가 AEO/GEO 노출을 보장한다고 표현하지 않는다. 특별한 AI 전용 schema가 필요한 것도 아니다.

MVP에서 우선 검토할 구조화 데이터:

- `BlogPosting` / `Article`
- `BreadcrumbList`
- `Organization`
- `LocalBusiness`
- `Service`

### 원칙 5. 크롤러 정책은 검색 노출과 학습 사용을 분리해 판단한다

robots 정책은 다음 방향을 기본값으로 한다.

```text
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /drafts/
Disallow: /private/

User-agent: OAI-SearchBot
Allow: /

Sitemap: https://munjanggun.vercel.app/sitemap.xml
```

`OAI-SearchBot`은 ChatGPT 검색 노출과 관련되므로 막지 않는 방향을 우선 검토한다. `GPTBot` 허용 여부는 모델 학습 사용과 관련될 수 있으므로 별도 정책 결정으로 둔다.

## 3. 제품 정의

문장군 SEO/AEO 콘텐츠 OS는 아래 4가지를 합친 시스템이다.

| 영역 | 역할 |
|---|---|
| 공개 콘텐츠 | `/blog`, `/blog/[slug]`, 카테고리, 지역, 서비스, 가이드 페이지 |
| 콘텐츠 큐 | 승인된 외부 원고와 레거시 검토 대상을 관리자 검수 대상으로 관리하는 큐 |
| 블록형 에디터 | 문단별 텍스트, 사진 슬롯, CTA, FAQ, SEO/AEO 필드를 편집 |
| 콘텐츠 운영 데이터 | 검색 의도, 질문, 키워드, 근거, 색인 상태, 업데이트 필요 여부 관리 |

이 시스템은 현재 프로젝트 안에 둔다. 블로그는 단순 게시판이 아니라 무료방문 실측견적 CTA, 시공 사진, 리뷰/후기 자산, SEO 유입과 연결되는 플랫폼 일부이기 때문이다.

## 4. 콘텐츠 유형

### 시공사례

실제 현장 기반 콘텐츠.

필수 정보:

- 지역
- 주거 유형
- 제품군
- 시공 전 문제
- 고객 고민
- 실측 때 확인한 점
- 선택한 제품/방식
- 시공 후 변화
- 사용 사진
- 비슷한 현장에 대한 추천 기준

주의:

- 지역명만 바꾼 반복 글을 양산하지 않는다.
- 실제 현장 차이, 사진, 고객 고민, 해결 과정이 있어야 한다.

### 문제 해결형 글

고객 질문에 답하는 콘텐츠.

예:

- 화장실 문 곰팡이는 문짝 문제일까 문틀 문제일까?
- 문짝만 교체해도 되는 경우는?
- 중문 설치 전 확인해야 할 것은?
- 아이 있는 집에는 어떤 중문 유리가 좋은가?
- 바닥 레일 없는 중문도 가능한가?

### 가격/견적 가이드

가격을 단정하지 않고, 견적이 달라지는 이유와 확인 기준을 설명한다.

금지:

- 구체 가격 단정
- 최저가/최고 표현
- 현장 확인 없이 확정 견적처럼 보이는 문장

허용:

- 가격이 달라지는 구조 설명
- 실측 때 확인하는 항목
- 추가금이 발생할 수 있는 조건
- 무료방문 실측견적 CTA

### 리뷰/고객 언어 기반 글

네이버 리뷰, 예약 리뷰, 현장 상담에서 반복되는 고객 언어를 콘텐츠화한다.

단, 개인정보와 주소 단서는 제거하고, 고객 원문을 그대로 길게 인용하지 않는다.

## 5. 데이터 모델 초안

MVP에서는 단일 HTML 본문보다 블록 구조를 우선한다. 사진을 문단 사이에 안전하게 삽입하고, alt/caption/출처/동의 상태를 관리하기 위해서다.

### `showroom.blog_posts`

- `id`
- `title`
- `slug`
- `excerpt`
- `seo_title`
- `meta_description`
- `canonical_url`
- `status`: `ai_draft`, `reviewing`, `needs_media`, `ready`, `published`, `archived` (`ai_draft`는 레거시 호환 전용)
- `category`
- `primary_keyword`
- `target_question`
- `summary_answer`
- `related_questions`
- `service_area`
- `product_type`
- `source_evidence`
- `brand_check_result`
- `last_fact_checked_at`
- `ai_citation_ready`
- `created_by`
- `reviewed_by`
- `published_at`
- `updated_at`

### `showroom.blog_blocks`

- `id`
- `post_id`
- `display_order`
- `type`: `heading`, `paragraph`, `image`, `cta`, `qa`
- `text`
- `media_id`
- `metadata jsonb`

### `showroom.blog_media`

- `id`
- `post_id`
- `bucket`
- `object_path`
- `alt_text`
- `caption`
- `source`
- `usage_status`: `candidate`, `approved`, `published`, `rejected`
- `privacy_checked`
- `promotion_consent_checked`

공개 조회는 `published` 글과 `published` 미디어만 허용한다. 검토 대상, 레거시 생성 메타데이터, 검수 전 사진, 내부 근거 자료는 관리자만 접근한다.

## 6. 상태 흐름

```text
새 원고: reviewing
-> needs_media
-> ready
-> published

레거시: ai_draft -> reviewing
```

상태 의미:

| 상태 | 의미 |
|---|---|
| `ai_draft` | 레거시 검토 대기 상태. UI에는 `검토 필요`로 표시하며 새 원고에는 쓰지 않음 |
| `reviewing` | 관리자가 내용 검수 중 |
| `needs_media` | 글은 쓸 수 있으나 사진 삽입/승인이 부족 |
| `ready` | 내용, 사진, SEO/AEO 필드, 검수 항목이 발행 가능 |
| `published` | 공개 페이지와 sitemap에 포함 |
| `archived` | 공개 중단 또는 보관 |

## 7. 어드민 UX

### 콘텐츠 큐

경로:

```text
/admin/platform/blog
```

목록 필터:

- 전체
- 시공사례
- 제품가이드
- 고객 Q&A
- 현장 노하우

상태 필터:

- 검토필요
- 사진부족
- 수정필요
- 발행대기
- 발행완료

목록에서 보여줄 정보:

- 제목
- 카테고리
- 타깃 질문
- 핵심 키워드
- 사용 사진 수
- 금지표현 경고 수
- 근거 확인 필요 여부
- 생성일/수정일

### 에디터

권장 레이아웃:

```text
왼쪽: 문단 아웃라인
중앙: 블록형 본문 에디터
오른쪽: 사진/검수/SEO-AEO 패널
```

문단 블록에는 아래 정보를 둔다.

- 문단 의도
- 본문
- 필요한 사진 유형
- 연결된 사진
- 검수 상태

## 8. 발행 전 검수

발행 버튼은 아래 조건이 만족될 때 활성화한다.

- 제목, slug, meta description 입력
- `summary_answer` 입력
- `target_question` 입력
- 대표 이미지 또는 사진 부족 사유 확인
- 이미지 alt 입력
- 금지표현 없음
- 사실관계 확인일 입력
- CTA 선택
- 미리보기 확인

금지표현 예:

- 최저가/최고
- 가격 단정
- 보양 작업한다고 표현
- 불가 지역 가능하다고 표현
- 없는 서비스 언급
- 근거 없는 통계
- 고객 개인정보 노출

발행 전 사람이 확인해야 하는 항목:

- 리뷰 수
- 서비스 가능 지역
- A/S 기간
- 시공 기간
- 이벤트 혜택
- 추가금 설명

## 9. 공개 SEO/AEO 인프라

MVP 구현 시 아래를 포함한다.

- `/blog`
- `/blog/[slug]`
- `generateMetadata`
- canonical URL
- Open Graph 이미지
- sitemap 자동 반영
- robots 정책
- `BlogPosting` JSON-LD
- `BreadcrumbList` JSON-LD
- `Organization` / `LocalBusiness` JSON-LD 검토
- `Service` 구조화 데이터 검토
- 이미지 alt
- 내부 링크

FAQ는 `qa` 블록 또는 `related_questions` 필드로 관리하되, Google FAQ rich result 보장을 목표로 하지 않는다.

## 10. MVP 범위

MVP 이름:

```text
MVP-CONTENTOS-01 문장군 SEO/AEO 콘텐츠 OS
```

포함:

- 레거시 `ai_draft` 상태 및 생성 메타데이터의 읽기 호환
- `/admin/platform/blog` 콘텐츠 큐
- 블록형 에디터
- 문단별 사진 삽입
- 브랜드/사실 검수 체크
- 공개 `/blog/[slug]`
- sitemap/robots/metadata
- BlogPosting/BreadcrumbList JSON-LD
- 발행 상태 관리

제외:

- 완전 자동 발행
- 외부 블로그 API 직접 발행
- 고객 현장 사진 자동 사용
- 복잡한 WYSIWYG 에디터
- 댓글
- 광고 수익화
- 다국어
- AI 생성 시공 사진
- 경쟁사 자동 분석

## 11. 공식 기준

이 전략은 아래 공식 문서를 기준으로 삼는다.

- Google Search Central: Optimizing for generative AI features on Google Search
- Google Search Central updates: FAQ rich result feature removal/deprecation
- Google Search Central: Introduction to structured data
- Google Search Central: Article structured data
- OpenAI Developers: Overview of OpenAI Crawlers
- Next.js docs: sitemap metadata file convention
- Next.js docs: robots metadata file convention

핵심 반영:

- AEO/GEO는 Google Search 관점에서 SEO의 연장선으로 정의한다.
- FAQ rich result 노출을 MVP 목표로 삼지 않는다.
- 구조화 데이터는 페이지 이해를 돕는 인프라이며 노출 보장 장치로 표현하지 않는다.
- `OAI-SearchBot` 허용은 ChatGPT 검색 노출 관점에서 검토한다.
- sitemap과 robots는 Next.js App Router 공식 파일 convention으로 구현한다.
