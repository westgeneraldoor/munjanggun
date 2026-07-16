'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Save } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import {
  PlatformButton,
  PlatformField,
  PlatformIconButton,
  PlatformLinkButton,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSegmentedControl,
  PlatformStatePanel,
  PlatformStatusBadge,
} from '@/components/platform/ui'
import { logError } from '@/lib/logger'
import styles from './settings.module.css'

interface CategoryItem {
  id: string
  key: string
  label: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

interface BookingSettings {
  min_days_out: number
  max_days_out: number
  close_saturday: boolean
  close_sunday: boolean
  close_holidays: boolean
}

interface DateOverride {
  date: string
  is_closed: boolean
  memo: string | null
  source?: 'manual' | 'holiday'
}

type Feedback = {
  tone: 'error' | 'success'
  title: string
  description?: string
}

const SETTINGS_TABS = [
  { value: 'categories', label: '견적 품목 관리' },
  { value: 'schedule', label: '방문일 운영 설정' },
] as const

const OVERRIDE_STATUS_ITEMS = [
  { value: 'closed', label: '예약 불가' },
  { value: 'open', label: '예약 가능' },
] as const

function makeInternalKey(label: string) {
  const ascii = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${ascii || 'category'}_${Date.now().toString(36)}`
}

function safeFileName(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`.replace(/[^a-z0-9.\-_]/g, '')
}

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'categories' | 'schedule'>('categories')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [newCatFile, setNewCatFile] = useState<File | null>(null)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatLabel, setEditCatLabel] = useState('')
  const [editCatDesc, setEditCatDesc] = useState('')
  const [editCatFile, setEditCatFile] = useState<File | null>(null)
  const [categorySaving, setCategorySaving] = useState(false)
  const newFileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  const [settings, setSettings] = useState<BookingSettings>({
    min_days_out: 2,
    max_days_out: 30,
    close_saturday: true,
    close_sunday: true,
    close_holidays: true,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [newOverrideDate, setNewOverrideDate] = useState('')
  const [newOverrideClosed, setNewOverrideClosed] = useState(true)
  const [newOverrideMemo, setNewOverrideMemo] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setLoadError('')
        const [categoryResult, settingsResult, overrideResult] = await Promise.all([
          supabase.from('measurement_product_categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('measurement_booking_settings').select('*').eq('id', 1).single(),
          supabase.from('measurement_date_overrides').select('*').order('date', { ascending: true }),
        ])

        const loadFailure = categoryResult.error ?? settingsResult.error ?? overrideResult.error
        if (loadFailure) throw loadFailure

        setCategories((categoryResult.data ?? []) as CategoryItem[])
        if (settingsResult.data) setSettings(settingsResult.data as BookingSettings)
        setOverrides((overrideResult.data ?? []) as DateOverride[])
      } catch (err) {
        logError('Error loading admin settings data', err)
        setLoadError('네트워크 또는 권한 상태를 확인한 뒤 다시 시도해 주세요.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const uploadCategoryImage = async (file: File) => {
    const path = `categories/${safeFileName(file)}`
    const { data, error } = await supabase.storage
      .from('platform-category-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) throw error

    return supabase.storage.from('platform-category-images').getPublicUrl(data.path).data.publicUrl
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatLabel.trim()) return
    setCategorySaving(true)
    setFeedback(null)

    try {
      const imageUrl = newCatFile ? await uploadCategoryImage(newCatFile) : null
      const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 10 : 10
      const { data, error } = await supabase
        .from('measurement_product_categories')
        .insert({
          key: makeInternalKey(newCatLabel),
          label: newCatLabel.trim(),
          description: newCatDesc.trim() || null,
          image_url: imageUrl,
          sort_order: nextOrder,
          is_active: true,
        })
        .select('*')
        .single()

      if (error) {
        setFeedback({ tone: 'error', title: '품목을 추가하지 못했습니다.', description: error.message })
        return
      }

      if (data) setCategories(prev => [...prev, data as CategoryItem])
      setNewCatLabel('')
      setNewCatDesc('')
      setNewCatFile(null)
      if (newFileRef.current) newFileRef.current.value = ''
      setFeedback({ tone: 'success', title: '견적 품목을 추가했습니다.' })
    } catch (err) {
      logError('Category add unexpected error', err)
      setFeedback({ tone: 'error', title: '품목 추가 중 오류가 발생했습니다.' })
    } finally {
      setCategorySaving(false)
    }
  }

  const handleStartEditCategory = (cat: CategoryItem) => {
    setEditingCatId(cat.id)
    setEditCatLabel(cat.label)
    setEditCatDesc(cat.description || '')
    setEditCatFile(null)
    if (editFileRef.current) editFileRef.current.value = ''
  }

  const handleSaveEditCategory = async (cat: CategoryItem) => {
    if (!editCatLabel.trim()) return
    setCategorySaving(true)
    setFeedback(null)

    try {
      const imageUrl = editCatFile ? await uploadCategoryImage(editCatFile) : cat.image_url
      const { error } = await supabase
        .from('measurement_product_categories')
        .update({
          label: editCatLabel.trim(),
          description: editCatDesc.trim() || null,
          image_url: imageUrl,
        })
        .eq('id', cat.id)

      if (error) {
        setFeedback({ tone: 'error', title: '품목을 수정하지 못했습니다.' })
        return
      }

      setCategories(prev => prev.map(item =>
        item.id === cat.id
          ? { ...item, label: editCatLabel.trim(), description: editCatDesc.trim() || null, image_url: imageUrl }
          : item
      ))
      setEditingCatId(null)
      setEditCatFile(null)
      setFeedback({ tone: 'success', title: '품목 정보를 저장했습니다.' })
    } catch (err) {
      logError('Edit category save error', err)
      setFeedback({ tone: 'error', title: '품목 수정 중 오류가 발생했습니다.' })
    } finally {
      setCategorySaving(false)
    }
  }

  const handleToggleCatActive = async (id: string, currentActive: boolean) => {
    setFeedback(null)
    const { error } = await supabase
      .from('measurement_product_categories')
      .update({ is_active: !currentActive })
      .eq('id', id)

    if (error) {
      setFeedback({ tone: 'error', title: '노출 상태를 변경하지 못했습니다.' })
      return
    }

    setCategories(prev => prev.map(c => (c.id === id ? { ...c, is_active: !currentActive } : c)))
    setFeedback({ tone: 'success', title: currentActive ? '품목을 숨겼습니다.' : '품목을 노출했습니다.' })
  }

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return

    const current = categories[index]
    const target = categories[targetIndex]
    const updated = [...categories]
    updated[index] = { ...target, sort_order: current.sort_order }
    updated[targetIndex] = { ...current, sort_order: target.sort_order }
    setCategories(updated)

    await supabase.from('measurement_product_categories').update({ sort_order: target.sort_order }).eq('id', current.id)
    await supabase.from('measurement_product_categories').update({ sort_order: current.sort_order }).eq('id', target.id)
  }

  const handleDeactivateCategory = async (id: string) => {
    if (!confirm('이미 접수된 신청 내역 보존을 위해 삭제 대신 숨김 처리합니다. 진행할까요?')) return
    await handleToggleCatActive(id, true)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (settings.min_days_out < 0 || settings.max_days_out < settings.min_days_out) {
      setFeedback({ tone: 'error', title: '예약 가능일 범위를 확인해 주세요.' })
      return
    }

    setSettingsSaving(true)
    setFeedback(null)
    try {
      const { error } = await supabase
        .from('measurement_booking_settings')
        .update(settings)
        .eq('id', 1)

      if (error) setFeedback({ tone: 'error', title: '예약 설정을 저장하지 못했습니다.', description: error.message })
      else setFeedback({ tone: 'success', title: '예약 기본 설정을 저장했습니다.' })
    } catch (err) {
      logError('Save booking settings error', err)
      setFeedback({ tone: 'error', title: '예약 설정 저장 중 오류가 발생했습니다.' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOverrideDate) return

    setOverrideSubmitting(true)
    setFeedback(null)
    try {
      const nextOverride: DateOverride = {
        date: newOverrideDate,
        is_closed: newOverrideClosed,
        memo: newOverrideMemo.trim() || null,
        source: 'manual',
      }
      const { error } = await supabase.from('measurement_date_overrides').upsert(nextOverride)

      if (error) {
        setFeedback({ tone: 'error', title: '예외 일정을 반영하지 못했습니다.', description: error.message })
        return
      }

      setOverrides(prev => [...prev.filter(o => o.date !== newOverrideDate), nextOverride].sort((a, b) => a.date.localeCompare(b.date)))
      setNewOverrideDate('')
      setNewOverrideMemo('')
      setFeedback({ tone: 'success', title: '예외 일정을 반영했습니다.' })
    } catch (err) {
      logError('Add override error', err)
      setFeedback({ tone: 'error', title: '예외 일정 처리 중 오류가 발생했습니다.' })
    } finally {
      setOverrideSubmitting(false)
    }
  }

  const handleDeleteOverride = async (dateStr: string) => {
    if (!confirm(`${dateStr} 예외 설정을 삭제할까요?`)) return
    const { error } = await supabase.from('measurement_date_overrides').delete().eq('date', dateStr)
    if (error) {
      setFeedback({ tone: 'error', title: '예외 일정을 삭제하지 못했습니다.' })
      return
    }
    setOverrides(prev => prev.filter(o => o.date !== dateStr))
    setFeedback({ tone: 'success', title: '예외 일정을 삭제했습니다.' })
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <PlatformStatePanel
          tone="loading"
          title="설정 데이터를 불러오는 중입니다."
          description="견적 품목과 방문 가능일을 확인하고 있습니다."
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PlatformPageHeader
        title="견적 접수 운영설정"
        description="무료방문 실측견적 신청에 노출될 품목과 방문 가능일을 관리합니다."
        actions={<PlatformLinkButton href="/admin/platform" variant="secondary">접수 큐 목록</PlatformLinkButton>}
      />

      <PlatformSegmentedControl
        label="견적 운영설정 구분"
        items={SETTINGS_TABS}
        value={activeTab}
        onChange={setActiveTab}
        className={styles.primaryTabs}
      />

      {loadError ? (
        <PlatformStatePanel tone="error" title="설정 데이터를 불러오지 못했습니다." description={loadError} />
      ) : null}
      {feedback ? (
        <PlatformStatePanel tone={feedback.tone} title={feedback.title} description={feedback.description} />
      ) : null}

      {!loadError ? <div className={styles.content}>
        {activeTab === 'categories' && (
          <div className={styles.panel}>
            <PlatformPanel as="section" className={styles.sectionLayout}>
              <h2 className={styles.sectionTitle}>새 품목 추가</h2>
              <form onSubmit={handleAddCategory} className={styles.categoryForm}>
                <PlatformField id="cat-label" label="품목명" required value={newCatLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCatLabel(e.target.value)} placeholder="예: 3연동중문" />
                <PlatformField id="cat-desc" label="품목설명" multiline value={newCatDesc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewCatDesc(e.target.value)} placeholder="고객에게 보여줄 짧은 설명" rows={3} />
                <div className={styles.fileField}>
                  <label className={styles.fieldLabel} htmlFor="new-category-image">품목이미지</label>
                  <PlatformButton type="button" variant="secondary" onClick={() => newFileRef.current?.click()}>
                    <ImagePlus size={16} strokeWidth={1.8} />
                    이미지 선택
                  </PlatformButton>
                  <input id="new-category-image" ref={newFileRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.srOnly} onChange={e => setNewCatFile(e.target.files?.[0] ?? null)} />
                  {newCatFile && <span className={styles.fileName} role="status" aria-live="polite">{newCatFile.name}</span>}
                </div>
                <PlatformButton type="submit" isLoading={categorySaving} loadingLabel="품목 추가 중…" className={styles.formAction}>
                  품목 추가
                </PlatformButton>
              </form>
            </PlatformPanel>

            <PlatformPanel as="section" className={styles.sectionLayout}>
              <h2 className={styles.sectionTitle}>품목 목록</h2>
              {categories.length === 0 ? (
                <PlatformStatePanel tone="empty" title="등록된 견적 품목이 없습니다." description="위 양식에서 첫 품목을 추가해 주세요." />
              ) : <ul className={styles.categoryList}>
                {categories.map((cat, idx) => {
                  const isEditing = editingCatId === cat.id
                  return (
                    <li key={cat.id} className={styles.categoryCard}>
                      <div className={styles.categoryImage}>
                        {cat.image_url ? (
                          <Image src={cat.image_url} alt={`${cat.label} 품목 이미지`} width={96} height={96} unoptimized />
                        ) : (
                          <span className={styles.categoryImageEmpty}>이미지 없음</span>
                        )}
                      </div>

                      <div className={styles.categoryBody}>
                        {isEditing ? (
                          <>
                            <PlatformField label="품목명 수정" value={editCatLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCatLabel(e.target.value)} />
                            <PlatformField label="품목설명 수정" multiline value={editCatDesc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditCatDesc(e.target.value)} rows={3} />
                            <label className={styles.fieldLabel} htmlFor={`edit-category-image-${cat.id}`}>품목이미지 변경</label>
                            <PlatformButton type="button" variant="secondary" onClick={() => editFileRef.current?.click()}>
                              <ImagePlus size={16} strokeWidth={1.8} />
                              이미지 변경
                            </PlatformButton>
                            <input id={`edit-category-image-${cat.id}`} ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.srOnly} onChange={e => setEditCatFile(e.target.files?.[0] ?? null)} />
                            {editCatFile && <span className={styles.fileName} role="status" aria-live="polite">{editCatFile.name}</span>}
                          </>
                        ) : (
                          <>
                            <div className={styles.categoryTitleRow}>
                              <strong>{cat.label}</strong>
                              <PlatformStatusBadge tone={cat.is_active ? 'success' : 'neutral'}>
                                {cat.is_active ? '노출 중' : '비노출'}
                              </PlatformStatusBadge>
                            </div>
                            <p>{cat.description || '품목설명이 없습니다.'}</p>
                          </>
                        )}
                      </div>

                      <div className={styles.categoryActions}>
                        <PlatformIconButton type="button" onClick={() => handleMoveCategory(idx, 'up')} disabled={idx === 0} aria-label="위로 이동">
                          <ArrowUp size={16} />
                        </PlatformIconButton>
                        <PlatformIconButton type="button" onClick={() => handleMoveCategory(idx, 'down')} disabled={idx === categories.length - 1} aria-label="아래로 이동">
                          <ArrowDown size={16} />
                        </PlatformIconButton>
                        {isEditing ? (
                          <PlatformButton type="button" variant="secondary" onClick={() => handleSaveEditCategory(cat)} isLoading={categorySaving} loadingLabel="저장 중…">
                            <Save size={15} />
                            저장
                          </PlatformButton>
                        ) : (
                          <PlatformButton type="button" variant="secondary" onClick={() => handleStartEditCategory(cat)}>
                            <Pencil size={15} />
                            수정
                          </PlatformButton>
                        )}
                        <PlatformButton type="button" variant="secondary" onClick={() => cat.is_active ? handleDeactivateCategory(cat.id) : handleToggleCatActive(cat.id, false)}>
                          {cat.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                          {cat.is_active ? '숨김' : '노출'}
                        </PlatformButton>
                      </div>
                    </li>
                  )
                })}
              </ul>}
            </PlatformPanel>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className={styles.panel}>
            <PlatformPanel as="section" className={styles.sectionLayout}>
              <h2 className={styles.sectionTitle}>방문 실측 예약 기본 규칙</h2>
              <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
                <div className={styles.settingsGrid}>
                  <PlatformField id="min-days" type="number" min={0} required label="최소 접수 가능일" hint="예: 2로 설정하면 모레부터 신청 가능" value={settings.min_days_out} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, min_days_out: parseInt(e.target.value) || 0 }))} />
                  <PlatformField id="max-days" type="number" min={1} required label="최대 예약 가능일" hint="예: 30으로 설정하면 30일 이내 날짜만 접수" value={settings.max_days_out} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, max_days_out: parseInt(e.target.value) || 1 }))} />
                </div>

                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={settings.close_saturday} onChange={e => setSettings(prev => ({ ...prev, close_saturday: e.target.checked }))} className={styles.checkbox} />
                    <span>매주 토요일 자동 마감</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={settings.close_sunday} onChange={e => setSettings(prev => ({ ...prev, close_sunday: e.target.checked }))} className={styles.checkbox} />
                    <span>매주 일요일 자동 마감</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={settings.close_holidays} onChange={e => setSettings(prev => ({ ...prev, close_holidays: e.target.checked }))} className={styles.checkbox} />
                    <span>공휴일 자동 마감</span>
                  </label>
                </div>

                <PlatformButton type="submit" isLoading={settingsSaving} loadingLabel="예약 규칙 저장 중…" className={styles.formAction}>예약 규칙 저장</PlatformButton>
              </form>
            </PlatformPanel>

            <div className={styles.overrideSplit}>
              <PlatformPanel as="section" className={styles.sectionLayout}>
                <h2 className={styles.sectionTitle}>특정 날짜 수동 제어</h2>
                <form onSubmit={handleAddOverride} className={styles.overrideForm}>
                  <PlatformField id="ov-date" type="date" required label="예외 날짜" value={newOverrideDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOverrideDate(e.target.value)} />
                  <PlatformSegmentedControl
                    label="예외 날짜 예약 상태"
                    items={OVERRIDE_STATUS_ITEMS}
                    value={newOverrideClosed ? 'closed' : 'open'}
                    onChange={value => setNewOverrideClosed(value === 'closed')}
                  />
                  <PlatformField id="ov-memo" label="메모" value={newOverrideMemo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOverrideMemo(e.target.value)} placeholder="예: 대체휴무, 시공팀 교육" />
                  <PlatformButton type="submit" isLoading={overrideSubmitting} loadingLabel="예외 일정 반영 중…" className={styles.formAction}>예외 일정 반영</PlatformButton>
                </form>
              </PlatformPanel>

              <PlatformPanel as="section" className={styles.sectionLayout}>
                <h2 className={styles.sectionTitle}>등록된 예외 일정</h2>
                {overrides.length === 0 ? (
                  <PlatformStatePanel tone="empty" title="등록된 예외 일정이 없습니다." />
                ) : (
                  <ul className={styles.overrideList}>
                    {overrides.map(ov => (
                      <li key={ov.date} className={styles.overrideItem}>
                        <div>
                          <strong>{ov.date}</strong>
                          <p>{ov.memo || (ov.source === 'holiday' ? '공휴일' : '수동 설정')}</p>
                        </div>
                        <PlatformStatusBadge tone={ov.is_closed ? 'warning' : 'success'}>
                          {ov.is_closed ? '예약 불가' : '예약 가능'}
                        </PlatformStatusBadge>
                        <PlatformButton type="button" variant="danger" onClick={() => handleDeleteOverride(ov.date)}>삭제</PlatformButton>
                      </li>
                    ))}
                  </ul>
                )}
              </PlatformPanel>
            </div>
          </div>
        )}
      </div> : null}
    </div>
  )
}
