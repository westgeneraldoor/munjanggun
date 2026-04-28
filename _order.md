# 작업지시서 #018 — 🔴 V2 Phase 2-1: 어드민 노드 목록 + CRUD
📅 발행: 2026-04-28 13:03
🤖 추천 모델: Claude Sonnet
⏱️ 예상 시간: ~40분

## 환경 확인 (필수)
- GEMINI.md 읽고 코딩 규칙 + 브랜치 전략 확인 → **v2-cms 브랜치에서 작업**
- `docs/DESIGN_SYSTEM.md` 읽고 어드민 토큰 + 컴포넌트 규칙 확인
- Supabase 프로젝트 ID: `cebafroyvmllbyivevjd`
- showroom 스키마에 25개 노드 + 126개 갤러리가 이미 존재

## 배경
Phase 1에서 DB 기반이 완성되었다. 이제 관리자가 노드 트리를 관리할 수 있는 어드민 CMS를 구축한다.
이 오더에서는 **노드 목록 + 기본 CRUD + 정렬**을 구현한다.
노드 편집 상세 폼(히어로/갤러리)은 다음 오더에서 구현.

---

## 작업 내용

### Step 1: 어드민 사이드바 업데이트

`src/components/admin/AdminSidebar.tsx`의 navItems에 "노드 관리" 추가:

```typescript
const navItems = [
  { name: '노드 관리', path: '/admin/nodes', icon: FolderTree },  // 🆕
  { name: '컬렉션 관리', path: '/admin/collections', icon: Package },  // V1 유지
  { name: '사이트 설정', path: '/admin/settings', icon: Settings },
]
```

- `FolderTree`를 lucide-react에서 import
- V1 "컬렉션 관리"는 삭제하지 않고 유지 (V1 호환)

### Step 2: /admin 리다이렉트

`src/app/admin/page.tsx`를 수정하여 `/admin/nodes`로 리다이렉트:

```typescript
import { redirect } from 'next/navigation'
export default function AdminPage() {
  redirect('/admin/nodes')
}
```

### Step 3: 노드 목록 페이지 — `src/app/admin/nodes/page.tsx`

기존 placeholder를 실제 구현으로 교체. 이 페이지가 V2 어드민의 핵심.

**UI 구조:**
```
┌──────────────────────────────────────┐
│ 📂 노드 관리                    [+ 탭 추가] │
├──────────────────────────────────────┤
│ [탭1] [탭2] [탭3] [탭4]              │  ← 최상위 노드(listing) 탭
├──────────────────────────────────────┤
│ 탭1의 자식 노드 목록:                 │
│ ┌──────────────────────────────┐    │
│ │ 🟢 올리브그린  [detail] ↕ ✏️ 🗑  │    │  ← 자식 노드 행
│ │ 🟢 로얄블루    [detail] ↕ ✏️ 🗑  │    │
│ │ 🔴 시트러스    [draft]  ↕ ✏️ 🗑  │    │
│ └──────────────────────────────┘    │
│                          [+ 노드 추가] │
└──────────────────────────────────────┘
```

**기능 요구사항:**
1. **탭 표시:** 최상위 노드(parent_id IS NULL)를 탭으로 표시, display_order순
2. **자식 목록:** 선택된 탭의 자식 노드를 리스트로 표시
3. **각 행 정보:** 이름, 타입 뱃지(listing/detail), 상태 뱃지(published/draft), 이미지 썸네일(있으면)
4. **정렬 버튼:** 위/아래 화살표로 display_order 변경 (드래그앤드롭 대신 화살표 버튼 — 구현 단순)
5. **상태 토글:** 클릭으로 draft ↔ published 전환
6. **삭제 버튼:** ConfirmModal 사용하여 확인 후 삭제 (CASCADE로 자식도 삭제됨)
7. **탭 추가:** 최상위 listing 노드 추가 (이름, slug 입력 모달)
8. **자식 추가:** 선택된 탭 아래에 자식 노드 추가 (이름, slug, 타입 선택 모달)
9. **편집 버튼:** `/admin/nodes/[id]`로 이동 (상세 편집은 다음 오더)

**데이터 쿼리 패턴 (showroom 클라이언트 사용):**
```typescript
import { createShowroomClient } from '@/lib/supabase/client'

// 최상위 노드 (탭)
const { data: tabs } = await supabase
  .from('nodes')
  .select('*')
  .is('parent_id', null)
  .order('display_order')

// 선택된 탭의 자식
const { data: children } = await supabase
  .from('nodes')
  .select('*')
  .eq('parent_id', selectedTabId)
  .order('display_order')
```

### Step 4: 추가 모달 컴포넌트 — `src/components/admin/NodeAddModal.tsx` 🆕

간단한 모달 폼:
- 이름 (필수)
- slug (이름에서 자동 생성, 수정 가능)
- 타입 선택 (listing / detail) — 탭 추가 시에는 listing 고정
- 확인/취소 버튼

**slug 자동 생성 규칙:**
- 한글은 그대로 사용 가능 (encodeURIComponent는 라우팅에서 처리)
- 공백 → 하이픈(-) 변환
- 소문자 변환
- 특수문자 제거

### Step 5: 노드 목록 컴포넌트 — `src/components/admin/NodeList.tsx` 🆕

'use client' 컴포넌트. V1의 CollectionList.tsx 패턴을 참조하되 showroom 스키마 사용.

**핵심 기능:**
- `createShowroomClient()` 사용
- 노드 CRUD: insert, update, delete
- 정렬 변경: display_order swap
- 상태 토글: status update
- 모든 mutation 후 목록 refetch
- 로딩/에러 상태 표시

### Step 6: CSS 스타일

`src/components/admin/NodeList.module.css` 🆕 생성:
- 어드민 라이트 토큰 사용 (`var(--admin-*)`)
- V1 CollectionList/ColorList의 스타일 패턴 참조
- 탭 바, 노드 행, 뱃지, 액션 버튼 스타일
- 모바일 반응형

`src/components/admin/NodeAddModal.module.css` 🆕 생성:
- V1 ConfirmModal 스타일 참조

---

## 대상 파일
- `src/components/admin/AdminSidebar.tsx` — navItems에 노드관리 추가
- `src/app/admin/page.tsx` — /admin/nodes 리다이렉트
- `src/app/admin/nodes/page.tsx` — placeholder → 실제 구현
- `src/components/admin/NodeList.tsx` — 🆕 핵심 컴포넌트
- `src/components/admin/NodeList.module.css` — 🆕
- `src/components/admin/NodeAddModal.tsx` — 🆕
- `src/components/admin/NodeAddModal.module.css` — 🆕

## 참고 파일 (읽기만 — V1 패턴 참조)
- `src/components/admin/CollectionList.tsx` — CRUD + 정렬 패턴 참조
- `src/components/admin/ColorList.tsx` — 자식 목록 패턴 참조
- `src/components/admin/ConfirmModal.tsx` — 삭제 확인 모달 재사용
- `src/components/admin/StatusBadge.tsx` — 상태 뱃지 재사용
- `src/components/admin/AdminSidebar.module.css` — 사이드바 스타일 참조
- `docs/DESIGN_SYSTEM.md` — 어드민 토큰 (`--admin-*`)
- `src/types/database.ts` — showroom.nodes 타입

## 핵심 규칙
- **어드민 = 라이트 토큰** (`var(--admin-*)`) — 다크 토큰 혼용 금지
- `any` 타입 금지 — `Database['showroom']['Tables']['nodes']['Row']` 등 사용
- `console.log` / `console.error` 금지 → `logError()` 사용
- 컬러 하드코딩 금지 → CSS 변수 사용
- V1 컴포넌트(ConfirmModal, StatusBadge) 재사용 가능
- 간격: 4px 배수 (`--space-N`)

## ⚠️ 금지
- V1 컴포넌트(CollectionList, ColorList, CollectionForm, ColorForm) 수정 금지
- V1 라우트(/admin/collections) 수정 금지
- globals.css 수정 금지
- 고객 페이지 파일 수정 금지
- colorbook 스키마 접근 금지 — showroom만 사용
- 드래그앤드롭 라이브러리 설치 금지 — 화살표 버튼으로 정렬

## 완료 기준
- [ ] `/admin` 접속 시 `/admin/nodes`로 리다이렉트
- [ ] 사이드바에 "노드 관리" 메뉴 표시 + 활성 상태 하이라이트
- [ ] 최상위 노드 4개가 탭으로 표시됨
- [ ] 탭 클릭 시 해당 탭의 자식 노드 목록 표시
- [ ] 각 노드 행에 이름, 타입뱃지, 상태뱃지 표시
- [ ] 탭 추가 기능 동작 (이름, slug 입력 → DB 저장)
- [ ] 자식 노드 추가 기능 동작
- [ ] 삭제 기능 동작 (ConfirmModal 확인 후)
- [ ] 정렬 변경 동작 (화살표 버튼)
- [ ] 상태 토글 동작 (draft ↔ published)
- [ ] 편집 버튼 클릭 → /admin/nodes/[id]로 이동
- [ ] `npm run build` 에러 없이 통과
- [ ] `npm run lint` 에러 0건 (V1 기존 제외)
- [ ] 어드민 라이트 토큰만 사용 확인

---
## 작업 결과 (작업자가 작성)
- 수정 파일: `src/components/admin/AdminSidebar.tsx`, `src/app/admin/page.tsx`, `src/app/admin/nodes/page.tsx`, `src/lib/supabase/client.ts`
- 새로 생성한 파일: `src/components/admin/NodeList.tsx`, `src/components/admin/NodeList.module.css`, `src/components/admin/NodeAddModal.tsx`, `src/components/admin/NodeAddModal.module.css`
- 변경 요약: 
  - 사이드바에 "노드 관리" 메뉴 추가 및 `/admin` 리다이렉트를 `/admin/nodes`로 변경
  - `NodeList` 컴포넌트를 통해 최상위 노드를 탭으로, 자식 노드를 목록으로 표시
  - CRUD 기능(정렬, 상태 토글, 삭제) 구현 및 `NodeAddModal`에서 탭/자식 추가 구현(slug 자동 변환)
  - 타입 안정성을 위해 `createShowroomClient` 개선 및 쿼리에 `.schema('showroom')` 명시
- 자체 확인: 
  - `npm run lint` 0 errors
  - `npm run build` 성공 (Exit code: 0)
  - Admin 라이트 토큰(`var(--admin-*)`) 적용 완료
