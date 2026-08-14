# Evidence Index

## 상태

- 음악 이전의 기존 블록 결과는 직접 관찰 후 세션 압축 요약에서 복원한 `RECONSTRUCTED` 기록이다.
- 이번 기록 생성 전에 수행한 관찰의 스크린샷 원본과 원시 DOM 기록을 저장소에 영구 보존하지 못했다. 이 항목들은 `VERIFIED` 증거가 아니며 구현 확정 근거로 단독 사용하지 않는다.
- 현재 주 세션의 직접 원시 증거는 `../direct-research/dom/`에 저장한다.
- 인앱 브라우저 직접 캡처는 CDP 시간초과로 실패해 오류 원문을 보존했다.
- 화면 캡처는 출처를 명확히 나눠 보조 증거로만 사용한다.

## 캡처 출처

- `music/`: 초기 음악 조사 캡처
- `supplemental-screenshots/user-provided/`: 사용자가 대화에 첨부한 화면
- `supplemental-screenshots/global-ui/`: 이전 전역 UI 조사에서 선별·검수한 화면
- `supplemental-screenshots/single-link/`: 이전 단일 링크 조사에서 선별·검수한 화면
- `supplemental-screenshots/page-lifecycle/`: 이전 페이지 조사에서 선별·검수한 화면
- `supplemental-screenshots/music-detailed/`: 음악 블록 상세 화면 순서

분석 수치가 보이는 캡처와 빈/깨진 캡처는 본 작업 트리에 가져오지 않았다.

## 파일 규칙

`YYYYMMDD-{order}-{block}-{surface}-{state}.png`

- `surface`: `editor`, `preview`, `public-desktop`, `public-mobile`, `modal`, `error`
- `state`: 짧고 재현 가능한 상태명. 예: `empty`, `filled`, `layout-carousel`, `delete-confirm`

## 블록별 필수 증거

1. 생성 직후 빈 상태
2. 모든 필드와 옵션이 보이는 편집 상태
3. 편집기 미리보기
4. 실제 공개 데스크톱
5. 실제 공개 모바일
6. 오류 또는 필수값 미충족 상태
7. 삭제 확인과 삭제 후 빈 공개 페이지

개인정보, 로그인 토큰, 쿠키, 고객 자료, 내부 계정 데이터가 화면에 포함되면 저장하지 않는다.
