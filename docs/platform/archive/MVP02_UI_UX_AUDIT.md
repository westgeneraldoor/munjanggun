# MVP-02 / MVP-02.1 UI·UX·기능 감사

작성일: 2026-06-04  
검수 범위: 고객 포털, 무료방문 실측 견적상담 신청, Daum 주소 검색, 방문일 달력, 플랫폼 어드민 접수 큐, 플랫폼 운영 설정, 권한 리다이렉트

## 결론

현재 MVP-02.1은 DB/RLS/권한/예약 정책의 뼈대는 의미 있게 올라왔지만, 고객이 실제로 신청하는 모바일 화면은 출시 전 수정이 필요하다.

특히 `/portal/measure/new`는 모바일에서 달력 그리드가 화면 오른쪽으로 크게 밀려 나가고, 상단 제목 바가 중간에 다시 끼어드는 현상이 있다. “기능이 있다”와 “고객이 편하게 신청한다” 사이의 간극이 크다.

어드민도 접수 큐는 최소 확인 가능하지만, 운영 설정 화면은 모바일에서 표 기반 UI가 좁게 찌그러지고 버튼 터치 영역이 작아 실제 운영자가 반복적으로 쓰기에는 불편하다.

## 검수 증거

Playwright 감사 결과 저장 위치:

- `output/playwright/mvp02-ui-audit/audit-results.json`
- `output/playwright/mvp02-ui-audit/01-admin-settings-categories-mobile.png`
- `output/playwright/mvp02-ui-audit/02-admin-settings-schedule-mobile.png`
- `output/playwright/mvp02-ui-audit/03-admin-queue-mobile.png`
- `output/playwright/mvp02-ui-audit/04-customer-portal-mobile.png`
- `output/playwright/mvp02-ui-audit/05-measure-initial-mobile.png`
- `output/playwright/mvp02-ui-audit/06-measure-address-modal-mobile.png`
- `output/playwright/mvp02-ui-audit/07-measure-filled-mobile.png`

자동 검수 요약:

- 콘솔 에러: 0건
- 고객이 `/admin/platform/settings` 접근 시 `/portal`로 차단: 정상
- 영업 매니저가 `/admin/platform/settings` 접근 시 `/portal`로 차단: 정상
- 영업 매니저가 `/admin/platform` 접근 시 현재 `/portal`로 차단됨: 정책 확인 필요
- 고객 신청폼 채움 테스트 후 제출 버튼 비활성 유지: 재검증 및 수정 필요

## P0 - 출시 전 반드시 수정

### 1. 고객 신청폼 모바일 달력 레이아웃 붕괴

증거: `output/playwright/mvp02-ui-audit/05-measure-initial-mobile.png`, `07-measure-filled-mobile.png`

문제:

- 모바일에서 달력 그리드가 폼 카드 폭을 벗어나 오른쪽으로 크게 확장된다.
- 실제 고객은 날짜를 고르려다 화면이 깨졌다고 느낄 가능성이 높다.
- `window.innerWidth`가 822로 잡힌 케이스가 있어 모바일 viewport/meta/layout 상호작용도 확인해야 한다.

관련 파일:

- `src/components/platform/VisitDatePicker.tsx`
- `src/components/platform/visit-date-picker.module.css`
- `src/app/portal/measure/new/measure-form.module.css`

권장 수정:

- 달력을 390px 기준에서 먼저 다시 설계한다.
- `grid-template-columns: repeat(7, minmax(0, 1fr))`, `min-width: 0`, `max-width: 100%`, 긴 사유 텍스트 숨김/툴팁화 적용.
- 모바일에서는 날짜 셀 안에 “최소 2일 전 신청 가능” 같은 긴 문구를 직접 넣지 말고 하단 안내/선택 불가 사유 영역으로 분리한다.

### 2. 신청폼 상단 제목 바가 중간에 재등장

증거: `output/playwright/mvp02-ui-audit/07-measure-filled-mobile.png`

문제:

- 스크롤 중간에 `무료방문 실측 견적상담 신청` 헤더가 콘텐츠를 가로막듯 다시 보인다.
- 고객은 화면이 겹쳤거나 깨졌다고 느낄 수 있다.

관련 파일:

- `src/app/portal/measure/new/measure-form.module.css`

권장 수정:

- 모바일에서 sticky header를 제거하거나 높이를 줄이고, 본문과 겹치지 않도록 z-index/position 구조를 재정리한다.
- 고객 폼은 “단계형 진행감”이 더 중요하므로 고정 헤더보다 하단 고정 신청 버튼/진행 상태가 더 적합하다.

### 3. 신청폼 제출 가능 상태 검증 실패

증거: `audit-results.json`의 `measure-submit-mobile.submitDisabled = true`

문제:

- 자동 테스트에서 이름, 전화, 주소, 카테고리, 날짜, 시간대, 개인정보 동의를 채웠지만 제출 버튼이 계속 비활성 상태였다.
- 수동 주소 fallback 흐름에서 `address` 상태와 실제 input 값, React state, 유효성 조건이 어긋났을 가능성이 있다.

관련 파일:

- `src/app/portal/measure/new/MeasureForm.tsx`

권장 수정:

- 필수 항목별 완료 여부를 화면에 명확히 표시한다.
- 제출 버튼이 비활성일 때 “무엇이 부족한지” 고객에게 알려야 한다.
- Playwright로 Daum 주소 선택 성공 케이스와 수동 입력 fallback 케이스를 각각 별도로 검증한다.

## P1 - MVP-02.2 우선 수정

### 4. 어드민 운영 설정 모바일이 표 중심이라 운영성이 낮음

증거: `01-admin-settings-categories-mobile.png`, `02-admin-settings-schedule-mobile.png`

문제:

- 카테고리 목록의 수정/비활성화 버튼이 모바일에서 매우 좁게 보인다.
- 정렬 버튼 26px, 체크박스 16px, 삭제 버튼 텍스트 링크 등 터치 영역이 작다.
- 운영자가 휴대폰으로 일정/카테고리를 고치기 어렵다.

관련 파일:

- `src/app/admin/platform/settings/SettingsClient.tsx`
- `src/app/admin/platform/settings/settings.module.css`

권장 수정:

- 768px 이하에서는 테이블 대신 카드 리스트로 전환한다.
- 카테고리 `key`는 운영자에게 보조 정보로 접고, 표시명/노출/순서/수정 액션을 우선 배치한다.
- 삭제/비활성화는 텍스트 링크가 아니라 명확한 버튼과 확인 흐름으로 둔다.

### 5. 공휴일/수동 예외가 운영자에게 구분되지 않음

문제:

- DB에는 `source = holiday/manual`을 넣었지만, 어드민 UI에서는 공휴일 seed와 운영자 수동 예외가 충분히 구분되지 않는다.
- `공휴일 자동 마감`을 끄면 holiday source는 고객 달력에서 열릴 수 있는데, 어드민 목록에서는 여전히 “닫힘”처럼 보일 수 있어 운영 혼선이 생긴다.

관련 파일:

- `src/app/admin/platform/settings/SettingsClient.tsx`

권장 수정:

- 예외 목록에 `공휴일 기본값` / `운영자 수동 설정` 뱃지를 표시한다.
- 공휴일 자동 마감 토글 OFF 시 holiday source 행에는 “현재 고객 달력에서는 열림” 상태를 명확히 보여준다.

### 6. 고객 포털이 아직 AI 생성 UI 느낌이 강함

증거: `04-customer-portal-mobile.png`

문제:

- 이모지 아이콘이 서비스 신뢰감보다 임시 화면 느낌을 준다.
- `A/S 접수`, `내 견적 & 결제 내역`, `시공 / A/S 이력`이 모두 준비중인데 카드가 같은 무게로 보여 핵심 행동이 약해진다.

관련 파일:

- `src/app/portal/page.tsx`
- `src/app/portal/portal.module.css`

권장 수정:

- lucide 아이콘으로 교체한다.
- 첫 화면 CTA는 `무료방문 실측 견적상담 신청`과 `A/S 접수 안내` 중심으로 줄이고, 준비중 카드는 하단 보조 영역으로 낮춘다.

## P2 - 후속 품질 개선

### 7. 최근 신청 내역이 구형 단일 카테고리만 조회

문제:

- 고객 포털 최근 신청 내역은 `interest_category`만 조회한다.
- MVP-02.1에서 `interest_categories text[]`가 도입되었으므로 다중 선택 결과가 고객 포털에 제대로 반영되지 않을 수 있다.

관련 파일:

- `src/app/portal/page.tsx`

권장 수정:

- `interest_categories`를 함께 조회하고, 카테고리 설정 테이블의 label과 매핑해 표시한다.

### 8. 고객 신청폼 문구가 무료방문견적에 과하게 고정됨

문제:

- 플랫폼 전체 로그인/포털 맥락은 A/S, 견적, 결제, 이력까지 확장되어야 한다.
- 신청폼 자체는 무료방문 실측 페이지이므로 괜찮지만, 포털/로그인/CTA 문구는 “문장군 고객 여정” 중심으로 정리해야 한다.

관련 파일:

- `src/app/login/page.tsx`
- `src/app/portal/page.tsx`

## 다음 수정 오더 제안

`MVP-02.2 Mobile UX Rescue`로 묶어서 진행한다.

1. 고객 신청폼 모바일 레이아웃 구조 수정
2. 달력 컴포넌트 모바일 재설계
3. 주소 검색/수동 주소 제출 가능 상태 검증
4. 어드민 설정 모바일 카드형 전환
5. 포털 이모지 제거 및 고객 여정 중심 CTA 정리
6. Playwright 390px/768px/1440px 스크린샷 재검수

## 사용자 추가 결정사항 반영

2026-06-04 사용자 확인 사항:

- 프로젝트 어디에도 이모지를 사용하지 않는다.
- 무료방문 실측 견적상담 신청에서 방문 시간대 선택 항목은 제거한다.
- 고객은 방문 희망일만 고른다.
- 정확한 방문 시간은 전날 오후 담당 매니저가 안내한다는 운영 정책을 신청 페이지 안에서 자연스럽게 설명한다.
- 네이버예약의 긴 사전 안내문은 그대로 복붙하지 않고, 다음 내용을 고객이 읽기 쉬운 구성으로 재작성한다.
  - 견적 가능 지역
  - 충청권 가능 요일
  - 방문 불가 지역
  - 당일/익일 예약 접수 기준
  - 방문 시간은 동선 기준으로 배정된다는 안내
  - 무료 견적, 시공 소요 기간, 정리, 견적 유효기간 FAQ
- 달력은 크게 만들 필요가 없다.
- 가능한 날짜는 켜지고, 불가능한 날짜는 꺼져 있으면 된다.
- 날짜 셀 안에 긴 사유 텍스트를 넣지 않는다.
- 어드민 카테고리 추가에서 식별 Key 입력은 제거한다.
- 어드민 카테고리 구성은 `품목명`, `품목설명`, `품목이미지`만 사용한다.
- 품목 이미지는 네이버예약 옵션처럼 스퀘어 썸네일 기준으로 관리한다.
- 어드민 접수 큐 필터는 `전체`, `신규`, `접수완료`, `취소`만 둔다.
- 접수 리스트에서는 담당자가 쉽게 `접수` 또는 `취소` 처리할 수 있어야 한다.

이 결정사항은 MVP-02.2 수정 오더에 포함한다.

## 현재 GO / NO-GO 판단

- 기술 기반 검증: 조건부 GO
- 고객 신청 모바일 UX: NO-GO
- 어드민 설정 모바일 운영성: NO-GO
- 권한 차단 기본 흐름: GO
- 다음 단계: 기능 추가보다 UX 구조 수정이 우선
