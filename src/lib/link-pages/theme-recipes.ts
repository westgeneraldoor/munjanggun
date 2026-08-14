import type { LinkPageTheme } from './model'

export type LinkPageThemeRecipe = {
  id: string
  label: string
  description: string
  theme: Pick<
    LinkPageTheme,
    | 'backgroundColor'
    | 'surfaceColor'
    | 'textColor'
    | 'buttonColor'
    | 'buttonTextColor'
    | 'buttonScope'
    | 'buttonShape'
    | 'buttonAction'
    | 'typographyPreset'
    | 'topMenuStyle'
  >
}

export const LINK_PAGE_THEME_RECIPES = [
  {
    id: 'editorial-white',
    label: '에디토리얼 화이트',
    description: '밝은 쇼룸 배경과 단정한 잉크 버튼',
    theme: {
      backgroundColor: '#F7F7F4',
      surfaceColor: '#FFFFFF',
      textColor: '#171717',
      buttonColor: '#171717',
      buttonTextColor: '#FFFFFF',
      buttonScope: 'all',
      buttonShape: 'soft',
      buttonAction: 'arrow',
      typographyPreset: 'editorial',
      topMenuStyle: 'light',
    },
  },
  {
    id: 'forest-mist',
    label: '포레스트 미스트',
    description: '차분한 녹색 배경과 둥근 포레스트 버튼',
    theme: {
      backgroundColor: '#E9F0EB',
      surfaceColor: '#FFFFFF',
      textColor: '#274237',
      buttonColor: '#274237',
      buttonTextColor: '#FFFFFF',
      buttonScope: 'all',
      buttonShape: 'pill',
      buttonAction: 'lift',
      typographyPreset: 'clean',
      topMenuStyle: 'minimal',
    },
  },
  {
    id: 'paper-studio',
    label: '페이퍼 스튜디오',
    description: '종이 질감의 중립 배경과 조용한 동작',
    theme: {
      backgroundColor: '#F4F4F1',
      surfaceColor: '#EEEEEA',
      textColor: '#30302D',
      buttonColor: '#30302D',
      buttonTextColor: '#FFFFFF',
      buttonScope: 'all',
      buttonShape: 'tidy',
      buttonAction: 'none',
      typographyPreset: 'editorial',
      topMenuStyle: 'minimal',
    },
  },
  {
    id: 'silver-showroom',
    label: '실버 쇼룸',
    description: '은은한 회색 바탕과 포레스트 포인트',
    theme: {
      backgroundColor: '#EEEEEA',
      surfaceColor: '#FFFFFF',
      textColor: '#30302D',
      buttonColor: '#3D5B4B',
      buttonTextColor: '#FFFFFF',
      buttonScope: 'all',
      buttonShape: 'soft',
      buttonAction: 'outline',
      typographyPreset: 'clean',
      topMenuStyle: 'light',
    },
  },
  {
    id: 'ink-gallery',
    label: '잉크 갤러리',
    description: '사진과 콘텐츠를 또렷하게 세우는 다크 테마',
    theme: {
      backgroundColor: '#10100F',
      surfaceColor: '#20201F',
      textColor: '#FFFFFF',
      buttonColor: '#FFFFFF',
      buttonTextColor: '#171717',
      buttonScope: 'all',
      buttonShape: 'tidy',
      buttonAction: 'arrow',
      typographyPreset: 'editorial',
      topMenuStyle: 'ink',
    },
  },
  {
    id: 'forest-night',
    label: '포레스트 나이트',
    description: '깊은 포레스트 배경과 선명한 흰 버튼',
    theme: {
      backgroundColor: '#274237',
      surfaceColor: '#30302D',
      textColor: '#FFFFFF',
      buttonColor: '#FFFFFF',
      buttonTextColor: '#171717',
      buttonScope: 'all',
      buttonShape: 'pill',
      buttonAction: 'lift',
      typographyPreset: 'clean',
      topMenuStyle: 'ink',
    },
  },
] as const satisfies ReadonlyArray<LinkPageThemeRecipe>

export function getDifferentThemeRecipe(currentRecipeId?: string | null) {
  const candidates = LINK_PAGE_THEME_RECIPES.filter((recipe) => recipe.id !== currentRecipeId)
  const randomValue = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
  return candidates[randomValue % candidates.length]
}
