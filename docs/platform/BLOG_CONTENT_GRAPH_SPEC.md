---
document_type: "Blog Content Graph Spec"
version: "1.0.0"
status: "active"
created: "2026-06-30"
owner: "Codex PM"
related_goal: "PR-18 content connection structure"
source_docs:
  - docs/platform/CONTENT_OS_STRATEGY.md
  - docs/platform/CONTENT_OS_SEO_AEO_SPEC.md
  - docs/platform/BLOG_EDITOR_UX_V2.md
  - docs/brand/PROJECT_BRAND_ADAPTER.md
---

# BLOG_CONTENT_GRAPH_SPEC - PR-18

## 0. 목적

문장군 블로그는 글 목록을 많이 쌓는 공간이 아니라, 고객이 한 질문에서 다음 판단으로 자연스럽게 이동하는 콘텐츠 허브여야 한다.

PR-18의 콘텐츠 그래프는 아래 흐름을 만든다.

```text
현재 글
-> 같은 제품군 글
-> 비슷한 현장 조건 글
-> 같이 보면 좋은 질문
-> 무료 방문실측으로 우리 집 조건 확인
```

이 구조는 AEO/GEO/LLMO 노출을 보장하는 장치가 아니다. 문장군의 실제 현장 경험, 제품 선택 기준, 고객 질문을 검색엔진과 AI 답변 시스템이 이해하기 쉬운 내부 연결 구조로 정리하는 것이다.

## 1. 이번 PR 범위

포함:

- 기존 공개 필드 기반 관련 글 모델.
- 같은 제품군 글 연결.
- 비슷한 현장 조건 글 연결.
- 관련 질문 연결.
- 상세 글 하단의 읽기 경로 UI.
- 운영자와 개발자가 참고할 그래프 규칙 문서.

제외:

- DB schema 변경.
- 새 수동 링크 테이블.
- 관리자 에디터의 수동 고정 관련 글 UI.
- FAQ rich result 보장 표현.
- 고객 개인정보나 내부 검수 데이터의 공개 노출.

## 2. 그래프 노드

현재 v1 노드는 공개 발행된 `blog_posts` 한 건이다.

사용 가능한 공개 필드:

```text
id
title
slug
excerpt
category
primary_keyword
target_question
summary_answer
service_area
product_type
published_at
updated_at
```

공개 미디어는 `blog_media.usage_status = published`인 대표 이미지 URL만 카드 썸네일로 사용한다.

주의:

`related_questions`는 Content OS 원본 테이블에 있지만 현재 anon column grant에 포함되지 않았다. 따라서 이번 PR의 public renderer는 `related_questions`를 새로 select하지 않는다. 이 필드를 공개 화면의 수동 질문 연결로 쓰려면 별도 DB 권한/정책 PR에서 공개 가능 여부를 먼저 결정한다.

## 3. 엣지 종류

### 3.1 같은 제품군

조건:

- 현재 글과 후보 글의 `product_type`이 정확히 같다.

화면 라벨:

```text
같은 제품군
```

섹션 제목:

```text
같은 제품군 글
```

고객 의미:

같은 중문이나 도어라도 집 구조, 옵션, 사이즈에 따라 판단이 달라질 수 있음을 보여준다.

### 3.2 비슷한 현장 조건

조건:

- 제목, 요약, 타깃 질문, 키워드에서 현장 조건 단어가 겹친다.

초기 현장 조건 단어:

```text
신발장
스위치
바닥 단차
벽공간
문틀
기둥
몰딩
레일
현관 폭
습기
소음
먼지
```

화면 라벨:

```text
비슷한 현장 조건
```

섹션 제목:

```text
비슷한 현장 조건
```

고객 의미:

제품명이 달라도 현장에서 확인해야 하는 조건이 같으면 함께 읽을 가치가 있다.

### 3.3 관련 질문

조건:

- v1 public renderer에서는 현재 글의 `target_question`과 후보 글의 제목/질문/요약이 겹친다.
- `related_questions` 기반 수동 질문 연결은 anon column grant와 공개 가능 여부가 정리된 뒤 별도 PR에서 켠다.
- 정확히 등록된 질문 문장을 공개 필드로 사용할 수 있게 되면 현장 조건보다 관련 질문으로 우선 분류한다.

화면 라벨:

```text
관련 질문
```

섹션 제목:

```text
같이 보면 좋은 질문
```

고객 의미:

고객이 한 질문을 읽은 뒤 자연스럽게 이어서 궁금해할 질문을 연결한다.

## 4. 정렬과 중복 제거

우선순위:

1. 같은 제품군
2. 비슷한 현장 조건
3. 관련 질문
4. 같은 주제 또는 다음 글 fallback

정렬 기준:

- 관계 점수 높은 순.
- 점수가 같으면 최신 발행일 순.
- 그래도 같으면 제목 가나다순.

중복 제거:

- 한 글은 상세 하단 그래프 섹션에 한 번만 나온다.
- 이미 섹션에 나온 글은 `다음 글` 링크로 다시 보여주지 않는다.

섹션 제한:

- 각 섹션 최대 3개.
- 글이 10개, 50개, 200개로 늘어도 상세 하단이 과하게 길어지지 않아야 한다.

## 5. 화면 원칙

고객 화면에 쓰지 않는 말:

```text
AEO
GEO
LLMO
콘텐츠 그래프
검색 노출
스키마 최적화
```

고객 화면에 쓰는 말:

```text
같은 제품군 글
비슷한 현장 조건
같이 보면 좋은 질문
이어 읽기
우리 집 조건 확인하기
```

CTA는 상품 구매가 아니라 무료 방문실측으로 연결한다.

```text
문 종류를 정하기 전에, 우리 집 구조와 시공 조건부터 같이 확인해드립니다.
```

## 6. 수동 연결 v2 기준

수동 관련 글 고정이 필요하면 별도 DB PR로 분리한다.

후보 구조:

```text
showroom.blog_post_links
- id
- source_post_id
- target_post_id
- relation_type
- display_order
- created_by
- created_at
```

검토 조건:

- 공개 가능한 글끼리만 연결한다.
- 관리자만 생성/수정/삭제한다.
- `source_evidence`, `brand_check_result`, 고객 상담 원문은 링크 이유로 공개하지 않는다.
- 화면 문구는 고객 언어로 변환한다.

## 7. QA 체크리스트

- [ ] 현재 글 자기 자신을 추천하지 않는다.
- [ ] 같은 제품군 글이 단순 최신 글보다 우선된다.
- [ ] 신발장, 스위치, 단차 같은 현장 조건이 제품군이 달라도 연결된다.
- [ ] 정확히 겹치는 질문 문장은 관련 질문으로 분류된다.
- [ ] 섹션별 3개 제한을 지킨다.
- [ ] 한 글이 여러 섹션에 중복 노출되지 않는다.
- [ ] 공개 페이지에 내부 검수 필드와 private media path가 없다.
- [ ] 390px 모바일에서 카드와 다음 글 링크가 overflow 없이 내려간다.
- [ ] 화면 문구가 AEO/GEO/LLMO 같은 내부 용어를 노출하지 않는다.
