# Decision Log

## 2026-05-29 — 플랫폼 전략 문서 최상위 기준화

### 결정

`PLATFORM_STRATEGY.md`를 플랫폼 작업의 최상위 기준 문서로 둔다.

문장군 플랫폼의 목적은 쇼핑몰 구축이 아니라 고객 여정 통합이다.

### 이유

`PLATFORM_MIGRATION_AUDIT.md`는 기술/문서/코드 승계 관점의 감사로는 충분하지만, 고객이 왜 네이버예약 대신 문장군 플랫폼에서 무료실측을 신청해야 하는지에 대한 사업 전략 기준이 부족했다.

앞으로 장바구니, 쿠폰, 포인트, 회원등급, 자동견적 같은 기능 제안이 나올 때 `PLATFORM_STRATEGY.md`를 기준으로 컷하거나 후순위화한다.

### 실행 순서

1. `PLATFORM_DB_RBAC_DESIGN.md`를 MVP-01/02에 필요한 최소 범위로 작성한다.
2. MVP-01 OAuth 로그인을 구현한다.
3. MVP-02 무료실측 신청을 구현한다.
4. 관리자/영업 매니저 접수 확인과 담당자 배정으로 확장한다.

### 되돌릴 조건

실제 고객 신청 테스트에서 플랫폼 신청 전환이 네이버예약 대비 명확히 낮고, CTA/폼/로그인 마찰 개선 후에도 회복되지 않으면 플랫폼 신청을 보조 경로로 낮추고 네이버예약 중심 운영을 유지한다.

## 2026-05-29 — MVP-01/02 DB/RBAC 최소 설계 확정

### 결정

`PLATFORM_DB_RBAC_DESIGN.md`를 MVP-01 OAuth 로그인, MVP-02 무료실측 신청, MVP-03 담당자 배정 기반의 최소 DB/RBAC 설계 문서로 둔다.

### 핵심 설계

- 기존 `showroom` 스키마는 Public Experience CMS로 유지한다.
- 신규 플랫폼 데이터는 `platform` 스키마에 둔다.
- 역할은 `customer`, `sales_manager`, `administrator`로 시작한다.
- 고객 현장 사진은 공개 버킷이 아니라 private `measurement-photos` bucket과 signed URL로 처리한다.
- OAuth는 Kakao 우선, Google 보조, Naver는 `custom:naver` 후보로 둔다.

### 다음 실행

MVP-01 OAuth 로그인 구현 오더를 작성한다.

### 되돌릴 조건

`platform` 스키마 노출 또는 RLS 검증이 MVP 속도를 과도하게 막으면, server action 중심 접근으로 클라이언트 직접 Data API 접근을 줄인다. 단, 고객 PII와 사진 private 원칙은 되돌리지 않는다.

## 2026-05-29 — 플랫폼 개발 브랜치와 첫 오더

### 결정

`v2-cms`를 기준으로 `platform-v1` 브랜치를 만들고, 플랫폼 문서 베이스라인과 MVP-01 OAuth 로그인 오더를 이 브랜치에서 관리한다.

### 이유

기존 V2 쇼룸은 Public Experience로 유지해야 하며, 플랫폼 MVP 개발은 쇼룸 V2 안정선 위에서 독립적으로 진행되어야 한다.

### 실행

- `platform-v1` 브랜치 생성
- `_order.md`를 #052 MVP-01 OAuth 로그인 기반 구축 오더로 갱신

### 되돌릴 조건

`platform-v1`에서 쇼룸 V2 회귀가 발생하면 플랫폼 변경을 분리하고 `v2-cms`를 기준으로 재분기한다.
