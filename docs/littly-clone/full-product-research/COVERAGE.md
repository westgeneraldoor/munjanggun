# Full-product coverage

판정값은 `VERIFIED / PARTIAL / UNKNOWN / BLOCKED / N/A`만 사용한다.

## 전역 영역

| ID | 영역 | 상태 | 직접 확인 | 구현 범위 판정 |
|---|---|---|---|---|
| S01 | 공통 셸 | VERIFIED | 3열 편집기, 공개 PC/390px 모바일, 공유·구독·설정 | 화면과 핵심 동작 모두 구현 |
| G01 | 페이지 | PARTIAL | 이름·slug 저장/복구, 멀티/서브 구조, 추가 유료 제한 | 편집·목록·독립 URL·탐색 계층 구현. 복사/삭제는 구현 단계에서 검증 |
| G02 | 디자인 | PARTIAL | 색·모양·액션·폰트·상단메뉴 대표 매핑과 복구 | 무료 제어는 실제 구현, 유료 조합은 셸 우선 |
| G03 | 분석 | VERIFIED | 루트, 기간 7종, 6개 전체보기 잠금 | 셸과 최소 조회/클릭 수집 구현. 유료 상세·다운로드는 후속 |
| G04 | 관리 | VERIFIED | 고객정보·매출·광고 상세의 빈/잠금 상태 | 셸 우선. 실제 주문·정산·계좌 연결은 후속 |
| G05 | 마케팅 | PARTIAL | 이메일 목록·수신자 빈 상태, DM 연결 직전, 문자 준비중 | 셸 우선. 실제 발송·계정 연결은 후속 |
| P01 | 페이지 생명주기 | PARTIAL | 이름·slug 변경/복구와 공개 반영 | URL은 평면 `/l/{slug}`, 관계는 `parent_id/sort_order` |
| P02 | 프로필 | VERIFIED | ON/OFF, 4개 레이아웃, 공개 PC/모바일 | 실제 구현 |
| P03 | 설정·공유·알림 | VERIFIED | 공개 공유/구독, QR, 공개 여부, 링크 열기 | 실제 구현 가능한 무료 기능 우선 |

## 핵심 렌더러 상태 체인

| 블록 | 빈 편집기 | 채움/미리보기 | 공개 PC | 공개 모바일 | 오류 | 정렬 | 삭제 | 최종 상태 |
|---|---|---|---|---|---|---|---|---|
| 단일 링크 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| 그룹 링크 | VERIFIED | PARTIAL | PARTIAL | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL |
| 동영상 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| 텍스트 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED | VERIFIED |
| 갤러리 | VERIFIED | PARTIAL | PARTIAL | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL |
| 파일공유 | VERIFIED | PARTIAL | PARTIAL | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL |
| 프로필 | N/A | VERIFIED | VERIFIED | VERIFIED | PARTIAL | N/A | N/A | VERIFIED |

세 블록의 `PARTIAL`은 실제 업로드 뒤 상태를 직접 재현하지 못했다는 뜻이다. 빈 폼과 필수값 오류는 직접 증거가 있지만 실제 업로드 결과를 대신하지 않는다. 제작 게이트에서는 세 항목을 `NON_BLOCKING_UNVERIFIED`로 분류하며, 이 미확인 상태 때문에 조사를 재개하지 않는다.

## 나머지 블록

SNS, 여백, 음악, 지도, 문의, 일정, 고객정보, 연락처, 공지, 검색, 방명록, 국내판매, 해외판매, 후원, 예약, 광고, 멤버십, 스마트스토어는 편집 폼·옵션·하위 모달·삭제 증거가 있다. 이를 전체 공개 렌더러까지 검증한 것으로 확대 해석하지 않는다. 세부 판정은 `BLOCK_EVIDENCE.md`에 있다.

## 실행하지 않는 외부 효과

실제 이메일·DM 발송, 인스타 계정 연결, 수익계좌 등록, 결제, 실고객 데이터 생성은 조사 범위가 아니다. UI 구조는 복제하되 기능화는 별도 승인·보안 검증 뒤 진행한다.
