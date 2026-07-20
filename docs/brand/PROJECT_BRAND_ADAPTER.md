---
document_type: "Project Brand Adapter"
version: "1.2.1"
status: "active"
created: "2026-06-25"
last_updated: "2026-07-20"
owner: "Codex PM"
source_brand_reference: "docs/brand/BRAND_SOURCE.md"
central_brand_root: "C:\\Users\\hjh\\안티그래비티\\문장군_브랜드"
---

# PROJECT_BRAND_ADAPTER - 문장군 웹 플랫폼/Content OS 적용 규칙

## 0. 역할

이 문서는 중앙 브랜드 원본을 이 프로젝트에 어떻게 적용할지 정한다.

중앙 원본은 문장군의 브랜드, 현장 판단, 디자인 원칙을 정한다. 이 어댑터는 그 기준을 문장군 웹 플랫폼, 공개 블로그, Content OS, 관리자 화면, 쇼룸에 맞게 적용하는 프로젝트 전용 규칙이다.

## 1. 프로젝트 범위

이 저장소는 단순 컬러북만이 아니다. 현재 범위는 아래를 포함한다.

- 기존 디지털 쇼룸/Public Experience
- 고객 포털과 무료방문 실측견적 신청
- 플랫폼 어드민 접수 큐
- 문장군 SEO/AEO Content OS
- 공개 `/blog`, `/blog/[slug]`
- 관리자 블로그 콘텐츠 큐와 블록형 에디터
- Supabase 기반 Auth/RBAC/RLS/Storage

따라서 브랜드 출력은 예쁜 소개 페이지보다 운영 가능한 고객 여정과 검수 가능한 콘텐츠 발행을 우선한다.

## 2. 중앙 원본 적용 방식

### 브랜드 정의

중앙 `BRAND_CONTEXT.md`를 따른다.

문장군은 무료 방문실측으로 집에 맞는 선택을 돕고, 직접 제작과 전속 시공으로 끝까지 책임지는 도어·중문 전문 브랜드다.

프로젝트 출력에서 유지할 중심 메시지:

```text
좋은 문을 고르는 일, 어렵지 않게 도와드립니다.
```

보조 메시지:

```text
무료 방문실측으로 집에 맞는 선택을 안내하고,
직접 제작과 전속 시공으로 끝까지 책임집니다.
```

### 현장 판단

중앙 `FIELD_JUDGMENT_RULES.md`를 따른다.

콘텐츠는 제품 스펙보다 고객이 실제로 헷갈리는 지점을 먼저 다룬다.

- 가격이 왜 달라지는지
- 우리 집에 가능한지
- 추가금이 생길 수 있는 조건
- 먼지, 소음, 시공 시간
- 신발장, 스위치, 바닥 단차, 기둥, 몰딩 같은 현장 변수
- 문짝만 가능한 경우와 문짝+문틀세트가 필요한 경우

수치와 기준은 확정 문장으로 쓰지 않는다. 현장 구조에 따라 달라질 수 있음을 함께 설명한다.

### 디자인

중앙 `DESIGN.md` v5.0의 `Editorial Showroom`을 기본 디자인 기준으로 삼는다. Ink를 주요 정보 위계와 CTA에, Forest를 상담·도움·선택 상태와 포커스에 사용한다. 큰 한글 display는 Tmoney RoundWind ExtraBold, 본문과 UI는 Pretendard를 사용한다. 과거 v3/v4 팔레트 이름을 새 canonical 토큰처럼 늘리지 않는다.

프로젝트는 중앙 저장소의 토큰 파일을 런타임에 직접 참조하지 않는다. 중앙 커밋 `e6b6eb618e08b907307497d87f58995bd945531c`의 `tokens/brand.css`와 `tokens/brand.tokens.json`을 `src/styles/generated/`에 생성하고, 코드에 고정된 manifest 전체 계약과 SHA-256/114개 고유 토큰 계약으로 검증한다. primary 정보·CTA는 Ink 900/700을, 상담·도움·선택 상태와 focus ring은 Forest를 사용한다. Tmoney RoundWind는 큰 한글 display에만 쓰며, 과거 팔레트 별칭은 호환 범위를 넘어 새 canonical 토큰으로 취급하지 않는다. `src/app/globals.css`의 import 순서는 생성 CSS → 얇은 프로젝트 어댑터 → 블로그 scoped experience다.

`src/styles/munjanggun-brand.css`는 중앙 canonical 토큰을 재선언하는 두 번째 정본이 아니다. 기존 화면이 아직 소비하는 별칭과 `portal`, `showroom-dark`, `admin`의 명시적 route scope만 둔다. 새 raw token은 `scripts/ui-token-policy.config.mjs`의 좁은 allowlist와 이름 있는 예외 없이 추가하지 않는다.

현재 공개 `/blog`에는 별도로 승인된 이미지 쇼룸 어댑터가 있다. 이 예외는 `docs/design/BLOG_EXPERIENCE_SYSTEM.md`와 아래 범위로 제한한다.

- 블로그 전용 시각 토큰은 `[data-mg-theme="blog"]` 안에서만 사용하고 중앙 v5 primitive/semantic 토큰에 연결한다.
- `/blog` 홈은 `data-mg-blog-experience="showroom"`으로 이미지 쇼룸 override를 명시한다.
- `/blog/[slug]`는 같은 semantic vocabulary의 reader 기본값을 사용한다.
- Tmoney RoundWind는 블로그의 큰 한글 display에만, Pretendard는 본문과 UI에 사용한다.
- 블로그 어댑터를 포털·무료방문실측·마이페이지·A/S·플랫폼 어드민의 자동 재설계 기준으로 확장하지 않는다.
- `src/styles/generated/brand.css`는 생성물로만 갱신하고, 블로그 작업이 직접 수정하지 않는다.
- `/blog` 홈의 승인된 DOM, 섹션 순서, gutter, section spacing, radius와 breakpoint geometry는 토큰 연결 작업에서 바꾸지 않는다.

기존 `docs/showroom/DESIGN_SYSTEM.md`의 다크 미니멀 갤러리 규칙도 쇼룸/컬러북 경험에만 적용한다. 빨간 가격 강조와 할인 전단지식 UI는 모든 범위에서 금지한다.

## 3. 프로젝트 전용 출력 방식

### Content OS 블로그

Content OS는 중앙 브랜드 원본을 글감으로 바로 발행하지 않는다. 반드시 이 프로젝트의 발행 구조를 통과한다.

```text
Codex 외부 원고 작성
-> 관리자 승인 원고 등록
-> reviewing 콘텐츠 큐
-> 블록형 편집
-> private 사진 후보 업로드
-> 사진 승인
-> 관리자 미리보기
-> 발행 server action
-> public WebP 또는 승인된 원본 GIF 승격
-> 공개 /blog, /blog/[slug]
-> sitemap / robots / metadata / JSON-LD
```

승인 원고 등록은 인증된 관리자만 사용할 수 있다. 제목, slug, SEO/AEO 필드, 본문 블록, 검증된 근거를 받아 글·블록·등록 이력을 원자적으로 저장하고 새 글 상태를 반드시 `reviewing`으로 명시한다. 이 경계에는 AI 호출, 모델 설정, OpenAI 키가 없다. 왼쪽 메뉴의 고정 명칭은 `블로그 콘텐츠`다.

블로그 글은 다음 구조를 권장한다.

1. 고객 질문이나 현장 고민으로 시작
2. 2-4문장의 요약 답변
3. 현장 판단 기준 설명
4. 사진이 필요한 문단은 이미지 슬롯으로 분리
5. 가격/추가금은 조건과 함께 설명
6. Q&A 블록은 리치결과 보장용이 아니라 고객 질문 자산으로 관리
7. CTA는 기본적으로 무료방문 실측견적 상담으로 연결

### 고객 포털과 플랫폼 화면

플랫폼은 쇼핑몰이 아니라 고객 여정 통합 포털이다.

고객 화면의 문구는 가입이나 상품 구매보다 아래 행동을 돕는다.

- 우리 집도 가능한지 확인받기
- 현장 사진으로 사전 상담 준비하기
- 무료방문 실측견적 신청하기
- 담당 매니저 연락을 기다리기
- 접수/상담/AS 상태 확인하기

### 쇼룸

쇼룸은 기존 Public Experience다. 색상, 소재, 시공 사례를 몰입감 있게 보여주는 역할은 유지한다.

다만 쇼룸의 다크 갤러리 톤을 문장군 전체 브랜드 디자인의 유일한 기준으로 보지 않는다. 중앙 DESIGN과 충돌하는 경우 쇼룸 전용 예외로 다룬다.

## 4. 프로젝트 전용 금지사항

브랜드 공통 금지:

- 최저가 보장
- 대한민국 No.1
- 고객만족 100%
- 무조건 가능
- 절대 추가금 없음
- 최고급 시공
- 업계 최고
- 실제 운영과 다른 "보양 작업 후 청소"
- AI 느낌이 강한 "이처럼", "결론적으로", "효과적입니다" 반복

프로젝트 전용 금지:

- 관리자 UI와 server action에서 AI 초안을 생성하거나 AI 전용 비밀값을 요구하지 않는다.
- 고객 현장 사진을 자동으로 공개하지 않는다.
- 미승인 사진을 public bucket으로 승격하지 않는다.
- `source_prompt`, `source_evidence`, `brand_check_result` 원문을 공개 렌더러에 노출하지 않는다.
- 고객명, 전화번호, 상세 주소, 동호수, 상담 원문을 블로그 본문이나 구조화 데이터에 넣지 않는다.
- `status = published` 전환은 client update로 처리하지 않는다.
- `usage_status = published` 전환은 발행 server action 밖에서 처리하지 않는다.
- FAQ/Q&A를 Google rich result 보장처럼 설명하지 않는다.
- GPTBot 허용 여부를 임의로 바꾸지 않는다. 현재 MVP 정책은 GPTBot 차단이다.

## 5. 프로젝트 QA/검수 기준

### 브랜드 검수

공개 콘텐츠 발행 전 확인한다.

- 중앙 브랜드 핵심 문장과 충돌하지 않는가?
- 가격을 단정하지 않고 조건과 실측 필요성을 설명했는가?
- 리뷰 수와 기준이 최신 근거와 맞는가?
- A/S 기간, 시공 기간, 서비스 가능 지역이 확인됐는가?
- 셀프 시공이나 경쟁사를 불필요하게 비방하지 않는가?
- 고객이 실제로 쓰는 표현으로 시작하는가?

### 사진/개인정보 검수

- 얼굴, 차량번호, 주소 단서, 동호수, 창밖 위치 단서가 없는가?
- 홍보 활용 동의가 확인됐는가?
- alt text가 있는가?
- caption/source label이 오해를 만들지 않는가?
- private 후보 사진과 public 공개 사진의 경계가 유지되는가?

### SEO/AEO 검수

- `target_question`은 실제 고객 질문형인가?
- `summary_answer`는 2-4문장으로 먼저 답하는가?
- BlogPosting/BreadcrumbList JSON-LD가 보이는 내용만 담는가?
- sitemap에는 published 글만 들어가는가?
- preview는 noindex/nofollow인가?
- robots는 admin/api/preview/drafts/private를 막는가?

### UI 검수

플랫폼 UI는 `docs/platform/PLATFORM_UI_CONSTITUTION.md`를 따른다.

- 모바일 390px 좌우 overflow 없음
- 버튼 상태 대비 유지
- 고객 화면과 어드민 화면의 역할 분리
- 어드민은 장식보다 스캔, 정렬, 빠른 처리 흐름 우선

## 6. 중앙 원본과 섞으면 안 되는 것

아래는 중앙 브랜드 원본이 아니라 이 프로젝트 어댑터 또는 플랫폼 문서에 둔다.

- Content OS DB/RLS/Storage 구조
- Supabase bucket policy
- publish server action과 WebP/원본 GIF 승격 로직
- `/admin/platform/blog` UX
- `/blog`, `/blog/[slug]` 렌더링 방식
- sitemap/robots/generateMetadata/JSON-LD 구현 기준
- platform-v1 브랜치 전략과 PR 운영
- 운영 리허설, rollback, Search Console 수동 검증 절차
- 프로젝트의 화면별 CSS/컴포넌트 구현 규칙

## 7. 확인 필요로 남길 항목

아래 정보는 중앙 원본에 있어도 실제 공개 콘텐츠 발행 전 최신 근거를 다시 확인한다.

- 리뷰 수와 기준일
- 대표 상품 단일 리뷰 수
- 가격대와 월 납입 표현
- 이벤트 혜택
- 서비스 가능 지역
- 시공 가능 시간과 기간
- A/S 조건
- 현관문/기타 품목의 실제 운영 범위
- 고객 사진의 홍보 활용 동의 범위

## 8. 글 작성 전 최소 체크

문장군 글을 작성하기 전, 작성자는 아래를 확인한다.

```text
1. 중앙 BRAND_CONTEXT.md를 읽었는가?
2. 중앙 FIELD_JUDGMENT_RULES.md를 읽었는가?
3. 중앙 DESIGN.md를 읽었는가?
4. 이 PROJECT_BRAND_ADAPTER.md를 읽었는가?
5. 이번 글이 해결할 고객 질문이 명확한가?
6. 사진이 필요한 문단과 승인 상태를 분리했는가?
7. 공개 발행 전 검수 게이트를 통과할 수 있는가?
```

## 9. 중앙 공식 자산 등록과 GIF 계약

`privacyStatus = official_reviewed` 중앙 자산은 이 프로젝트 사진보관함의 공식 원본 소스다. Codex와 관리자 UI는 같은 MIME·용량·dimensions·SHA-256 검증 코어를 사용한다.

Codex 등록은 사람용 파일 선택창을 대신 조작하지 않는다. 서버 전용 명령이 중앙 manifest의 `assetId`를 받아 원본 검증, private Storage 업로드, 정적 WebP poster/thumbnail 생성, 사진보관함 메타데이터·감사 이벤트 생성, 선택적인 `blog_media`·본문 image block 연결을 수행한다. 중앙 저장소는 clean 상태여야 하고 선택한 manifest와 원본은 모두 현재 HEAD에 tracked되어 실제 bytes가 HEAD와 같아야 한다. service-role 또는 Supabase secret key는 이 서버 명령과 서버 런타임에서만 사용한다. 감사 actor는 서버 allowlist `CODEX_AUDIT_ACTOR_ID`와 일치하는 administrator만 허용한다.

`scripts/register-official-brand-asset.mjs`의 `--cover`는 다른 대표사진이 없는 `reviewing` 글에만 대표사진을 지정한다. `--insert-after-block-id`는 지정한 기존 본문 블록 뒤에 image block을 만들고, 뒤 블록을 높은 순번부터 이동해 `(post_id, display_order)` 고유 계약을 보존한다. 이 연결은 service-role 전용 `showroom.attach_official_asset_to_reviewing_post(...)`가 글과 블록을 잠근 단일 DB 트랜잭션에서 media·usage·cover·순번·block·감사 이벤트를 함께 처리하므로 중간 실패는 전부 롤백된다. 관리자 편집기 저장은 같은 글의 server-side lease를 먼저 획득하므로 본문 저장 중 자동 배치는 거부되고, 자동 배치가 먼저 끝났다면 오래된 편집기 저장이 거부된다. lease는 자동 만료로 안전 경계를 약화하지 않으며 정상 저장의 `finally`에서 해제한다. 서버 장애로 15분 이상 남은 lease는 `scripts/reconcile-blog-editor-save-lease.mjs`가 관리자 allowlist·사유·감사 이벤트를 강제하는 RPC로만 조정한다. 연결 실패 뒤 새 자산 정리는 자산 행 잠금과 참조 확인·메타데이터 삭제를 하나의 RPC로 수행한 뒤 반환된 경로와 업로드 직후 알고 있는 경로만 Storage에서 지운다. 응답 유실 등 결과를 확인할 수 없는 경우에는 Storage를 건드리지 않는다. 이미 같은 media가 본문에 연결된 재실행은 중복 블록을 만들지 않는다.

등록 직후 상태는 다음과 같다.

- `official_reviewed`는 `privacy_checked = true`로 매핑할 수 있다.
- 중앙의 모든 `candidate`는 `promotion_consent_checked = false`인 비공개 후보로 시작한다.
- `claimRisk` 또는 `externalPublish`가 추가 확인을 요구하면 공개 승격을 막는다.
- 글 연결은 `reviewing` 원고에만 허용하고, 중앙 `assetId` 중복은 DB unique index로도 막는다.
- 공개 발행은 기존 관리자 승인과 publish server action만 수행한다.

GIF는 private 원본 애니메이션을 그대로 보존하고 poster와 thumbnail만 정적 WebP로 만든다. 공개 승격이 승인된 GIF는 원본 GIF bytes와 `image/gif` MIME을 `blog-media`에 새 경로, `upsert: false`로 복사해 브라우저에서 애니메이션을 재생한다. alt가 없거나 용량 제한을 넘거나 주장 검수가 끝나지 않은 GIF는 공개하지 않는다.

따라서 문서의 “직접 등록 금지”는 “검증·권한·감사 경계를 우회한 등록 금지”로 해석한다. 임의 SQL insert, `storage.objects` 직접 조작, 검증 없는 Storage 업로드는 금지한다.
