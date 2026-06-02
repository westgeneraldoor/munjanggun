---
document_type: "Platform Task Board"
version: "1.0.0"
status: "active"
last_updated: "2026-05-30"
owner: "Codex PM"
source_strategy: "docs/platform/PLATFORM_STRATEGY.md"
source_prd: "docs/platform/PRD_PLATFORM_v1.0.md"
source_db_rbac: "docs/platform/PLATFORM_DB_RBAC_DESIGN.md"
source_development_strategy: "docs/platform/DEVELOPMENT_STRATEGY.md"
---

# PLATFORM_TASKS — 문장군 플랫폼 MVP

## 0. 이 문서의 역할

이 문서는 문장군 플랫폼 제작 일정의 기준 문서다.

`PROJECT_TASKS.md`는 기존 V2 쇼룸 구현 히스토리와 전체 상태 보드로 유지한다. 플랫폼 개발의 실제 페이즈, 오더 순서, 완료 기준은 이 파일을 우선한다.

문서 우선순위:

1. `docs/platform/PLATFORM_STRATEGY.md`
2. `docs/platform/PLATFORM_TASKS.md`
3. `docs/platform/DEVELOPMENT_STRATEGY.md`
4. `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
5. `docs/platform/PRD_PLATFORM_v1.0.md`
6. `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
7. `docs/platform/DECISION_LOG.md`
8. `docs/platform/BRAND_CONTEXT.md`
9. `_order.md`
10. `_context.md`

핵심 원칙:

- 플랫폼은 쇼핑몰이 아니라 고객 여정 통합 포털이다.
- 기존 V2 쇼룸은 Public Experience로 유지한다.
- 문서만 오래 만들지 않는다. 로그인 이후 무료방문견적 신청 화면까지 빠르게 간다.
- 고객 개인정보, 현장 사진, role 권한은 MVP라도 대충 만들지 않는다.
- AppSheet 관계 결정은 운영 이중입력을 막기 위한 필수 운영 결정이다.

## 1. 현재 크리티컬 패스

```text
MVP-01 카카오 로그인
→ MVP-02 무료방문견적 신청 + 어드민 접수 큐
→ MVP-03 담당자 배정 + 접수 상태 관리
→ MVP-04 견적서 작성 + 견적 링크 발송
→ MVP-05 견적 승인 + 결제 전 설문 + 토스페이먼츠 결제
→ MVP-06 결제/견적/시공 이력 대시보드
→ MVP-07 AS 접수
→ MVP-08 시공완료 후기/사진/홍보동의 큐
```

현재 즉시 실행 순서:

| 순서 | 작업 | 상태 | 비고 |
|---|---|---|---|
| 1 | MVP-01 카카오 로그인 기반 구축 | DB Applied | Kakao/Supabase Auth 외부 설정 및 실제 로그인 테스트 필요 |
| 2 | MVP-02 무료방문견적 신청 + 어드민 접수 큐 | Next | 고객 신청과 운영 확인을 한 세트로 구현 |
| 3 | MVP-03 담당자 배정 + 접수 상태 관리 | Planned | 접수 처리와 AppSheet 수동 등록 지원 |
| 4 | MVP-04 견적서 작성 + 견적 링크 발송 | Planned | 영업 담당자가 고객에게 보낼 견적 생성 |
| 5 | MVP-05 견적 승인 + 결제 전 설문 + 토스 결제 | Planned | 인스타 유입 고객의 플랫폼 결제 완결 |

## 1.1 이번 대화에서 확정된 제품 결정

| 항목 | 결정 |
|---|---|
| MVP-01 로그인 | 카카오만 구현 |
| Google/Naver 로그인 | Google 확장 시점에 Naver 간편로그인도 함께 검토 |
| 고객 필수 정보 | 이름, 휴대폰 번호 필수 |
| 무료방문견적 신청 | 로그인 필수 |
| AS 접수 | 로그인 필수 |
| 신청 사진/영상 | 선택사항. 단, 사진 여러 장 동시 선택과 동영상 첨부를 지원 |
| 결제 | 토스페이먼츠 사용 |
| 결제 전 설문 | 필수 2문항 이상, 버튼 선택 + 직접입력 |
| 설문 관리 | 어드민에서 질문/선택지 추가, 삭제, 정식 버튼 승격 가능 |
| 견적 원장 | 플랫폼 어드민에서 영업 담당자가 생성 |
| AppSheet | MVP에서는 수동 등록. 장기적으로 연동/흡수 검토 |
| 어드민 | 실제 운영 엔진. 모바일/데스크탑 모두 반응형 필수 |

## 1.2 어드민이 진짜다

플랫폼 고객뷰는 신청, 견적 확인, 결제를 쉽게 만드는 입구다.

하지만 문장군 플랫폼의 실무 중심은 어드민이다. 어드민이 불편하면 고객 신청이 들어와도 AppSheet 수동 등록, 담당자 배정, 견적 발송, 결제 확인, 후기 요청이 운영으로 이어지지 않는다.

따라서 MVP-02부터 고객 기능과 어드민 운영 큐를 한 세트로 만든다.

어드민 공통 기준:

- [ ] 모바일과 데스크탑 모두 반응형으로 사용 가능
- [ ] 관리부/영업부가 AppSheet 수동 등록에 필요한 정보를 한 화면에서 확인
- [ ] 접수, 담당자, 견적, 결제, AS, 후기 요청을 큐 형태로 관리
- [ ] 리스트에서 다음 행동이 명확해야 함
- [ ] 고객 입력 정보와 파일을 복사/확인하기 쉬워야 함
- [ ] 직접입력 응답을 운영자가 정식 선택지로 승격할 수 있어야 함

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
- [x] `_order.md` #052 MVP-01 카카오 로그인 오더 작성
- [x] 플랫폼 문서와 기존 쇼룸/아카이브 문서 폴더 분리
- [x] 플랫폼 전용 태스크 보드 작성

완료 기준:

- [x] 다음 에이전트가 `docs/platform/PLATFORM_TASKS.md`만 읽어도 전체 플랫폼 일정 순서를 이해할 수 있다.
- [x] 신규 플랫폼 기능 판단 기준이 쇼룸 PRD가 아니라 플랫폼 전략/태스크/DB 설계로 이동했다.

## 3. Phase 1 — MVP-01 카카오 로그인 기반

목표: 고객이 플랫폼에 로그인하고, `customer` role profile이 안전하게 생성되는 기반을 만든다.

상태: DB Applied / OAuth Test Pending

작업 오더:

- `_order.md` #052

구현 항목:

- [x] Next.js App Router/route handler/proxy 관련 현재 버전 문서 확인
- [x] Supabase Auth/Kakao Login/RLS 공식 문서 확인
- [x] `platform` schema 생성 migration 작성
- [x] `platform_private` schema 생성 migration 작성
- [x] `platform.profile_role` enum 생성
- [x] `platform.profiles` 테이블 생성
- [x] `platform.staff_profiles` 테이블 생성
- [x] 카카오 최초 로그인 시 profile 자동 생성 trigger 작성
- [x] `platform_private.current_role()` 작성
- [x] `platform_private.is_admin()` 작성
- [x] `platform_private.is_sales_manager()` 작성
- [x] `profiles` RLS enable
- [x] 고객 본인 profile 조회 policy 작성
- [x] 고객 role 자체 변경 금지 policy 작성
- [x] 관리자 전체 profile 조회/수정 policy 작성
- [x] `src/types/database.ts` platform 타입 추가 또는 재생성
- [x] `src/lib/supabase/platform-server.ts` 추가
- [x] `src/lib/supabase/platform-client.ts` 추가
- [x] `src/app/auth/callback/route.ts` 추가
- [x] `src/app/login/page.tsx` 추가
- [x] `src/app/login/login.module.css` 추가
- [x] `src/app/portal/page.tsx` placeholder 추가
- [x] `src/app/portal/portal.module.css` 추가
- [x] `src/proxy.ts`에서 `/portal` 보호 추가
- [x] 기존 `/admin` auth guard 회귀 없음 확인
- [x] Supabase MCP로 `20260602015936_platform_auth_foundation` migration 적용
- [x] Supabase MCP로 `20260602020113_harden_platform_auth_policies` migration 적용
- [x] 신규 `platform` 관련 security/performance advisor 경고 해소

완료 기준:

- [ ] Kakao OAuth 로그인 흐름이 동작한다.
- [ ] 로그인 사용자는 `platform.profiles.role = customer`로 생성된다.
- [x] 비로그인 사용자는 `/portal`에 접근할 수 없다.
- [ ] 고객 profile에 이름과 휴대폰 번호를 필수로 확보한다.
- [x] 고객은 role을 클라이언트에서 바꿀 수 없다.
- [x] 기존 쇼룸 고객 페이지와 `/admin` CMS가 깨지지 않는다.
- [x] `npm run lint` 통과
- [x] `npm run build` 통과

주의:

- Google과 Naver 간편로그인은 MVP-01 블로커가 아니다.
- Naver 간편로그인은 Google 확장 시점에 함께 검토한다.
- 고객 role 판단에 `user_metadata`를 사용하지 않는다.
- 쇼룸의 `showroom` schema와 플랫폼의 `platform` schema를 섞지 않는다.
- `platform` 스키마가 Supabase Dashboard > API Settings > Exposed schemas에 포함되어야 브라우저 클라이언트 조회가 가능하다.

## 4. Phase 2 — MVP-02 무료방문견적 신청 + 어드민 접수 큐

목표: 실제 고객이 플랫폼에서 무료방문견적 상담을 신청하고, 회사가 어드민에서 즉시 접수를 확인해 AppSheet 수동 등록까지 이어갈 수 있게 한다.

상태: Planned

오더 작성 조건:

- [ ] Phase 1 완료
- [ ] `platform.profiles`와 로그인 세션 흐름 확인
- [ ] 고객 현장 사진/영상 private storage 정책 재확인

구현 항목:

- [ ] `platform.measurement_requests` migration 작성
- [ ] `platform.measurement_media` migration 작성
- [ ] `platform.measurement_request_events` migration 작성
- [ ] `measurement-media` private bucket 생성 정책 결정
- [ ] 고객 신청 생성 server action 또는 route handler 작성
- [ ] 고객 신청 폼 UI 작성
- [ ] 필수 필드: 이름
- [ ] 필수 필드: 전화번호
- [ ] 필수 필드: 주소
- [ ] 필수 필드: 제품 관심 카테고리
- [ ] 선택 필드: 상세주소
- [ ] 선택 필드: 희망 일정
- [ ] 선택 필드: 현장 사진 여러 장 동시 업로드
- [ ] 선택 필드: 현장 동영상 업로드
- [ ] 업로드 미리보기, 삭제, 재선택 UI
- [ ] 개인정보 수집 동의 UI 작성
- [ ] 신청 완료 화면 작성
- [ ] `/portal`에서 내 신청 목록 조회
- [ ] `/portal`에서 내 신청 상세 조회
- [ ] 고객은 본인 신청만 조회 가능하도록 RLS 검증
- [ ] 신청 생성 이벤트 기록
- [ ] 쇼룸 CTA에서 무료방문견적 신청으로 연결할 위치 결정
- [ ] 어드민 신규 접수 큐 화면 작성
- [ ] 어드민 접수 상세 화면 작성
- [ ] AppSheet 수동 등록에 필요한 핵심 정보 복사/확인 UI
- [ ] 접수 상태: `submitted`, `appsheet_pending`, `appsheet_registered`

완료 기준:

- [ ] 실제 고객 플로우로 무료방문견적 신청 row가 생성된다.
- [ ] 고객은 본인 신청만 볼 수 있다.
- [ ] 사진/영상은 public URL로 노출되지 않는다.
- [ ] 신청 완료 후 회사가 어드민 접수 큐에서 즉시 확인할 수 있다.
- [ ] 관리부/영업부가 AppSheet에 수동 등록할 수 있을 만큼 정보가 정리되어 있다.
- [ ] 모바일에서 폼이 막힘 없이 작성된다.
- [ ] 어드민 접수 큐도 모바일/데스크탑 반응형으로 동작한다.
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과

주의:

- 이 단계의 목표는 완벽한 운영 OS가 아니라 첫 신청이 실제로 들어오는 것이다.
- 네이버예약을 즉시 제거하지 않는다. 플랫폼 신청 CTA를 먼저 검증한다.
- 고객 신청만 만들고 어드민 확인 화면을 빼면 실제 운영 테스트가 불가능하므로 MVP-02에 어드민 접수 큐를 포함한다.

## 5. Phase 3 — MVP-03 담당자 배정 + 접수 상태 관리

목표: 접수된 신청을 영업 담당자에게 배정하고, 접수/연락/AppSheet 등록/실측 일정 상태를 관리한다.

상태: Planned

구현 항목:

- [ ] 관리자 담당자 배정 UI
- [ ] 담당자별 접수 큐
- [ ] 미배정 신청 필터
- [ ] 접수 상태 변경
- [ ] 고객 연락 여부 기록
- [ ] 실측 예정일 입력
- [ ] 시공 예정일 후보 입력
- [ ] 상담 메모 작성
- [ ] AppSheet 수동 등록 상태 관리
- [ ] 접수 이벤트 타임라인 표시
- [ ] 담당자 배정 RLS 검증

상태값:

| 상태 | 의미 |
|---|---|
| `submitted` | 고객 신청 완료 |
| `appsheet_pending` | AppSheet 등록 대기 |
| `appsheet_registered` | AppSheet 수동 등록 완료 |
| `contacted` | 회사가 고객에게 연락함 |
| `scheduled` | 실측 일정 잡힘 |
| `measured` | 실측 완료 |
| `quote_pending` | 견적 준비 중 |
| `cancelled` | 취소 |

완료 기준:

- [ ] 관리자는 모든 신청을 볼 수 있다.
- [ ] 영업 매니저는 담당 신청을 볼 수 있다.
- [ ] AppSheet 수동 등록 여부가 어드민에서 보인다.
- [ ] 상태 변경 이력이 남는다.
- [ ] 고객 개인정보가 권한 없는 사용자에게 노출되지 않는다.

## 6. Phase 4 — MVP-04 견적서 작성 + 견적 링크 발송

목표: 영업 담당자가 어드민에서 템플릿 기반 견적서를 만들고 고객에게 링크로 보낼 수 있게 한다.

상태: Planned

구현 항목:

- [ ] `platform.quote_categories` 생성
- [ ] `platform.quote_item_templates` 생성
- [ ] `platform.quotes` 생성
- [ ] `platform.quote_items` 생성
- [ ] 대분류/소분류 템플릿 관리 UI
- [ ] 견적 대분류 선택
- [ ] 견적 소분류 선택
- [ ] 단가, 수량, 합계 입력/계산
- [ ] 추가 설명 입력
- [ ] 유효기간 입력
- [ ] 담당자 정보 표시
- [ ] 실측일/시공예정일 입력. 시공일은 변경 가능 상태로 둔다.
- [ ] 고객 견적 링크 생성
- [ ] 링크 복사/발송 상태 기록
- [ ] 견적 발송 대시보드

견적 항목 기본 구조:

| 항목 | 설명 |
|---|---|
| 견적 대분류 | 예: 중문, ABS도어, 현관문 |
| 소분류 | 예: 3연동, 문짝교체, 문틀세트 |
| 단가 | 담당자가 조정 가능 |
| 수량 | 담당자가 입력 |
| 합계 | 단가 x 수량 |
| 추가 설명 | 현장 조건, 추가금, 안내사항 |

완료 기준:

- [ ] 담당자가 템플릿에서 항목을 추가/삭제해 견적서를 빠르게 만들 수 있다.
- [ ] 고객은 견적 링크에서 본인 견적을 모바일/데스크탑 모두 보기 좋게 확인한다.
- [ ] 견적 링크 발송/열람 상태가 어드민에 남는다.
- [ ] 자동견적/복잡한 옵션 계산기는 만들지 않는다.

## 7. Phase 5 — MVP-05 견적 승인 + 결제 전 설문 + 토스페이먼츠 결제

목표: 인스타 유입 고객이 플랫폼 안에서 견적을 승인하고, 결제 전 짧은 설문을 완료한 뒤 토스페이먼츠로 결제한다.

상태: Planned

구현 항목:

- [ ] 견적 승인 버튼
- [ ] 결제 전 설문 화면
- [ ] 설문 질문 관리 UI
- [ ] 설문 선택지 관리 UI
- [ ] 선택지 직접입력 지원
- [ ] 직접입력 응답을 정식 선택지로 승격하는 어드민 기능
- [ ] 기본 질문: 문장군을 선택한 이유
- [ ] 기본 질문: 문장군을 알게 된 경로
- [ ] 토스페이먼츠 결제 연동
- [ ] 일반영수증/현금영수증/지출증빙 선택 UX 검토
- [ ] 결제 성공/실패/취소 상태 저장
- [ ] 관리자 결제 상태 화면
- [ ] 견적→결제 전환율 확인

완료 기준:

- [ ] 고객이 견적 승인 후 결제까지 완료할 수 있다.
- [ ] 설문 응답이 결제 전 고객 의도 데이터로 남는다.
- [ ] 직접입력 응답이 어드민에서 확인된다.
- [ ] 결제 상태가 플랫폼 DB에 안정적으로 남는다.

## 8. Phase 6 — MVP-06 결제/견적/시공 이력 대시보드

목표: 어드민이 견적 발송, 열람, 승인, 결제, 시공 예정 상태를 한눈에 보고 관리한다.

상태: Later

구현 항목:

- [ ] 견적 발송 대기/발송 완료 큐
- [ ] 견적 열람 여부
- [ ] 승인 여부
- [ ] 결제 대기/완료/실패
- [ ] 영수증/증빙 상태
- [ ] 시공 예정일
- [ ] 담당자별 견적/결제 현황
- [ ] 고객별 시공 이력 기초 화면

완료 기준:

- [ ] 어드민에서 결제 전후 병목을 확인할 수 있다.
- [ ] 고객 이력이 견적/결제/시공 예정 흐름으로 남는다.

## 9. Phase 7 — MVP-07 AS 접수

목표: 로그인 고객이 AS를 접수하고, 어드민에서 AS 처리 큐로 관리한다.

상태: Later

구현 항목:

- [ ] AS 접수 로그인 필수
- [ ] 기존 시공 이력 연결
- [ ] AS 접수 폼
- [ ] AS 사진/영상 첨부
- [ ] 어드민 AS 접수 큐
- [ ] AS 상태 관리
- [ ] 하단 플로팅 CTA에서 브랜드스토어 대신 AS접수 전환 검토

완료 기준:

- [ ] 고객이 로그인 후 AS를 접수할 수 있다.
- [ ] 어드민에서 AS 접수와 상태를 관리할 수 있다.
- [ ] 고객에게 플랫폼이 결제 후에도 남는 이유가 생긴다.

## 10. Phase 8 — MVP-08 시공완료 후기/사진/홍보동의 큐

목표: 결제/시공 이후 고객으로부터 시공 완료 사진, 짧은 후기, 홍보 활용 동의를 자연스럽게 받아 문장군 자산으로 쌓는다.

상태: Later

구현 항목:

- [ ] 후기 요청 대상 큐
- [ ] 요청 보냄/미발송/작성완료 상태
- [ ] 후기 요청 링크 생성
- [ ] 링크 토큰으로 후기 작성 가능
- [ ] 민감한 시공/결제 내역은 로그인 후 표시 안내
- [ ] 고객 완료 사진 업로드
- [ ] 고객 후기 작성
- [ ] 홍보 활용 동의 UI
- [ ] 동의/미동의 상태 관리
- [ ] n8n 자동화 전환을 위한 이벤트 기록

완료 기준:

- [ ] 관리부/영업부가 후기 요청 대상 고객을 리스트로 확인할 수 있다.
- [ ] 고객이 링크로 후기와 사진을 남길 수 있다.
- [ ] 홍보 활용 동의가 명시적으로 남는다.

## 11. Phase 9 — MVP-09 n8n 운영 자동화 연결

목표: 플랫폼의 핵심 원장은 유지하면서, 반복 알림/후속 요청을 n8n으로 자동화한다.

상태: Later

구현 항목:

- [ ] 후기 요청 대기 고객 알림
- [ ] 후기 미응답 리마인드
- [ ] 결제 완료 후 내부 알림
- [ ] 시공 예정/완료 이벤트 후속 알림
- [ ] 관리부/영업부에게 할 일 알림
- [ ] Webhook 호출 이력과 실패 로그

원칙:

- n8n은 자동화 비서다.
- 로그인, 결제 원장, 견적 원장, 개인정보 권한 판단은 플랫폼 DB와 서버가 담당한다.

## 12. Phase 10 — MVP-10 AppSheet 연동/흡수 전략

목표: MVP에서는 수동 등록을 유지하되, 장기적으로 AppSheet의 방대한 운영 데이터와 플랫폼을 어떻게 연결할지 전략을 세운다.

상태: Later

현실:

- AppSheet는 문장군 사내 운영 ERP다.
- 테이블, 봇, 액션, 레퍼런스, 뷰 규모가 커서 MVP에서 직접 병합하지 않는다.
- 이번 프로젝트의 장기 끝판왕은 AppSheet 연동 또는 단계적 흡수다.

검토 항목:

- [ ] AppSheet 핵심 테이블 목록 파악
- [ ] 접수/실측/견적/시공/정산 중 연결 우선순위 결정
- [ ] API 연동 가능성 검토
- [ ] CSV export/import 가능성 검토
- [ ] 플랫폼 원장과 AppSheet 원장 경계 정의
- [ ] 단계별 마이그레이션 전략 작성

## 13. 금지 또는 후순위 기능

아래 기능은 플랫폼 목적과 맞지 않거나 MVP 흐름을 늦추므로 금지 또는 후순위다.

- [ ] 장바구니
- [ ] 쿠폰
- [ ] 포인트
- [ ] 회원 등급
- [ ] 자동 견적 엔진
- [ ] 공개 커뮤니티형 리뷰/댓글
- [ ] 쇼핑몰식 상품 상세/옵션 장바구니
- [ ] 불필요한 랜딩페이지
- [ ] 무료방문견적 전환과 무관한 마케팅 장식 화면

## 14. 다음 오더 큐

| 오더 | 제목 | 상태 | 목적 |
|---|---|---|---|
| #052 | MVP-01 카카오 로그인 기반 구축 | Ready | 고객 로그인/RBAC/profile 기반 |
| #053 | MVP-02 무료방문견적 신청 + 어드민 접수 큐 | Planned | 실제 고객 신청과 운영 확인 |
| #054 | MVP-03 담당자 배정 + 접수 상태 관리 | Planned | 담당제 운영과 AppSheet 수동 등록 지원 |
| #055 | MVP-04 견적서 작성 + 견적 링크 발송 | Planned | 템플릿 기반 견적 생성 |
| #056 | MVP-05 견적 승인 + 설문 + 토스 결제 | Planned | 플랫폼 결제 완결 |
| #057 | MVP-06 결제/견적/시공 이력 대시보드 | Later | 운영 병목 확인 |
| #058 | MVP-07 AS 접수 | Later | 결제 후 플랫폼 잔존 이유 |
| #059 | MVP-08 후기/사진/홍보동의 큐 | Later | 콘텐츠/재접촉 자산 축적 |

## 15. 현재 미결정 사항

- [ ] 결제 전 설문 기본 선택지 최종 문구
- [ ] AS 접수 하단 CTA 문구와 위치
- [ ] 후기 요청 링크 발송 주체: 영업 담당자 / 관리부 / n8n 자동화
- [ ] 홍보 활용 동의를 자연스럽게 받는 문구와 타이밍
- [ ] AppSheet 연동/흡수의 장기 우선순위

## 16. PM 체크 규칙

각 Phase 완료 전 PM은 아래를 확인한다.

- [ ] `docs/platform/PLATFORM_STRATEGY.md`와 충돌하지 않는가?
- [ ] 고객이 무료방문견적을 더 쉽게 신청하게 만드는가?
- [ ] 영업 매니저의 반복 업무가 줄어드는가?
- [ ] 대표가 운영 상태를 더 잘 보게 하는가?
- [ ] 고객 개인정보와 현장 사진이 보호되는가?
- [ ] 기존 V2 쇼룸 Public Experience가 깨지지 않는가?
- [ ] `PROJECT_TASKS.md`에 긴 작업 오더를 넣지 않고 `_order.md`에 분리했는가?
