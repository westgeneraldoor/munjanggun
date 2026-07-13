export type BlogHomeMediaSlot = {
  kind: 'image' | 'video'
  src: string
  poster?: string
  alt: string
  focalPoint?: string
}

const PLACEHOLDER = '/assets/blog-home/hero-sunlit-expansion.png'
const SHOWROOM_HERO = 'https://cebafroyvmllbyivevjd.supabase.co/storage/v1/object/public/showroom-images/hero/site_main/desktop/1779352118137__W_R_2.png'
const MIDDLE_DOOR = 'https://cebafroyvmllbyivevjd.supabase.co/storage/v1/object/public/showroom-images/nodes/middle-door/1779763376204_img-3.jpg'
const ABS_DOOR = 'https://cebafroyvmllbyivevjd.supabase.co/storage/v1/object/public/showroom-images/nodes/abs-door/1779764187631_img-abs.jpg'

// Replace only the src/poster values here when real field media is ready.
export const BLOG_HOME_MEDIA = {
  hero: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '햇빛이 드는 밝은 거실과 공간을 나누는 슬림 중문',
    focalPoint: '58% center',
  },
  condition: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '거실과 현관 사이의 공간 흐름을 보여주는 밝은 주거 공간',
    focalPoint: '58% center',
  },
  design: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '빛과 프레임 색이 어우러진 중문 디자인 장면',
    focalPoint: '66% center',
  },
  installation: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '시공을 마친 중문과 거실이 자연스럽게 이어지는 장면',
    focalPoint: '48% center',
  },
  consultation: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '가족이 다시 살펴보기 좋은 밝은 실내와 중문',
    focalPoint: '54% center',
  },
  topicInstall: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '햇빛이 드는 거실에 설치된 슬림 중문',
    focalPoint: '58% center',
  },
  topicNarrow: {
    kind: 'image',
    src: MIDDLE_DOOR,
    alt: '좁은 공간에도 어울리는 슬림 중문',
    focalPoint: 'center',
  },
  topicComfort: {
    kind: 'image',
    src: SHOWROOM_HERO,
    alt: '생활 공간을 나누는 문장군 중문',
    focalPoint: 'center',
  },
  topicLight: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '채광을 이어주는 유리 중문',
    focalPoint: '72% center',
  },
  topicDesign: {
    kind: 'image',
    src: ABS_DOOR,
    alt: '문장군 도어 디자인',
    focalPoint: 'center',
  },
  topicCase: {
    kind: 'image',
    src: SHOWROOM_HERO,
    alt: '완성된 문장군 중문 시공 공간',
    focalPoint: '62% center',
  },
  conditionComposer: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '우리 집 조건을 살펴보는 밝은 거실과 중문',
    focalPoint: '58% center',
  },
  finalConsultation: {
    kind: 'image',
    src: PLACEHOLDER,
    alt: '무료 방문실측 상담으로 이어지는 밝은 거실과 중문',
    focalPoint: '58% center',
  },
} satisfies Record<string, BlogHomeMediaSlot>
