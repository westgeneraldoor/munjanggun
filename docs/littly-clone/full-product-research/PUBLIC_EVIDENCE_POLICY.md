# Public evidence policy

저장소 원격은 공개 저장소다. 조사 원본과 공개 가능한 구현 근거를 분리한다.

## 비공개 원본

- 위치: 저장소 밖 Codex 전용 비공개 보관소. 정확한 로컬 경로는 공개 문서에 기록하지 않는다.
- 보존 확인: 현재 조사 원본 637개와 비공개 복사본의 같은 상대 경로·SHA-256 비교 결과 누락 0건·불일치 0건이다. 비공개 폴더에는 PDF 확인용 렌더 1개가 추가로 있어 총 638개다.
- 포함: 브라우저 상단, 실제 분석 KPI, 정산·계정 상태, 메일 잔여량을 포함한 원시 화면과 DOM.

## 공개 제외

`.gitignore`는 다음을 명시적으로 제외한다.

- 사용자 제공 Chrome 전체 화면 2장.
- 분석 화면·DOM·측정의 실제 KPI.
- 관리 화면·DOM·측정의 실제 정산·계정 상태.
- 마케팅 화면·DOM·측정의 실제 메일 잔여량·계정 상태.
- 최신 completion pass의 마케팅 운영 화면.

고객 이름·전화·주소·문의 행, 이메일 주소, 토큰·쿠키·JWT·API 키·서명 URL, 로컬 사용자 경로, EXIF GPS·기기·작성자는 감사에서 발견되지 않았다.

## 공개 전 검증

1. `node scripts/audit-littly-completion-evidence.mjs`
2. `node scripts/audit-littly-public-evidence.mjs`
3. `git status --ignored --short docs/littly-clone`
4. 제외 대상이 `!!`로 표시되는지 확인.
5. `git diff --cached --name-only`에 제외 대상이 없는지 확인한 뒤에만 커밋.

민감 원본을 공개본으로 바꿀 때는 앱 영역만 새로 캡처하거나 합성값을 사용한다. 원본 픽셀을 임의로 변형한 이미지를 증거로 승격하지 않는다.
