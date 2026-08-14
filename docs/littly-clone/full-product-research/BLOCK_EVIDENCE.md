# Block evidence ledger

블록 ID는 `B01~B24`로 고정한다. 페이지 생명주기는 `P01`이며 블록 ID를 사용하지 않는다. `VERIFIED`는 화면 하나가 아니라 해당 행에 지정한 상태 체인을 모두 만족할 때만 사용한다.

## 핵심 렌더러

| ID | 블록 | 상태 | 최신 직접 증거 | 남은 것 |
|---|---|---|---|---|
| B01 | 단일 링크 | VERIFIED | `completion-pass/screenshots/CP-SINGLE-005~008`, 대응 DOM `CP-SINGLE-001~004` | 없음 |
| B02 | 그룹 링크 | BLOCKED | `CP-GROUP-011~012`, `CP-GROUP-001~002` DOM | 필수 이미지 업로드 후 5레이아웃·정렬·접기·공개 PC/모바일 |
| B04 | 동영상 | VERIFIED | `CP-VIDEO-011~019`, `CP-VIDEO-001~010` DOM | 없음 |
| B05 | 텍스트 | VERIFIED | `CP-TEXT-011~018`, `CP-TEXT-001~010` DOM/측정 | 없음 |
| B06 | 갤러리 | BLOCKED | `CP-GALLERY-011`, `CP-GALLERY-001` DOM, 업로드 차단 JSON | 이미지 업로드 후 레이아웃·정렬·공개 PC/모바일 |
| B10 | 파일공유 | BLOCKED | `CP-FILE-011`, `CP-FILE-001~002` DOM, 업로드 차단 JSON | PDF/복수 파일·정렬·다운로드·공개 PC/모바일 |
| P02 | 프로필 | VERIFIED | `CP-PROFILE-011~016`, `CP-PROFILE-001~006` DOM | 이미지 오류만 PARTIAL이나 레이아웃 렌더러는 완료 |

업로드 차단 원문은 `completion-pass/measurements/CP-UPLOAD-001-blocker.json`에 있다.

## 나머지 18개 블록

| ID | 블록 | 현재 판정 | 확보 범위 |
|---|---|---|---|
| B03 | SNS | PARTIAL | 편집 폼·채널 선택기·삭제 |
| B07 | 여백 | PARTIAL | 편집 폼·간격 범위·삭제 |
| B08 | 음악 | PARTIAL | Spotify/YouTube Music/SoundCloud 렌더, 채널 모달, 오류·삭제. 모바일 공개는 보조 증거 |
| B09 | 지도 | PARTIAL | 검색·지도 렌더·삭제 |
| B11 | 문의 | PARTIAL | 편집 폼·항목 대화상자·활성 상태·삭제 |
| B12 | 일정 | PARTIAL | 편집 폼·일정 추가·옵션·삭제 |
| B13 | 고객정보 | PARTIAL | 편집 폼·삭제 |
| B14 | 연락처 | PARTIAL | 편집 폼·연락처 추가·삭제 |
| B15 | 공지 | PARTIAL | 편집 폼·팝업 레이아웃·삭제 |
| B16 | 검색 | PARTIAL | 편집 폼·삭제 |
| B17 | 방명록 | PARTIAL | 편집 폼·관리 모달·삭제 |
| B18 | 국내 판매 | PARTIAL | 디지털/VOD/재능/실물 등록 폼·삭제 |
| B19 | 해외 판매 | PARTIAL | USD/JPY·디지털 등록 폼·삭제 |
| B20 | 후원 | PARTIAL | 편집 폼·옵션·삭제 |
| B21 | 예약 | PARTIAL | 1:1/그룹과 시간 설정·삭제 |
| B22 | 광고 | PARTIAL | 결과 화면·삭제 |
| B23 | 멤버십 | PARTIAL | 편집 폼·상품 대화상자·삭제 |
| B24 | 스마트스토어 | PARTIAL | 연동 결과·상품 수 측정·삭제 |

이 행들의 `PARTIAL`은 “기능을 모른다”는 뜻이 아니라 공개 PC/모바일·오류·정렬까지 동일한 기준으로 닫히지 않았다는 뜻이다. 편집기 셸과 폼을 구현하는 근거로는 사용할 수 있지만 전체 렌더러 완료 주장에는 사용하지 않는다.
