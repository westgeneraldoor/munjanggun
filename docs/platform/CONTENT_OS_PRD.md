---
document_type: "Content OS PRD"
version: "1.0.0"
status: "draft"
created: "2026-06-24"
owner: "Codex PM"
source_strategy: "docs/platform/CONTENT_OS_STRATEGY.md"
related_schema: "docs/platform/CONTENT_OS_SCHEMA.md"
related_admin_ux: "docs/platform/CONTENT_OS_ADMIN_UX.md"
related_seo_aeo_spec: "docs/platform/CONTENT_OS_SEO_AEO_SPEC.md"
---

# CONTENT_OS_PRD - MVP-CONTENTOS-01 문장군 SEO/AEO 콘텐츠 OS

## 0. 목표

MVP-CONTENTOS-01은 문장군 자체 도메인에 검색 자산을 축적하기 위한 콘텐츠 운영 시스템이다.

목표는 단순 블로그 게시판이 아니다. AI가 문장군 브랜드 맥락에 맞는 글 초안을 만들고, 관리자가 사실관계, 금지표현, 사진, SEO/AEO 필드를 검수한 뒤 문장군 공식 콘텐츠로 발행하는 구조를 만든다.

이 시스템은 아래 흐름을 구현한다.

```text
AI 초안 생성
-> 어드민 초안 큐 적재
-> 사람이 글/SEO/AEO/사실관계 검수
-> 사람이 문단별 사진 삽입
-> 미리보기
-> 발행
-> 공개 블로그와 sitemap 반영
```

## 1. 제품 원칙

- AEO/GEO는 검색 노출을 보장하는 꼼수가 아니라 SEO의 확장으로 다룬다.
- AI는 초안을 만들고, 사람은 최종 발행을 승인한다.
- 사진은 자동 사용하지 않는다. 사람의 문단별 승인 후 공개한다.
- FAQ는 Google FAQ rich result 보장을 목표로 하지 않고 Q&A 자산으로 관리한다.
- 구조화 데이터는 페이지 이해를 돕는 SEO 인프라로 넣되, 노출 보장 장치로 표현하지 않는다.
- 고객 개인정보, 주소 단서, 얼굴, 차량번호, 홍보 활용 동의 여부를 발행 전 확인한다.

## 2. MVP 범위

### 포함

- 공개 블로그 목록 `/blog`
- 공개 블로그 상세 `/blog/[slug]`
- 어드민 초안 큐 `/admin/platform/blog`
- 어드민 글 편집 `/admin/platform/blog/[id]`
- AI 초안 저장 상태 `ai_draft`
- 블록형 본문 구조
- 문단별 사진 슬롯
- 대표 이미지, alt, caption
- SEO title, meta description, canonical URL
- `target_question`, `summary_answer`, `primary_keyword`, `related_questions`
- 브랜드/사실 검수 체크
- 발행 상태 관리
- `generateMetadata`
- `app/sitemap.ts`
- `app/robots.ts`
- `BlogPosting` JSON-LD
- `BreadcrumbList` JSON-LD
- `Organization` / `LocalBusiness` / `Service` 구조화 데이터 검토 기준

### 제외

- 완전 자동 발행
- 외부 블로그 API 직접 발행
- 고객 현장 사진 자동 사용
- AI 생성 시공 사진
- 댓글
- 광고 수익화
- 다국어
- 복잡한 WYSIWYG 에디터
- 경쟁사 자동 분석
- Search Console API 자동 연동
- 키워드 클러스터 자동 생성

## 3. 사용자와 역할

| 사용자 | 역할 |
|---|---|
| Codex/AI 작성자 | 브랜드 맥락과 입력 자료를 기반으로 초안과 SEO/AEO 필드 생성 |
| 관리자 | 초안 큐에서 글을 고르고 검수, 사진 삽입, 미리보기, 발행 |
| 문장군 고객 | 공개 블로그에서 문제 해결 글/시공사례를 읽고 무료방문 실측견적 신청 |
| 검색엔진/AI 크롤러 | 발행된 공개 글, 카테고리, 서비스/지역 페이지를 크롤링 |

## 4. 핵심 플로우

### 초안 생성

1. AI가 브랜드 컨텍스트, 콘텐츠 유형, 타깃 질문, 핵심 키워드를 바탕으로 초안을 만든다.
2. 초안은 `ai_draft` 상태로 저장된다.
3. 초안에는 본문 블록뿐 아니라 `summary_answer`, `target_question`, `primary_keyword`, `related_questions`, `source_evidence`가 함께 저장된다.
4. AI는 공개 발행을 수행할 수 없다.

### 초안 검수

1. 관리자는 `/admin/platform/blog`에서 초안을 확인한다.
2. 카테고리, 상태, 사진 부족, 금지표현 경고, 근거 확인 필요 여부로 필터링한다.
3. 글을 선택하면 `/admin/platform/blog/[id]` 에디터로 이동한다.
4. 관리자는 제목, slug, 본문 블록, SEO/AEO 필드, CTA를 검토한다.

### 사진 삽입

1. 본문은 문단별 블록으로 표시된다.
2. 각 문단은 필요한 사진 유형을 가진다.
3. 관리자는 문단별 사진 슬롯에 사진을 연결한다.
4. 사진은 alt, caption, 개인정보 확인, 홍보 활용 동의 확인을 통과해야 한다.
5. 사진이 부족하면 상태는 `needs_media`로 남긴다.

### 발행

1. 발행 전 검수 게이트를 모두 통과해야 한다.
2. 관리자가 미리보기를 확인한다.
3. `ready` 상태에서 발행하면 `published`가 된다.
4. 발행된 글만 `/blog/[slug]`에서 공개된다.
5. 발행된 글만 sitemap에 포함된다.

## 5. 콘텐츠 유형

| 유형 | 목적 | 예시 |
|---|---|---|
| 시공사례 | 실제 현장 기반 신뢰 형성 | 동탄 3연동중문 시공사례 |
| 문제 해결형 | 고객 질문에 직접 답변 | 문짝만 교체해도 되는 경우 |
| 가격/견적 가이드 | 가격 단정 없이 견적 변동 기준 설명 | 중문 가격이 집마다 다른 이유 |
| 리뷰/고객 언어 기반 | 반복 고객 고민과 만족 포인트 정리 | 살면서 시공할 때 고객이 걱정하는 것 |
| 지역/서비스 안내 | 서비스 가능 지역과 품목 맥락 정리 | 화성/동탄 중문 무료방문 실측견적 |

## 6. 발행 전 검수 게이트

발행 버튼은 아래 조건이 모두 만족될 때 활성화한다.

- 제목 입력
- slug 입력 및 중복 없음
- meta description 입력
- canonical URL 자동 생성 또는 확인
- `target_question` 입력
- `summary_answer` 입력
- 본문 블록 1개 이상
- CTA 선택
- 대표 이미지 또는 사진 부족 사유 확인
- 모든 공개 이미지 alt 입력
- 금지표현 없음
- 사실관계 확인일 입력
- 미리보기 확인

금지표현과 위험 주제:

- 최저가/최고
- 구체 가격 단정
- 보양 작업한다고 표현
- 불가 지역 가능하다고 표현
- 없는 서비스 언급
- 근거 없는 통계
- 고객 개인정보 노출
- 경쟁사 비방

## 7. 공개 페이지 요구사항

### `/blog`

- 발행된 글만 표시한다.
- 카테고리와 주요 콘텐츠 유형 필터를 제공한다.
- 최신 글, 시공사례, 문제 해결형 글, 가격/견적 가이드를 구분한다.
- 각 글 카드에는 제목, excerpt, 대표 이미지, 카테고리, 발행일, 핵심 질문을 표시한다.
- CTA는 무료방문 실측견적 신청으로 연결한다.

### `/blog/[slug]`

- `published` 상태 글만 렌더링한다.
- 존재하지 않거나 미발행 글은 404 처리한다.
- 제목, 요약 답변, 본문 블록, 문단별 이미지, Q&A 블록, 관련 글, CTA를 표시한다.
- `generateMetadata`로 SEO title, meta description, canonical, Open Graph를 생성한다.
- `BlogPosting`과 `BreadcrumbList` JSON-LD를 포함한다.
- FAQ/Q&A 블록은 사용자 이해와 AI 답변 친화성을 위한 콘텐츠로 표시한다. Google FAQ rich result 보장을 목표로 하지 않는다.

## 8. 성공 기준

- AI 초안이 어드민 큐에 저장된다.
- 관리자가 초안을 열어 블록별로 편집할 수 있다.
- 문단별 사진 슬롯에 이미지를 연결하고 alt/caption을 입력할 수 있다.
- 검수 게이트 미통과 상태에서는 발행할 수 없다.
- 발행된 글은 `/blog/[slug]`에서 공개된다.
- 미발행 글은 공개 경로와 sitemap에 노출되지 않는다.
- BlogPosting/BreadcrumbList JSON-LD가 렌더링된다.
- sitemap과 robots가 Next.js App Router 파일 convention으로 생성된다.

## 9. 검증

문서 기반 구현 계획을 만들 때 아래 검증을 포함한다.

- `npm run lint`
- `npm run build`
- 공개 `/blog`, `/blog/[slug]` 모바일/데스크탑 화면 확인
- 미발행 글 404 확인
- 발행 전 검수 게이트 확인
- sitemap에 published 글만 포함되는지 확인
- robots에서 admin/api/drafts/private 차단 확인
- JSON-LD가 `<script type="application/ld+json">`로 렌더링되고 `<` 문자가 이스케이프되는지 확인
- 개인정보/사진 승인 필드가 없는 이미지는 공개 불가 확인

## 10. 후속 단계

MVP 이후 검토:

- Search Console 수동 등록/성과 기록
- 오래된 글 업데이트 큐
- 내부 링크 추천
- 사진 후보 추천
- AppSheet 시공 사진/라벨 연동
- 지역/서비스 페이지 확장
- 콘텐츠 성과 대시보드
