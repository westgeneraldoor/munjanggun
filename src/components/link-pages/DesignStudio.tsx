'use client'

import {
  ArrowRight,
  Bell,
  Check,
  ChevronUp,
  Circle,
  Image as ImageIcon,
  Lock,
  MousePointerClick,
  Palette,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Square,
  SquareDashed,
  Unlock,
} from 'lucide-react'
import { ChangeEvent, ReactNode, useId, useRef, useState } from 'react'
import { saveAsset } from '@/lib/link-pages/asset-store'
import type { LinkPageTheme } from '@/lib/link-pages/model'
import { getDifferentThemeRecipe, LINK_PAGE_THEME_RECIPES, type LinkPageThemeRecipe } from '@/lib/link-pages/theme-recipes'
import styles from './DesignStudio.module.css'

type DesignStudioProps = {
  theme: LinkPageTheme
  onChange: (theme: LinkPageTheme) => void
  onAnnounce?: (message: string) => void
}

type Swatch = { label: string; value: string }

const BACKGROUND_SWATCHES: ReadonlyArray<Swatch> = [
  { label: '쇼룸', value: '#F7F7F4' },
  { label: '포레스트 미스트', value: '#E9F0EB' },
  { label: '웜 페이퍼', value: '#F4F4F1' },
  { label: '실버', value: '#EEEEEA' },
  { label: '잉크', value: '#10100F' },
  { label: '포레스트', value: '#274237' },
]

const BUTTON_SWATCHES: ReadonlyArray<Swatch> = [
  { label: '잉크', value: '#171717' },
  { label: '소프트 잉크', value: '#30302D' },
  { label: '딥 포레스트', value: '#274237' },
  { label: '포레스트', value: '#3D5B4B' },
  { label: '화이트', value: '#FFFFFF' },
  { label: '페이퍼', value: '#F7F7F4' },
]

const SHAPES: ReadonlyArray<{ value: LinkPageTheme['buttonShape']; label: string }> = [
  { value: 'tidy', label: '단정하게' },
  { value: 'soft', label: '부드럽게' },
  { value: 'pill', label: '둥글게' },
]

const ACTIONS: ReadonlyArray<{ value: LinkPageTheme['buttonAction']; label: string; icon: ReactNode }> = [
  { value: 'none', label: '없음', icon: <Circle aria-hidden="true" /> },
  { value: 'lift', label: '떠오름', icon: <ChevronUp aria-hidden="true" /> },
  { value: 'press', label: '눌림', icon: <MousePointerClick aria-hidden="true" /> },
  { value: 'arrow', label: '화살표', icon: <ArrowRight aria-hidden="true" /> },
  { value: 'outline', label: '윤곽', icon: <SquareDashed aria-hidden="true" /> },
]

const TYPOGRAPHY: ReadonlyArray<{ value: LinkPageTheme['typographyPreset']; label: string; detail: string }> = [
  { value: 'editorial', label: '에디토리얼', detail: '둥근 제목 · 단정한 본문' },
  { value: 'clean', label: '클린', detail: '또렷한 프리텐다드' },
  { value: 'compact', label: '컴팩트', detail: '촘촘한 정보 위계' },
]

const MENUS: ReadonlyArray<{ value: LinkPageTheme['topMenuStyle']; label: string }> = [
  { value: 'light', label: '라이트' },
  { value: 'ink', label: '잉크' },
  { value: 'minimal', label: '미니멀' },
]

function cloneTheme(theme: LinkPageTheme): LinkPageTheme {
  return {
    ...theme,
    backgroundImage: theme.backgroundImage ? { ...theme.backgroundImage } : undefined,
    logo: theme.logo ? { ...theme.logo } : undefined,
  }
}

function normalizeHex(value: string) {
  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null
}

function luminance(hex: string) {
  const normalized = normalizeHex(hex) ?? '#000000'
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function readableForeground(background: string) {
  return contrastRatio('#171717', background) >= contrastRatio('#FFFFFF', background) ? '#171717' : '#FFFFFF'
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function SwatchPicker({ legend, value, swatches, onChange }: { legend: string; value: string; swatches: ReadonlyArray<Swatch>; onChange: (value: string) => void }) {
  return (
    <fieldset className={styles.resetFieldset}>
      <legend className={styles.srOnly}>{legend}</legend>
      <div className={styles.swatchGrid}>
        {swatches.map((swatch) => {
          const selected = swatch.value.toUpperCase() === value.toUpperCase()
          return (
            <button
              key={swatch.value}
              type="button"
              className={styles.swatchTile}
              aria-pressed={selected}
              onClick={() => onChange(swatch.value)}
            >
              <span className={styles.swatchColor} style={{ '--design-swatch': swatch.value } as React.CSSProperties}>
                {selected ? <Check aria-hidden="true" /> : null}
              </span>
              <span>{swatch.label}</span>
              <small>{swatch.value}</small>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ColorEditor({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const commitTextValue = (target: HTMLInputElement) => {
    const next = normalizeHex(target.value)
    if (next) onChange(next)
    else target.value = value.toUpperCase()
  }

  return (
    <div className={styles.colorEditor}>
      <label htmlFor={`${id}-picker`}>{label}</label>
      <input id={`${id}-picker`} type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <input
        key={value}
        id={`${id}-hex`}
        type="text"
        defaultValue={value.toUpperCase()}
        inputMode="text"
        maxLength={7}
        aria-label={`${label} HEX 값`}
        onBlur={(event) => commitTextValue(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}

export function DesignStudio({ theme, onChange, onAnnounce }: DesignStudioProps) {
  const backgroundUploadId = useId()
  const logoUploadId = useId()
  const liveRegionId = useId()
  const [backgroundLocked, setBackgroundLocked] = useState(false)
  const [undoTheme, setUndoTheme] = useState<LinkPageTheme | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const lastRecipeId = useRef<string | null>(theme.recipeId ?? null)

  const announce = (message: string) => {
    setLiveMessage(message)
    onAnnounce?.(message)
  }

  const updateTheme = (patch: Partial<LinkPageTheme>, message: string, clearRecipe = true) => {
    setUndoTheme(null)
    onChange({ ...theme, ...patch, recipeId: clearRecipe ? undefined : theme.recipeId })
    announce(message)
  }

  const applyRecipe = (recipe: LinkPageThemeRecipe) => {
    setUndoTheme(cloneTheme(theme))
    const nextTheme: LinkPageTheme = {
      ...theme,
      ...recipe.theme,
      recipeId: recipe.id,
    }

    if (backgroundLocked) {
      nextTheme.backgroundColor = theme.backgroundColor
      nextTheme.backgroundImage = theme.backgroundImage
      nextTheme.backgroundImageUrl = theme.backgroundImageUrl
      nextTheme.textColor = theme.textColor
    } else {
      nextTheme.backgroundImage = undefined
      nextTheme.backgroundImageUrl = undefined
    }

    lastRecipeId.current = recipe.id
    onChange(nextTheme)
    announce(`${recipe.label} 추천 테마를 적용했습니다.`)
  }

  const applyDifferentRecipe = () => {
    applyRecipe(getDifferentThemeRecipe(theme.recipeId ?? lastRecipeId.current))
  }

  const undoRecommendation = () => {
    if (!undoTheme) return
    const previousTheme = cloneTheme(undoTheme)
    setUndoTheme(null)
    lastRecipeId.current = previousTheme.recipeId ?? null
    onChange(previousTheme)
    announce('추천 테마 적용 전 디자인으로 되돌렸습니다.')
  }

  const changeBackground = (backgroundColor: string) => {
    updateTheme(
      {
        backgroundColor,
        backgroundImage: undefined,
        backgroundImageUrl: undefined,
        textColor: readableForeground(backgroundColor),
      },
      `배경을 ${backgroundColor} 색상으로 변경했습니다.`,
    )
  }

  const changeButton = (buttonColor: string) => {
    updateTheme(
      { buttonColor, buttonTextColor: readableForeground(buttonColor) },
      `버튼을 ${buttonColor} 색상으로 변경했습니다.`,
    )
  }

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, target: 'background' | 'logo') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const asset = await saveAsset(file)
      if (target === 'background') {
        updateTheme({ backgroundImage: asset, backgroundImageUrl: undefined }, `${file.name} 배경 이미지를 적용했습니다.`)
      } else {
        updateTheme({ logoMode: 'custom', logo: asset, logoUrl: undefined }, `${file.name} 로고를 적용했습니다.`, false)
      }
    } catch {
      announce(`${target === 'background' ? '배경 이미지' : '로고'}를 저장하지 못했습니다.`)
    }
  }

  const activeRecipe = LINK_PAGE_THEME_RECIPES.find((recipe) => recipe.id === theme.recipeId)
  const pageContrast = contrastRatio(theme.textColor, theme.backgroundColor)
  const buttonContrast = contrastRatio(theme.buttonTextColor, theme.buttonColor)

  return (
    <div className={styles.studio} aria-describedby={liveRegionId}>
      <header className={styles.studioHeader}>
        <div className={styles.titleGroup}>
          <Palette aria-hidden="true" />
          <div>
            <h2>페이지 디자인</h2>
            <p>문장군 쇼룸에 맞는 디자인을 고르고 바로 미리보세요.</p>
          </div>
        </div>
        <button type="button" aria-label="추천 테마 적용" className={styles.recommendButton} onClick={applyDifferentRecipe}>
          <Sparkles aria-hidden="true" /> 추천 디자인 만들기
        </button>
      </header>

      <Section title="추천 테마" description={activeRecipe ? `${activeRecipe.label} · ${activeRecipe.description}` : '검수된 여섯 가지 조합에서 추천합니다.'}>
        <div className={styles.recommendationRow}>
          <button type="button" className={styles.secondaryButton} onClick={applyDifferentRecipe}>
            <Sparkles aria-hidden="true" /> 다른 추천
          </button>
          <button type="button" aria-label="이전 테마로 되돌리기" className={styles.secondaryButton} disabled={!undoTheme} onClick={undoRecommendation}>
            <RotateCcw aria-hidden="true" /> 되돌리기
          </button>
        </div>
      </Section>

      <Section
        title="배경"
        description={backgroundLocked ? '추천 테마를 바꿔도 현재 배경을 유지합니다.' : '추천 테마가 배경까지 함께 바꿉니다.'}
        action={
          <label
            className={styles.lockButton}
          >
            <input type="checkbox" aria-label="배경 잠금" checked={backgroundLocked} onChange={(event) => {
              const next = event.target.checked
              setBackgroundLocked(next)
              announce(next ? '추천 테마에서 배경을 잠갔습니다.' : '배경 잠금을 해제했습니다.')
            }} />
            {backgroundLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
            {backgroundLocked ? '잠금됨' : '배경 잠금'}
          </label>
        }
      >
        <SwatchPicker legend="배경 프리셋" value={theme.backgroundColor} swatches={BACKGROUND_SWATCHES} onChange={changeBackground} />
        <div className={styles.inlineControls}>
          <ColorEditor id="page-background" label="직접 선택" value={theme.backgroundColor} onChange={changeBackground} />
          <label className={styles.uploadTile} htmlFor={backgroundUploadId}>
            <ImageIcon aria-hidden="true" />
            <span>{theme.backgroundImage?.name ?? '사진 업로드'}</span>
            <small>JPG, PNG, WebP</small>
            <input id={backgroundUploadId} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event, 'background')} />
          </label>
        </div>
      </Section>

      <Section title="버튼 색상" description="버튼 글자색은 대비가 높은 색으로 자동 선택됩니다.">
        <SwatchPicker legend="버튼 색상 프리셋" value={theme.buttonColor} swatches={BUTTON_SWATCHES} onChange={changeButton} />
        <ColorEditor id="page-button" label="직접 선택" value={theme.buttonColor} onChange={changeButton} />
        <fieldset className={styles.choiceFieldset}>
          <legend>색상 적용 범위</legend>
          <div className={styles.radioRow}>
            {([
              ['highlighted', '이 블록만'],
              ['all', '전체 블록'],
            ] as const).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="design-button-scope"
                  value={value}
                  checked={theme.buttonScope === value}
                  onChange={() => updateTheme({ buttonScope: value }, `${label}에 버튼 색상을 적용합니다.`)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="버튼 모양">
        <div className={styles.shapeGrid} role="group" aria-label="버튼 모양">
          {SHAPES.map((shape) => (
            <button
              key={shape.value}
              type="button"
              aria-pressed={theme.buttonShape === shape.value}
              onClick={() => updateTheme({ buttonShape: shape.value }, `버튼 모양을 ${shape.label}로 변경했습니다.`)}
            >
              <span className={styles[`shape_${shape.value}`]} />
              {shape.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="버튼 액션" description="움직임 줄이기 설정에서는 이동 효과가 자동으로 사라집니다.">
        <div className={styles.actionGrid} role="group" aria-label="버튼 액션">
          {ACTIONS.map((action) => (
            <button
              key={action.value}
              type="button"
              aria-pressed={theme.buttonAction === action.value}
              onClick={() => updateTheme({ buttonAction: action.value }, `버튼 액션을 ${action.label}으로 변경했습니다.`)}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="타이포그래피">
        <div className={styles.typeGrid} role="group" aria-label="타이포그래피">
          {TYPOGRAPHY.map((option) => (
            <button
              key={option.value}
              type="button"
              data-type={option.value}
              aria-pressed={theme.typographyPreset === option.value}
              onClick={() => updateTheme({ typographyPreset: option.value }, `${option.label} 타이포그래피를 적용했습니다.`)}
            >
              <b>안녕하세요!</b>
              <span>{option.label}</span>
              <small>{option.detail}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="상단 메뉴"
        description={theme.showNavigation ? '공개 페이지에 네비게이션 페이지 메뉴를 표시합니다.' : '이 페이지에서는 상단 메뉴를 숨깁니다.'}
        action={
          <label className={styles.menuVisibility}>
            <input
              type="checkbox"
              aria-label="상단 메뉴 표시"
              checked={theme.showNavigation}
              onChange={(event) => updateTheme(
                { showNavigation: event.target.checked },
                event.target.checked ? '이 페이지의 상단 메뉴를 표시합니다.' : '이 페이지의 상단 메뉴를 숨겼습니다.',
                false,
              )}
            />
            <span aria-hidden="true" />
            <b>상단 메뉴 표시</b>
          </label>
        }
      >
        <div className={styles.menuGrid} role="group" aria-label="상단 메뉴 스타일">
          {MENUS.map((menu) => (
            <button
              key={menu.value}
              type="button"
              data-menu={menu.value}
              aria-pressed={theme.topMenuStyle === menu.value}
              onClick={() => updateTheme({ topMenuStyle: menu.value }, `${menu.label} 상단 메뉴를 적용했습니다.`)}
            >
              <span className={styles.menuPreview}><i /><i /><i /></span>
              {menu.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="공유 및 구독" description="공개 페이지 상단에 필요한 동작만 표시합니다.">
        <div className={styles.toggleGrid}>
          <button
            type="button"
            aria-pressed={theme.showShare}
            onClick={() => updateTheme({ showShare: !theme.showShare }, theme.showShare ? '공유 버튼을 숨겼습니다.' : '공유 버튼을 표시합니다.', false)}
          >
            <Share2 aria-hidden="true" />
            <span><b>공유 버튼</b><small>{theme.showShare ? '표시 중' : '숨김'}</small></span>
            <Check aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={theme.showSubscribe}
            onClick={() => updateTheme({ showSubscribe: !theme.showSubscribe }, theme.showSubscribe ? '구독 버튼을 숨겼습니다.' : '구독 버튼을 표시합니다.', false)}
          >
            <Bell aria-hidden="true" />
            <span><b>구독 버튼</b><small>{theme.showSubscribe ? '표시 중' : '숨김'}</small></span>
            <Check aria-hidden="true" />
          </button>
        </div>
      </Section>

      <Section title="로고">
        <fieldset className={styles.resetFieldset}>
          <legend className={styles.srOnly}>로고 표시 방식</legend>
          <div className={styles.logoGrid}>
            {([
              ['default', '문장군 로고'],
              ['custom', '내 로고'],
              ['hidden', '로고 숨김'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme.logoMode === value}
                onClick={() => updateTheme({ logoMode: value }, `${label}를 선택했습니다.`, false)}
              >
                {value === 'hidden' ? <SquareDashed aria-hidden="true" /> : value === 'custom' ? <ImageIcon aria-hidden="true" /> : <Square aria-hidden="true" />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {theme.logoMode === 'custom' ? (
          <label className={styles.logoUpload} htmlFor={logoUploadId}>
            <ImageIcon aria-hidden="true" />
            <span>{theme.logo?.name ?? '로고 이미지 선택'}</span>
            <small>배경이 투명한 PNG 또는 WebP 권장</small>
            <input id={logoUploadId} type="file" accept="image/png,image/webp,image/svg+xml" onChange={(event) => void uploadImage(event, 'logo')} />
          </label>
        ) : null}
      </Section>

      <aside className={styles.contrastStatus} aria-label="접근성 대비 확인">
        <ShieldCheck aria-hidden="true" />
        <div>
          <b>접근성 대비</b>
          <span>본문 {pageContrast.toFixed(2)}:1 · 버튼 {buttonContrast.toFixed(2)}:1</span>
        </div>
        <strong data-pass={pageContrast >= 4.5 && buttonContrast >= 4.5}>{pageContrast >= 4.5 && buttonContrast >= 4.5 ? 'AA 통과' : '조정 필요'}</strong>
      </aside>

      <p id={liveRegionId} className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </div>
  )
}
