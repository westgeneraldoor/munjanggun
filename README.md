# 문장군 디지털 컬러북 (Munjanggun Digital Colorbook)

영업사원이 카카오톡 링크 하나로 전송하는, 현장 컬러북의 한계를 넘어서는 **프리미엄 디지털 쇼룸**입니다. 중문 필름 컬러의 고화질 텍스처와 실제 시공 사례를 몰입감 있게 제공하여 고객의 최종 결정을 돕습니다.

---

## 🌟 주요 특징

### 📱 고객 경험 (Customer Facing)
- **몰입형 상세 페이지**: 뷰포트를 가득 채우는 고화질 텍스처와 매거진 스타일의 시공 갤러리.
- **프리미엄 애니메이션**: Intersection Observer를 활용한 부드러운 스크롤 페이드인/슬라이드 업 효과.
- **카카오톡 최적화**: 컬러별 동적 OG(Open Graph) 적용으로 공유 시 미리보기 이미지 자동 생성 및 인앱 브라우저 완벽 호환(`100dvh` 적용).
- **원클릭 액션**: 하단 고정 CTA 바를 통한 실측 예약 및 브랜드스토어 즉시 연결.

### 🛠 관리자 도구 (Admin CMS)
- **콘텐츠 관리**: 개발자 도움 없이 직접 컬렉션과 컬러 정보를 추가, 수정, 삭제 가능.
- **이미지 파이프라인**: Supabase Storage 연동 및 드래그앤드롭 기반의 시공 사진 업로드 및 순서 재정렬.
- **미리보기 워크플로우**: 공개 전 토큰 기반 미리보기 URL을 생성하여 팀원과 공유 및 검토 가능.
- **사이트 설정**: OG 이미지, 예약 링크, 스토어 주소 등 사이트 전역 설정을 대시보드에서 관리.

---

## 🛠 기술 스택

- **Frontend**: Next.js 16 (App Router), TypeScript (Strict), Lucide React
- **Styling**: Vanilla CSS (디자인 토큰 기반 CSS Variables)
- **Backend/DB**: Supabase (PostgreSQL, Storage, Auth)
- **Deployment**: Vercel
- **Optimization**: Intersection Observer API (애니메이션), Metadata API (동적 OG), Next/Image (이미지 최적화)

---

## 🏗 프로젝트 구조

```text
munjanggun/
├── src/
│   ├── app/            # Next.js App Router (페이지, 라우팅, 글로벌 스타일)
│   ├── components/     # 고객(customer)/어드민(admin) 분리된 재사용 컴포넌트
│   ├── lib/            # Supabase 클라이언트, 유틸리티, 로거
│   └── types/          # 데이터베이스 및 전역 타입 정의
├── docs/               # PRD, 디자인 시스템 등 설계 문서
└── public/             # 정적 에셋
```

---

## 🚀 시작하기

### 1. 환경 변수 설정
`.env.local` 파일을 생성하고 아래 정보를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=your_deployment_url
```

### 2. 의존성 설치 및 실행
```bash
npm install
npm run dev
```

---

## 🎨 디자인 원칙
- **Dark Minimal Gallery**: 프리미엄 가구 갤러리 느낌의 어두운 테마와 절제된 폰트 사용.
- **High Contrast**: WCAG AA 접근성 기준 준수 (대비비 4.5:1 이상).
- **Responsive**: 모바일 퍼스트 디자인 및 다양한 디바이스 해상도 대응.

---

## 📄 라이선스
본 프로젝트는 **문장군(Munjanggun)**의 내부 자산으로, 허가되지 않은 복제 및 배포를 금지합니다.
