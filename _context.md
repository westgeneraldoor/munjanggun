# 프로젝트 컨텍스트

마지막 업데이트: 2026-06-10
현재 오더: n8n/AppSheet 견적·결제 흐름 지도화

## 현재 상태

브랜치 `platform-v1`에서 MVP-02는 개발/로컬검수/Preview 배포까지 완료됐다. Production `https://munjanggun.vercel.app`에는 아직 반영되지 않았고, 검수는 Preview 또는 branch alias에서 진행한다.

최신 커밋:

- `4eda6cf` docs: MVP-02 closeout 상태 정리
- `ce691aa` MVP-02 플랫폼 UI 헌법과 견적 설정 정리
- `cf92854` MVP-02 고객 접수 화면과 관리자 이동감 정렬
- `7ef451d` MVP-02 접수 UX와 큐 반응성 개선

최신 Preview:

- Preview URL: `https://munjanggun-by4o5srwi-westgeneraldoors-projects.vercel.app`
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
- MVP-02 closeout 문서 정리 및 Preview READY 확인

## 새 결정

MVP-03/04/05로 바로 진입하지 않는다.

기존 운영에는 이미 `AppSheet -> n8n -> HTML 견적서 생성 -> 솔라피 알림톡 발송 -> 고객 상세 견적서 확인` 흐름이 있다. 영업부 담당자는 AppSheet에 견적, 시공, 스펙을 등록하고 `견적서 보내기` 액션을 누를 뿐, 생성된 견적서 링크를 직접 다루지 않는다.

따라서 플랫폼이 견적서 작성 화면을 바로 만들면 영업부 이중 입력이 생길 수 있다. 결제도 플랫폼 결제만 있는 것이 아니라 네이버 결제, 일반/계좌 결제, 향후 플랫폼 결제가 공존한다.

다음 작업은 구현이 아니라 아래 흐름을 지도화하는 것이다.

1. 현재 AppSheet 견적 등록 데이터 구조 파악
2. n8n 워크플로우가 받는 payload 파악
3. 기존 HTML 견적서와 솔라피 알림톡 생성 흐름 파악
4. 네이버 결제 / 일반 결제 / 플랫폼 결제 / 계약금·잔금 분기 정의
5. 플랫폼이 끼어들 정확한 지점 결정
6. n8n MCP 또는 API/Webhook 연동 방식 판단

## 운영 원칙

- AppSheet는 당분간 운영 원장이다.
- n8n은 버리지 않는다. 오히려 AI와 더 유기적으로 쓰기 위한 핵심 자동화 계층으로 본다.
- 플랫폼은 무조건 결제 시스템이 아니라, 인스타 유입 고객의 접수, 견적 확인, 결제 방식 안내, 결제/입금 확인, 마이페이지 보관을 담당하는 고객 허브가 되어야 한다.
- 결제 구현보다 먼저 결제 분기와 기존 자동화 흐름을 정리한다.

## 다음 오더

`_order.md`의 `n8n/AppSheet 견적·결제 흐름 지도화`를 진행한다.

## 핵심 기준

- 플랫폼 기준 문서: `docs/platform/PLATFORM_TASKS.md`
- UI 헌법: `docs/platform/PLATFORM_UI_CONSTITUTION.md`
- 장기 결정: `docs/platform/DECISION_LOG.md`
- 기존 쇼룸은 Public Experience로 유지한다.
- `/admin`은 기존 쇼룸 CMS, 플랫폼 어드민은 `/admin/platform`이다.
