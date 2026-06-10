# 현재 작업 오더 - MVP-02 closeout

발행: 2026-06-10
브랜치: `platform-v1`
상태: 문서 최신화 / Preview 최종 검수 / PR 준비

## 목표

MVP-02를 다음 개발 단계로 넘기기 전에 현재 상태를 닫는다. 새 기능을 만들지 않고 문서, Preview 검수, PR 준비만 수행한다.

## 현재 배포

- 최신 커밋: `ce691aa MVP-02 플랫폼 UI 헌법과 견적 설정 정리`
- Preview URL: `https://munjanggun-p9d8j6thb-westgeneraldoors-projects.vercel.app`
- Branch alias: `https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app`
- Production URL `https://munjanggun.vercel.app`은 아직 최신 플랫폼 작업이 아니다.

## Preview 최종 검수 체크리스트

### 고객 계정

- [ ] Preview에서 카카오 로그인 callback 정상 확인
- [ ] 쇼룸 하단 `무료방문견적` 버튼이 `/portal/measure/new`로 진입하는지 확인
- [ ] 무료방문 실측견적 상담 1건 생성
- [ ] A/S 접수 1건 생성
- [ ] 마이페이지에서 최근 무료견적/A/S가 모바일에서 잘리지 않는지 확인
- [ ] 고객 수정요청 생성
- [ ] 고객 취소요청 생성

### 관리자 계정

- [ ] `moon@munjanggun.com` 관리자 진입 확인
- [ ] `west1836@gmail.com` 관리자 진입 확인
- [ ] `/admin/platform` 통합 접수 큐 확인
- [ ] 전체/무료실측/A/S/결제 필터 확인
- [ ] 전체/확인필요/확인완료 필터 확인
- [ ] 행 선택 시 데스크탑 우측 상세 확인
- [ ] 모바일 접수 카드 -> 상세 전환 확인
- [ ] 접수완료/수정완료/취소완료 처리 확인
- [ ] `/admin/platform/settings` 견적 접수 운영설정 화면 확인

### UI/회귀

- [ ] 무료견적/A/S 접수 화면의 상단바, 로딩, 완료 동선 일관성 확인
- [ ] 어드민 필터 active/hover 상태에서 글자 대비 확인
- [ ] 모바일 390px 기준 좌우 스크롤 없음 확인
- [ ] 기존 쇼룸 상세페이지 이미지/뒤로가기/CTA 회귀 없음 확인

## PR 준비

권장 PR:

- title: `MVP-02 플랫폼 신청/마이페이지/통합 접수 큐`
- base: 병합 기준 브랜치 확인 필요
- compare: `platform-v1`
- draft: 권장

PR 본문 초안:

```markdown
## Summary

- 무료방문 실측견적 상담 guided intake 구현
- 고객 마이페이지와 수정/취소 요청 흐름 추가
- A/S 접수 추가
- 무료실측 + A/S 통합 접수 큐 구현
- 견적 접수 운영설정과 품목/방문일 설정 정리
- 플랫폼 UI 헌법 추가 및 고객 접수/어드민 UI 일관성 보강

## Verification

- npm run lint
- npm run build
- Playwright: 고객 마이페이지 모바일 overflow, 무료견적/A/S 접수 프레임, 어드민 큐, 견적 설정 화면 확인
- Vercel Preview READY

## Preview

- https://munjanggun-git-platform-v1-westgeneraldoors-projects.vercel.app

## Remaining Manual Checks

- 실제 카카오 계정 callback
- Preview 고객 무료견적/A/S 접수 생성
- Preview 관리자 접수완료/수정완료/취소완료 처리
```

## 다음

최종 검수와 PR 준비가 끝나면 MVP-03 담당자 배정 + 접수 상태 관리 대화를 시작한다.
