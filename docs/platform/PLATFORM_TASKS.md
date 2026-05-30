---
document_type: "Platform Task Board"
version: "1.0.0"
status: "active"
last_updated: "2026-05-30"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_prd: "docs/platform/PRD_PLATFORM_v1.0.md"
source_db_rbac: "docs/platform/PLATFORM_DB_RBAC_DESIGN.md"
---

# PLATFORM_TASKS — 문장군 플랫폼 MVP

## 0. 이 문서의 역할

이 문서는 문장군 플랫폼 제작 일정의 기준 문서다.

`PROJECT_TASKS.md`는 기존 V2 쇼룸 구현 히스토리와 전체 상태 보드로 유지한다. 플랫폼 개발의 실제 페이즈, 오더 순서, 완료 기준은 이 파일을 우선한다.

문서 우선순위:

1. `docs/platform/PLATFORM_STRATEGY.md`
2. `docs/platform/PLATFORM_TASKS.md`
3. `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
4. `docs/platform/PRD_PLATFORM_v1.0.md`
5. `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
6. `docs/platform/DECISION_LOG.md`
7. `docs/platform/BRAND_CONTEXT.md`
8. `_order.md`
9. `_context.md`

핵심 원칙:

- 플랫폼은 쇼핑몰이 아니라 고객 여정 통합 포털이다.
- 기존 V2 쇼룸은 Public Experience로 유지한다.
- 문서만 오래 만들지 않는다. 로그인 이후 무료실측 신청 화면까지 빠르게 간다.
- 고객 개인정보, 현장 사진, role 권한은 MVP라도 대충 만들지 않는다.
- AppSheet 관계 결정은 운영 이중입력을 막기 위한 필수 운영 결정이다.

## 1. 현재 크리티컬 패스

```text
MVP-01 OAuth 로그인 기반
→ MVP-02 무료실측 신청
→ MVP-03 관리자/영업 매니저 접수 확인
→ MVP-04 담당자 배정
→ MVP-05 견적 확인
→ MVP-06 결제 연결
```

현재 즉시 실행 순서:

| 순서 | 작업 | 상태 | 비고 |
|---|---|---|---|
| 1 | MVP-01 OAuth 로그인 기반 구축 | Ready | `_order.md` #052 |
| 2 | MVP-02 무료실측 신청 구현 오더 작성 | Next | 로그인 완료 후 바로 작성 |
| 3 | MVP-02 무료실측 신청 구현 | Next | 고객이 실제 신청 가능한 첫 화면 |
| 4 | AppSheet 관계 결정 | Next | MVP-02 이후, MVP-03 전에는 결정 필요 |
| 5 | MVP-03 관리자/영업 매니저 접수 확인 | Planned | 신청 처리 업무 시작점 |

## 2. Phase 0 — 플랫폼 기준선 정리

목표: 쇼룸 전용 제품에서 플랫폼 제품으로 확장하기 위한 문서, 브랜치, 기준 경계를 만든다.

상태: 완료

완료 항목:

- [x] `platform-v1` 브랜치 생성
- [x] `v2-cms`를 플랫폼 개발 기준 브랜치로 확정
- [x] `docs/platform/PLATFORM_STRATEGY.md` 작성
- [x] `docs/platform/PLATFORM_MIGRATION_AUDIT.md` 작성
- [x] `docs/platform/PRD_PLATFORM_v1.0.md` 기준 문서 승격
- [x] `docs/platform/CODEX_PROJECT_BOOTSTRAP.md` 기준 문서 승격
- [x] `docs/platform/PLATFORM_DB_RBAC_DESIGN.md` 작성
- [x] `_order.md` #052 MVP-01 OAuth 로그인 오더 작성
- [x] 플랫폼 문서와 기존 쇼룸/아카이브 문서 폴더 분리
- [x] 플랫폼 전용 태스크 보드 작성

완료 기준:

- [x] 다음 에이전트가 `docs/platform/PLATFORM_TASKS.md`만 읽어도 전체 플랫폼 일정 순서를 이해할 수 있다.
- [x] 신규 플랫폼 기능 판단 기준이 쇼룸 PRD가 아니라 플랫폼 전략/태스크/DB 설계로 이동했다.

## 3. Phase 1 — MVP-01 OAuth 로그인 기반

목표: 고객이 플랫폼에 로그인하고, `customer` role profile이 안전하게 생성되는 기반을 만든다.

상태: Ready

작업 오더:

- `_order.md` #052

구현 항목:

- [ ] Next.js App Router/route handler/proxy 관련 현재 버전 문서 확인
- [ ] Supabase Auth/Social Login/RLS 공식 문서 확인
- [ ] `platform` schema 생성 migration 작성
- [ ] `platform_private` schema 생성 migration 작성
- [ ] `platform.profile_role` enum 생성
- [ ] `platform.profiles` 테이블 생성
- [ ] `platform.staff_profiles` 테이블 생성
- [ ] OAuth 최초 로그인 시 profile 자동 생성 trigger 작성
- [ ] `platform_private.current_role()` 작성
- [ ] `platform_private.is_admin()` 작성
- [ ] `platform_private.is_sales_manager()` 작성
- [ ] `profiles` RLS enable
- [ ] 고객 본인 profile 조회 policy 작성
- [ ] 고객 role 자체 변경 금지 policy 작성
- [ ] 관리자 전체 profile 조회/수정 policy 작성
- [ ] `src/types/database.ts` platform 타입 추가 또는 재생성
- [ ] `src/lib/supabase/platform-server.ts` 추가
- [ ] `src/lib/supabase/platform-client.ts` 추가
- [ ] `src/app/auth/callback/route.ts` 추가
- [ ] `src/app/login/page.tsx` 추가
- [ ] `src/app/login/login.module.css` 추가
- [ ] `src/app/portal/page.tsx` placeholder 추가
- [ ] `src/app/portal/portal.module.css` 추가
- [ ] `src/proxy.ts`에서 `/portal` 보호 추가
- [ ] 기존 `/admin` auth guard 회귀 없음 확인

완료 기준:

- [ ] Kakao 또는 Google OAuth 로그인 흐름이 동작한다.
- [ ] 로그인 사용자는 `platform.profiles.role = customer`로 생성된다.
- [ ] 비로그인 사용자는 `/portal`에 접근할 수 없다.
- [ ] 고객은 role을 클라이언트에서 바꿀 수 없다.
- [ ] 기존 쇼룸 고객 페이지와 `/admin` CMS가 깨지지 않는다.
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과

주의:

- Naver 로그인은 MVP-01 블로커가 아니다.
- 고객 role 판단에 `user_metadata`를 사용하지 않는다.
- 쇼룸의 `showroom` schema와 플랫폼의 `platform` schema를 섞지 않는다.

## 4. Phase 2 — MVP-02 무료실측 신청

목표: 실제 고객이 플랫폼에서 이름, 전화번호, 주소, 사진을 넣고 무료실측을 신청할 수 있게 한다.

상태: Planned

오더 작성 조건:

- [ ] Phase 1 완료
- [ ] `platform.profiles`와 로그인 세션 흐름 확인
- [ ] 고객 현장 사진 private bucket 정책 재확인

구현 항목:

- [ ] `platform.measurement_requests` migration 작성
- [ ] `platform.measurement_photos` migration 작성
- [ ] `platform.measurement_request_events` migration 작성
- [ ] `measurement-photos` private bucket 생성 정책 결정
- [ ] 고객 신청 생성 server action 또는 route handler 작성
- [ ] 고객 신청 폼 UI 작성
- [ ] 필수 필드: 이름
- [ ] 필수 필드: 전화번호
- [ ] 필수 필드: 주소
- [ ] 선택/필수 결정: 상세주소
- [ ] 선택/필수 결정: 제품 관심 카테고리
- [ ] 선택/필수 결정: 현장 사진
- [ ] 개인정보 수집 동의 UI 작성
- [ ] 신청 완료 화면 작성
- [ ] `/portal`에서 내 신청 목록 조회
- [ ] `/portal`에서 내 신청 상세 조회
- [ ] 고객은 본인 신청만 조회 가능하도록 RLS 검증
- [ ] 신청 생성 이벤트 기록
- [ ] 쇼룸 CTA에서 무료실측 신청으로 연결할 위치 결정

완료 기준:

- [ ] 실제 고객 플로우로 무료실측 신청 row가 생성된다.
- [ ] 고객은 본인 신청만 볼 수 있다.
- [ ] 사진은 public URL로 노출되지 않는다.
- [ ] 신청 완료 후 회사가 접수 사실을 확인할 수 있다.
- [ ] 모바일에서 폼이 막힘 없이 작성된다.
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과

주의:

- 이 단계의 목표는 완벽한 운영 OS가 아니라 첫 신청이 실제로 들어오는 것이다.
- 네이버예약을 즉시 제거하지 않는다. 플랫폼 신청 CTA를 먼저 검증한다.

## 5. Phase 3 — AppSheet 관계 결정

목표: 플랫폼 DB와 기존 AppSheet 전산의 역할을 정해 운영 이중입력을 막는다.

상태: Planned

결정 항목:

- [ ] AppSheet를 당분간 운영 원장으로 유지할지 결정
- [ ] 플랫폼 DB를 고객 포털 원장으로 둘지 결정
- [ ] 무료실측 신청을 AppSheet에 수동 이관할지 결정
- [ ] CSV/export 방식이 필요한지 결정
- [ ] AppSheet API 연동을 이번 MVP에 포함할지 후순위로 둘지 결정
- [ ] 상태값 매핑표 작성
- [ ] 담당자 배정 주체 결정: 플랫폼 우선 / AppSheet 우선 / 병행

권장 초기 결정:

| 항목 | 권장 |
|---|---|
| 고객 신청 원장 | 플랫폼 DB |
| 내부 운영 원장 | AppSheet 유지 |
| MVP 연동 방식 | 수동 확인 또는 CSV export |
| API 자동 연동 | MVP 이후 |
| 담당자 배정 | 플랫폼에서 먼저 실험, 필요 시 AppSheet 반영 |

완료 기준:

- [ ] 운영자가 같은 신청을 두 번 입력하지 않아도 되는 최소 프로세스가 정해졌다.
- [ ] MVP-03 관리자/영업 매니저 화면이 어느 데이터를 기준으로 볼지 결정됐다.

## 6. Phase 4 — MVP-03 관리자/영업 매니저 접수 확인

목표: 회사가 플랫폼으로 들어온 무료실측 신청을 확인하고 처리 상태를 관리할 수 있게 한다.

상태: Planned

구현 항목:

- [ ] 관리자 접수 목록 화면
- [ ] 관리자 접수 상세 화면
- [ ] 영업 매니저 접수 목록 화면
- [ ] 영업 매니저 접수 상세 화면
- [ ] role별 접근 제어
- [ ] 접수 상태 변경
- [ ] 상담 메모 작성
- [ ] 고객 연락 여부 기록
- [ ] 접수 이벤트 타임라인 표시
- [ ] AppSheet 이관/확인 상태 표시

추천 상태값:

| 상태 | 의미 |
|---|---|
| `submitted` | 고객 신청 완료 |
| `contacted` | 회사가 고객에게 연락함 |
| `scheduled` | 실측 일정 잡힘 |
| `measured` | 실측 완료 |
| `quote_pending` | 견적 준비 중 |
| `quoted` | 견적 발행 완료 |
| `cancelled` | 취소 |

완료 기준:

- [ ] 관리자는 모든 신청을 볼 수 있다.
- [ ] 영업 매니저는 담당 신청만 볼 수 있다.
- [ ] 상태 변경 이력이 남는다.
- [ ] 고객 개인정보가 권한 없는 사용자에게 노출되지 않는다.

## 7. Phase 5 — MVP-04 담당자 배정

목표: 접수된 신청을 영업 매니저에게 배정하고, 담당자가 본인 고객을 끝까지 관리할 수 있게 한다.

상태: Planned

구현 항목:

- [ ] `assigned_manager_id` 정책 확정
- [ ] 관리자 담당자 배정 UI
- [ ] 담당자 변경 이력 기록
- [ ] 담당자별 접수 큐
- [ ] 미배정 신청 필터
- [ ] 담당자별 처리 상태 집계
- [ ] 담당자 배정 RLS 검증

완료 기준:

- [ ] 관리자가 신청에 담당자를 배정할 수 있다.
- [ ] 담당자는 배정된 신청만 볼 수 있다.
- [ ] 담당자 변경 이력이 남는다.

## 8. Phase 6 — MVP-05 견적 확인

목표: 고객이 플랫폼에서 견적을 확인하고, 회사는 견적 상태를 관리할 수 있게 한다.

상태: Later

선행 조건:

- [ ] 무료실측 신청 흐름 검증
- [ ] 담당자 배정 흐름 검증
- [ ] AppSheet와 견적 생성 역할 결정

구현 항목:

- [ ] 견적 DB 설계 보강
- [ ] `platform.quotes` 생성
- [ ] `platform.quote_items` 생성
- [ ] 견적 상태 이력 생성
- [ ] 관리자 견적 작성 UI
- [ ] 고객 견적 확인 UI
- [ ] 견적 승인/거절/수정 요청 정책 결정
- [ ] 견적 PDF 또는 공유 링크 필요 여부 결정

완료 기준:

- [ ] 고객이 로그인 후 본인 견적만 확인할 수 있다.
- [ ] 관리자는 견적을 발행하고 상태를 바꿀 수 있다.

## 9. Phase 7 — MVP-06 결제 연결

목표: 견적 확인 후 결제까지 플랫폼에서 이어지는 흐름을 만든다.

상태: Later

선행 조건:

- [ ] 견적 확인 플로우 검증
- [ ] 네이버 브랜드스토어와 토스페이먼츠 역할 결정
- [ ] 취소/환불/영수증/정산 운영 범위 결정

구현 항목:

- [ ] Toss Payments 도입 범위 결정
- [ ] 결제 승인 flow 설계
- [ ] 결제 실패/취소 flow 설계
- [ ] webhook 처리 설계
- [ ] `platform.payments` 생성
- [ ] `platform.payment_events` 생성
- [ ] 고객 결제 페이지
- [ ] 관리자 결제 상태 화면

완료 기준:

- [ ] 고객이 견적에서 결제까지 이어갈 수 있다.
- [ ] 결제 상태가 플랫폼 DB에 안정적으로 남는다.
- [ ] 실패/취소/환불 상태가 운영상 해석 가능하다.

## 10. Phase 8 — 출시 검증과 전환 실험

목표: 플랫폼 신청이 네이버예약 대비 실제 전환 가치가 있는지 검증한다.

상태: Later

검증 항목:

- [ ] 카카오톡 인앱 브라우저 로그인/신청 테스트
- [ ] 모바일 폼 작성 테스트
- [ ] 사진 업로드 속도/실패 테스트
- [ ] RLS 직접 호출 테스트
- [ ] 고객 개인정보 접근 테스트
- [ ] 관리자/매니저 role 접근 테스트
- [ ] 신청 완료 후 내부 처리 소요시간 측정
- [ ] 네이버예약 대비 신청 전환율 측정
- [ ] 이탈 지점 기록

완료 기준:

- [ ] 실제 고객 신청 1건 이상 처리
- [ ] 네이버예약과 병행 운영 가능
- [ ] 플랫폼 신청 전환을 높이기 위한 다음 실험 항목 도출

## 11. 금지 또는 후순위 기능

아래 기능은 플랫폼 목적과 맞지 않거나 MVP 흐름을 늦추므로 금지 또는 후순위다.

- [ ] 장바구니
- [ ] 쿠폰
- [ ] 포인트
- [ ] 회원 등급
- [ ] 자동 견적 엔진
- [ ] 리뷰/댓글
- [ ] 쇼핑몰식 상품 상세/옵션 장바구니
- [ ] 불필요한 랜딩페이지
- [ ] 무료실측 전환과 무관한 마케팅 장식 화면

## 12. 다음 오더 큐

| 오더 | 제목 | 상태 | 목적 |
|---|---|---|---|
| #052 | MVP-01 OAuth 로그인 기반 구축 | Ready | 고객 로그인/RBAC/profile 기반 |
| #053 | MVP-02 무료실측 신청 구현 | Planned | 실제 고객 신청 저장 |
| #054 | AppSheet 관계 결정 | Planned | 운영 이중입력 방지 |
| #055 | MVP-03 접수 확인 화면 | Planned | 관리자/매니저 업무 시작 |
| #056 | MVP-04 담당자 배정 | Planned | 담당제 운영 반영 |
| #057 | 견적 도메인 설계 | Later | 견적/결제 전 단계 |

## 13. 현재 미결정 사항

- [ ] Kakao + Google을 MVP-01에 동시에 붙일지
- [ ] Naver `custom:naver` OAuth를 언제 붙일지
- [ ] 무료실측 사진을 MVP-02 필수 입력으로 둘지
- [ ] AppSheet 연동을 MVP에서 수동/CSV/API 중 무엇으로 둘지
- [ ] 견적 생성 원장을 플랫폼으로 둘지 AppSheet로 둘지
- [ ] 결제는 네이버 브랜드스토어 유지 후 플랫폼에서 안내할지, 토스페이먼츠로 내부화할지

## 14. PM 체크 규칙

각 Phase 완료 전 PM은 아래를 확인한다.

- [ ] `docs/platform/PLATFORM_STRATEGY.md`와 충돌하지 않는가?
- [ ] 고객이 무료실측을 더 쉽게 신청하게 만드는가?
- [ ] 영업 매니저의 반복 업무가 줄어드는가?
- [ ] 대표가 운영 상태를 더 잘 보게 하는가?
- [ ] 고객 개인정보와 현장 사진이 보호되는가?
- [ ] 기존 V2 쇼룸 Public Experience가 깨지지 않는가?
- [ ] `PROJECT_TASKS.md`에 긴 작업 오더를 넣지 않고 `_order.md`에 분리했는가?
