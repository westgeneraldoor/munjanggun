# Blog Experience Design Documents

이 폴더의 현재 진입점은 문장군 블로그의 이미지 쇼룸 경험이다. 새 세션은 아래 순서로 읽는다.

1. [BLOG_EXPERIENCE_SYSTEM.md](BLOG_EXPERIENCE_SYSTEM.md) — 토큰, 타이포, primitive, 예외 규칙
2. [BLOG_EXPERIENCE_HANDOFF.md](BLOG_EXPERIENCE_HANDOFF.md) — 실제 파일 지도, 검수, 다음 작업 순서
3. [05-design-qa-report.md](05-design-qa-report.md) — 이번 통합의 실행 검증과 화면 증적

역사 기록은 삭제하지 않는다.

- [04-implementation-contract.md](04-implementation-contract.md)는 승인된 `/blog` 홈의 정보 구조와 상호작용 계약이다.
- [05-design-qa-report.md](05-design-qa-report.md)는 구현 전후의 검수 기록이다. 최신 실행 결과가 과거 수치보다 우선한다.

## 범위와 권위

- 블로그 고유 시각 언어는 `src/styles/blog-experience.css`의 `[data-mg-theme="blog"]` scope가 소유한다.
- 중앙 브랜드의 기존 `--mg-*` 호환 토큰은 `src/styles/munjanggun-brand.css`에 남으며, 이 문서 작업은 이를 수정하지 않는다.
- `/blog` 홈은 `data-mg-blog-experience="showroom"`으로 image-showroom override를 명시한다. `/blog/[slug]`는 같은 semantic vocabulary의 reader 기본값을 사용한다.
- 이미지, 영상, alt text, focal point는 코드 UI와 분리된 `src/app/blog/blog-home-assets.ts` 레지스트리에서 관리한다.

이 시스템은 포털, 무료방문실측 랜딩, 마이페이지, A/S, 플랫폼 어드민의 재설계 기준이 아니다. 다음 화면이 블로그와 같은 언어가 필요할 때만 이 문서의 blog-owned primitive와 scope를 재사용한다.
