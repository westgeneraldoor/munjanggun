# Littly clone research

이 디렉터리는 문장군 전용 링크 페이지 제품을 위한 리틀리 고충실도 역설계 기록이다. 현재 권위는 2026-08-14 Chrome 조사와 그 보완 조사에 있다.

## 문서 권위

1. `full-product-research/RESEARCH_STATE.md` — 현재 조사 단계, 제작 승인 경계와 비차단 미확인 항목.
2. `full-product-research/COVERAGE.md` — 영역·상태별 완료 원장.
3. `full-product-research/observations.md` — 직접 확인한 사실과 구현 판단.
4. `full-product-research/FULL_PRODUCT_MAP.md` — 제품 전체 구조.
5. `full-product-research/BLOCK_EVIDENCE.md` — 블록별 상태 증거.
6. `full-product-research/IMPLEMENTATION_SCOPE.md` — 대표 확인 전 실제 동작 프로토타입 범위.
7. `full-product-research/completion-pass/manifest.json`과 `validation.json` — 최신 보완 증거의 해시·형식 검증.

`direct-research/**`와 `evidence/**`는 역사적 원시 증거다. `DIRECT_RESEARCH_REPORT.md`, `IMPLEMENTATION_MATRIX.md`, 현재 `LITTLY_CLONE_SPEC.md`, `review/index.html`은 새 권위 체계에 의해 대체되었으며 현재 구현 승인 문서가 아니다.

## 판정 용어

- `VERIFIED`: 해당 행에 미리 정한 필수 상태 증거가 모두 있다.
- `PARTIAL`: 필수 상태 중 하나 이상이 빠졌다.
- `UNKNOWN`: 아직 확인 근거가 없다.
- `BLOCKED`: 도구·플랜·외부 상태 때문에 현재 확인할 수 없다.
- `N/A`: 해당 동작이 그 항목에 적용되지 않는다.

`INTENTIONAL`은 조사 상태가 아니라 문장군 제품 결정이다. 시각·편집기·공개 PC·공개 모바일·오류·정렬·삭제는 상태명이 아니라 `COVERAGE.md`의 개별 증거 열로 기록한다.

## 현재 결론

- 5개 전역 메뉴, 공통 셸, 24개 블록 선택기와 빈 편집 폼은 구현 입력으로 충분하다.
- 동영상·텍스트·단일 링크 정렬·프로필 4개 레이아웃·페이지명/slug 변경·디자인 대표 제어는 실제 상태 체인으로 보완했다.
- 제품 구조 조사 단계는 `RESEARCH_COMPLETE`다. 현재 자료로 실제 동작 프로토타입 제작을 시작할 수 있다.
- 그룹 링크·갤러리·파일공유의 실제 채움/공개 결과는 직접 재현하지 못했으므로 증거 상태는 `PARTIAL`, 제작 게이트는 `NON_BLOCKING_UNVERIFIED`다. 이 세 항목 때문에 업로드 권한 조사를 다시 시작하지 않는다.
- 조사 범위와 제작 범위는 다르다. 1차 프로토타입은 프로필·단일링크·그룹링크·텍스트·갤러리·동영상·파일공유 7개 블록과 공용 렌더러에 한정한다. 상단 5개 탭은 셸에 유지하되 관리·마케팅·수익화 기능은 만들지 않는다.
- 본 제작 확대는 실제로 누를 수 있는 프로토타입을 대표가 확인한 뒤 결정한다.

## 개인정보와 공개 저장소

원본 전체는 저장소 밖 Codex 전용 비공개 보관소에 보존했다. 공개 Git에는 브라우저 상단, 실제 분석 KPI, 정산·계정 상태, 메일 잔여량이 담긴 파일을 포함하지 않는다. 해당 경로는 `.gitignore`에서 명시적으로 제외한다.

원본 코드·브랜드 자산·문구 묶음은 복사하지 않는다. 화면 구조와 조작 흐름을 독립 구현하기 위한 관찰 사실만 사용한다.
