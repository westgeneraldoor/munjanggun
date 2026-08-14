# Chrome completion pass

2026-08-14에 기존 조사에서 빠진 실제 상태 체인을 보완한 증거 묶음이다.

## 구성

- `screenshots/`: Chrome 화면 바이트를 직접 파일로 저장한 JPEG 59개.
- `raw/`: 같은 흐름의 DOM/접근성 원문 56개.
- `measurements/`: 텍스트 필드 한도와 업로드 차단 원문 2개.
- `manifest.json`: 모든 파일의 상대 경로, 크기, SHA-256, 공개 후보/비공개 상태.
- `validation.json`: 이미지 매직바이트·크기, JSON 파싱, 빈 원문, 중복 해시 검사.

`node scripts/audit-littly-completion-evidence.mjs`로 manifest와 validation을 재생성한다.

## 중요 경계

첫 8개 화면 이후 `screenshot({ path })`가 경로를 저장하지 않는 것을 무결성 감사에서 발견했다. 이후 모든 증거는 반환 바이트를 `fs.writeFile`로 직접 저장하고 JPEG 매직바이트 `FFD8FF`를 즉시 확인했다. 누락 상태는 `CP-*-011` 이후 재현·재캡처했다.

마케팅 운영 화면은 실제 계정 잔여량을 포함하므로 `PRIVATE_ONLY`이며 `.gitignore`에서 제외한다.

클립보드 붙여넣기 우회는 사용자 기존 클립보드가 열리는 안전 문제를 발견해 적용 전에 취소했다. `CP-FINAL-002`가 대화상자 0개·블록 0개의 원상복구를 증명한다. 세 번째 목표 턴의 권한 재확인 후에도 `Not allowed`였으며 `CP-FINAL-003`이 다시 블록 0개 복구를 증명한다.
