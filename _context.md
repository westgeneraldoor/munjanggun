# 프로젝트 컨텍스트

마지막 업데이트: 2026-06-10
현재 오더: MVP-02 closeout 정리

## 현재 상태

브랜치 `platform-v1`에서 MVP-02는 개발/로컬검수/Preview 배포까지 완료됐다. Production `https://munjanggun.vercel.app`에는 아직 반영되지 않았고, 검수는 Preview에서 진행한다.

최신 커밋:

- `ce691aa` MVP-02 플랫폼 UI 헌법과 견적 설정 정리
- `cf92854` MVP-02 고객 접수 화면과 관리자 이동감 정렬
- `7ef451d` MVP-02 접수 UX와 큐 반응성 개선
- `b63924d` MVP-02 접수 상태와 통합 큐 보강

최신 Preview:

- Preview URL: `https://munjanggun-p9d8j6thb-westgeneraldoors-projects.vercel.app`
- Branch alias: `https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app`

## 최근 완료

- 무료방문 실측견적 상담 guided intake
- 고객 마이페이지 최근 무료견적/A/S 표시
- 고객 수정요청/취소요청
- A/S 접수
- 무료실측 + A/S 통합 접수 큐
- 어드민 확인필요/확인완료 필터
- 견적 접수 운영설정
- 공통 고객 접수 프레임/로딩/완료 동선 정렬
- 플랫폼 UI 헌법 `docs/platform/PLATFORM_UI_CONSTITUTION.md` 추가
- `npm run lint`, `npm run build`, Playwright 주요 화면 검수 통과

## 남은 closeout

1. Preview에서 실제 계정 기준 최종 검수
   - 카카오 로그인 callback
   - 무료견적 접수 1건
   - A/S 접수 1건
   - 고객 수정요청/취소요청
   - 어드민 접수완료/수정완료/취소완료
2. GitHub draft PR 생성
   - base는 병합 기준 확인 후 선택
   - compare는 `platform-v1`
3. 사용자 확인 후 MVP-03 담당자 배정 + 접수 상태 관리 대화 시작

## 핵심 기준

- 플랫폼 기준 문서: `docs/platform/PLATFORM_TASKS.md`
- UI 헌법: `docs/platform/PLATFORM_UI_CONSTITUTION.md`
- 장기 결정: `docs/platform/DECISION_LOG.md`
- 기존 쇼룸은 Public Experience로 유지한다.
- `/admin`은 기존 쇼룸 CMS, 플랫폼 어드민은 `/admin/platform`이다.
