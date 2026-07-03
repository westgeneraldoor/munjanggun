# 문장군 블로그 출시 모드 PRD

## 1. 목적

문장군 사이트를 당장 블로그 중심으로 출시할 수 있게 만든다. 사용자는 `/blog`에서 글을 읽고, 필요하면 `/measure`에서 무료방문 실측견적을 이해한 뒤 `/portal/measure/new`로 신청한다.

이번 작업은 홈, 쇼룸, 브랜드 스토리, 전체 디자인 시스템을 완성하는 작업이 아니다.

## 2. 출시 범위

- `/blog`: 문장군 공식 지식 허브
- `/blog/[slug]`: 글 상세와 읽기 액션
- `/measure`: 무료방문 실측견적 안내 랜딩
- `/portal`: 블로그 활동과 상담 요청 확인용 최소 마이페이지
- 공개 로그인 메뉴: 블로그 중심 메뉴

## 3. 제외 범위

- `/` 완성형 홈 구축
- `/showroom`, `/story`, `/brand` 정보 구조 개편
- Supabase migration
- 관리자 블로그 대규모 개편
- A/S 전체 포털 고도화
- 전체 디자인 시스템 갈아엎기

## 4. 사용자 흐름

1. 사용자가 `/blog`에 진입한다.
2. 이미지 기반 hero에서 문장군 블로그의 성격을 이해한다.
3. 주제 카드, 검색, 먼저 읽기 좋은 글로 필요한 글을 찾는다.
4. 글을 읽고 저장, 도움됨, 질문하기를 사용한다.
5. 집 조건 판단이 어려우면 `/measure`로 이동한다.
6. `/measure`에서 무료방문 실측견적의 의미와 진행 순서를 확인한다.
7. 신청을 원하면 `/portal/measure/new`로 이동한다.
8. 로그인 후 `/portal`에서 블로그 활동과 신청 상태를 확인한다.

## 5. 블로그 홈 컴포넌트 원칙

리서치 참고:

- Vercel Blog: 최신 글, 카테고리, 검색 중심의 빠른 탐색형 블로그.
- GitHub Blog: 큰 주제군과 하위 주제, featured article을 묶은 콘텐츠 허브.
- Supabase Blog: product/engineering/news 중심으로 최신성과 실무성을 강조하는 피드.
- Vercel blog template: tabbed category navigation, full text search, responsive blog starter 패턴.

문장군 적용:

- Hero: 제품 판매보다 “우리 집 조건부터 확인”이라는 판단 기준을 제시한다.
- Search: 고객 질문, 제품명, 지역, 견적 키워드 검색.
- Topic Cards: 상품 분류보다 사용자가 가진 질문의 입구.
- Starter Article: 처음 온 고객이 먼저 읽어야 할 글.
- Latest Articles: 최근 발행 글.
- Related Threads: 비슷한 조건과 단어로 이어 읽기.
- Measure CTA: 모든 결정 지점에서 `/measure`로 연결.

## 6. 이미지 정책

- 실제 현장 사진은 승인된 공개 자산만 사용한다.
- 생성 이미지는 실제 시공 사례로 표현하지 않는다.
- 생성 이미지는 hero 분위기, 무료실측 안내, 카테고리 배경처럼 “브랜드/편집 이미지”로만 사용한다.
- 고객 개인정보, 주소, 전화번호, 얼굴, 원본 상담 기록은 노출하지 않는다.

이번 생성 이미지:

- `/images/blog-launch/blog-hero-entryway.png`
- `/images/blog-launch/measure-consultation-detail.png`
- `/images/blog-launch/blog-topic-details.png`

## 7. 성공 기준

- `/blog`가 쇼룸 홈처럼 보이지 않고 블로그 지식 허브로 보인다.
- 로그인 전후 공개 메뉴가 블로그 출시 맥락을 유지한다.
- 고객 메뉴에 미완성 홈/쇼룸으로 새는 링크가 없다.
- `/portal` 홈/로고가 `/blog`로 이동한다.
- `/measure`가 공개 랜딩으로 열리고 실제 신청은 `/portal/measure/new`로 이어진다.
- 모바일 390px에서 수평 overflow가 없다.
- `npm run lint`, `npm run build`, e2e/smoke가 통과한다.

## 8. 남은 후속 후보

- 블로그 상세 상단 이미지/문장군 읽기 컴포넌트 추가 고도화
- 승인형 Q&A 하단 노출
- 카테고리 체계 재정의 문서화
- 실제 공개 가능한 시공 사진과 생성 이미지 교체 정책
- 관리자 초안 입력값을 AEO 카테고리 체계와 연결
