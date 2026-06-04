'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Save, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
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
        const [{ data: catData }, { data: setData }, { data: overrideData }] = await Promise.all([
          supabase.from('measurement_product_categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('measurement_booking_settings').select('*').eq('id', 1).single(),
          supabase.from('measurement_date_overrides').select('*').order('date', { ascending: true }),
        ])

        setCategories((catData ?? []) as CategoryItem[])
        if (setData) setSettings(setData as BookingSettings)
        setOverrides((overrideData ?? []) as DateOverride[])
      } catch (err) {
        logError('Error loading admin settings data', err)
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
        alert(`품목 추가 실패: ${error.message}`)
        return
      }

      if (data) setCategories(prev => [...prev, data as CategoryItem])
      setNewCatLabel('')
      setNewCatDesc('')
      setNewCatFile(null)
      if (newFileRef.current) newFileRef.current.value = ''
    } catch (err) {
      logError('Category add unexpected error', err)
      alert('품목 추가 중 오류가 발생했습니다.')
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
        alert('품목 수정에 실패했습니다.')
        return
      }

      setCategories(prev => prev.map(item =>
        item.id === cat.id
          ? { ...item, label: editCatLabel.trim(), description: editCatDesc.trim() || null, image_url: imageUrl }
          : item
      ))
      setEditingCatId(null)
      setEditCatFile(null)
    } catch (err) {
      logError('Edit category save error', err)
      alert('품목 수정 중 오류가 발생했습니다.')
    } finally {
      setCategorySaving(false)
    }
  }

  const handleToggleCatActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('measurement_product_categories')
      .update({ is_active: !currentActive })
      .eq('id', id)

    if (error) {
      alert('노출 상태 변경에 실패했습니다.')
      return
    }

    setCategories(prev => prev.map(c => (c.id === id ? { ...c, is_active: !currentActive } : c)))
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
    if (!confirm('이미 접수된 신청 내역 보존을 위해 삭제 대신 비노출 처리합니다. 진행할까요?')) return
    await handleToggleCatActive(id, true)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (settings.min_days_out < 0 || settings.max_days_out < settings.min_days_out) {
      alert('예약 가능일 범위를 확인해 주세요.')
      return
    }

    setSettingsSaving(true)
    try {
      const { error } = await supabase
        .from('measurement_booking_settings')
        .update(settings)
        .eq('id', 1)

      if (error) alert(`설정 저장 실패: ${error.message}`)
      else alert('예약 기본 설정을 저장했습니다.')
    } catch (err) {
      logError('Save booking settings error', err)
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOverrideDate) return

    setOverrideSubmitting(true)
    try {
      const nextOverride: DateOverride = {
        date: newOverrideDate,
        is_closed: newOverrideClosed,
        memo: newOverrideMemo.trim() || null,
        source: 'manual',
      }
      const { error } = await supabase.from('measurement_date_overrides').upsert(nextOverride)

      if (error) {
        alert(`예외 일정 추가 실패: ${error.message}`)
        return
      }

      setOverrides(prev => [...prev.filter(o => o.date !== newOverrideDate), nextOverride].sort((a, b) => a.date.localeCompare(b.date)))
      setNewOverrideDate('')
      setNewOverrideMemo('')
    } catch (err) {
      logError('Add override error', err)
    } finally {
      setOverrideSubmitting(false)
    }
  }

  const handleDeleteOverride = async (dateStr: string) => {
    if (!confirm(`${dateStr} 예외 설정을 삭제할까요?`)) return
    const { error } = await supabase.from('measurement_date_overrides').delete().eq('date', dateStr)
    if (error) {
      alert('삭제에 실패했습니다.')
      return
    }
    setOverrides(prev => prev.filter(o => o.date !== dateStr))
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>설정 데이터를 불러오는 중입니다.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.navRow}>
          <Link href="/admin/platform" className={styles.backLink}>접수 큐 목록</Link>
        </div>
        <h1 className={styles.pageTitle}>플랫폼 운영 설정</h1>
        <p className={styles.pageDesc}>무료방문 신청 품목과 예약 가능일을 관리합니다.</p>
      </header>

      <div className={styles.tabs}>
        <button type="button" onClick={() => setActiveTab('categories')} className={`${styles.tab} ${activeTab === 'categories' ? styles.tabActive : ''}`}>
          관심 품목 관리
        </button>
        <button type="button" onClick={() => setActiveTab('schedule')} className={`${styles.tab} ${activeTab === 'schedule' ? styles.tabActive : ''}`}>
          예약 일정 설정
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'categories' && (
          <div className={styles.panel}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>새 품목 추가</h2>
              <form onSubmit={handleAddCategory} className={styles.categoryForm}>
                <div className={styles.inputGroup}>
                  <label htmlFor="cat-label" className={styles.label}>품목명</label>
                  <input id="cat-label" type="text" required value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="예: 3연동중문" className={styles.input} />
                </div>
                <div className={styles.inputGroupFull}>
                  <label htmlFor="cat-desc" className={styles.label}>품목설명</label>
                  <textarea id="cat-desc" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="고객에게 보여줄 짧은 설명" className={styles.textarea} rows={3} />
                </div>
                <div className={styles.inputGroupFull}>
                  <label className={styles.label}>품목이미지</label>
                  <button type="button" className={styles.imagePickBtn} onClick={() => newFileRef.current?.click()}>
                    <ImagePlus size={16} strokeWidth={1.8} />
                    이미지 선택
                  </button>
                  <input ref={newFileRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.srOnly} onChange={e => setNewCatFile(e.target.files?.[0] ?? null)} />
                  {newCatFile && <span className={styles.fileName}>{newCatFile.name}</span>}
                </div>
                <button type="submit" className={styles.submitBtn} disabled={categorySaving}>
                  품목 추가
                </button>
              </form>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>품목 목록</h2>
              <ul className={styles.categoryList}>
                {categories.map((cat, idx) => {
                  const isEditing = editingCatId === cat.id
                  return (
                    <li key={cat.id} className={styles.categoryCard}>
                      <div className={styles.categoryImage}>
                        {cat.image_url ? (
                          <Image src={cat.image_url} alt="" width={96} height={96} unoptimized />
                        ) : (
                          <span className={styles.categoryImageEmpty}>이미지 없음</span>
                        )}
                      </div>

                      <div className={styles.categoryBody}>
                        {isEditing ? (
                          <>
                            <input type="text" value={editCatLabel} onChange={e => setEditCatLabel(e.target.value)} className={styles.input} />
                            <textarea value={editCatDesc} onChange={e => setEditCatDesc(e.target.value)} className={styles.textarea} rows={3} />
                            <button type="button" className={styles.imagePickBtn} onClick={() => editFileRef.current?.click()}>
                              <ImagePlus size={16} strokeWidth={1.8} />
                              이미지 변경
                            </button>
                            <input ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.srOnly} onChange={e => setEditCatFile(e.target.files?.[0] ?? null)} />
                            {editCatFile && <span className={styles.fileName}>{editCatFile.name}</span>}
                          </>
                        ) : (
                          <>
                            <div className={styles.categoryTitleRow}>
                              <strong>{cat.label}</strong>
                              <span className={`${styles.statusBadge} ${cat.is_active ? styles.badgeOpen : styles.badgeClosed}`}>
                                {cat.is_active ? '노출 중' : '비노출'}
                              </span>
                            </div>
                            <p>{cat.description || '품목설명이 없습니다.'}</p>
                          </>
                        )}
                      </div>

                      <div className={styles.categoryActions}>
                        <button type="button" onClick={() => handleMoveCategory(idx, 'up')} disabled={idx === 0} className={styles.iconBtn} aria-label="위로 이동">
                          <ArrowUp size={16} />
                        </button>
                        <button type="button" onClick={() => handleMoveCategory(idx, 'down')} disabled={idx === categories.length - 1} className={styles.iconBtn} aria-label="아래로 이동">
                          <ArrowDown size={16} />
                        </button>
                        {isEditing ? (
                          <button type="button" onClick={() => handleSaveEditCategory(cat)} className={styles.actionBtn} disabled={categorySaving}>
                            <Save size={15} />
                            저장
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleStartEditCategory(cat)} className={styles.actionBtn}>
                            <Pencil size={15} />
                            수정
                          </button>
                        )}
                        <button type="button" onClick={() => cat.is_active ? handleDeactivateCategory(cat.id) : handleToggleCatActive(cat.id, false)} className={styles.actionBtn}>
                          <Trash2 size={15} />
                          {cat.is_active ? '비노출' : '노출'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className={styles.panel}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>방문 실측 예약 기본 규칙</h2>
              <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
                <div className={styles.settingsGrid}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="min-days" className={styles.label}>최소 접수 가능일</label>
                    <input id="min-days" type="number" min={0} required value={settings.min_days_out} onChange={e => setSettings(prev => ({ ...prev, min_days_out: parseInt(e.target.value) || 0 }))} className={styles.input} />
                    <span className={styles.inputHelp}>예: 2로 설정하면 모레부터 신청 가능</span>
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="max-days" className={styles.label}>최대 예약 가능일</label>
                    <input id="max-days" type="number" min={1} required value={settings.max_days_out} onChange={e => setSettings(prev => ({ ...prev, max_days_out: parseInt(e.target.value) || 1 }))} className={styles.input} />
                    <span className={styles.inputHelp}>예: 30으로 설정하면 30일 이내 날짜만 접수</span>
                  </div>
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

                <button type="submit" disabled={settingsSaving} className={styles.submitBtn}>
                  {settingsSaving ? '저장 중...' : '예약 규칙 저장'}
                </button>
              </form>
            </section>

            <div className={styles.overrideSplit}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>특정 날짜 수동 제어</h2>
                <form onSubmit={handleAddOverride} className={styles.overrideForm}>
                  <div className={styles.inputGroupFull}>
                    <label htmlFor="ov-date" className={styles.label}>예외 날짜</label>
                    <input id="ov-date" type="date" required value={newOverrideDate} onChange={e => setNewOverrideDate(e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.radioGrid}>
                    <label className={`${styles.radioLabel} ${newOverrideClosed ? styles.radioActive : ''}`}>
                      <input type="radio" name="ov-closed" checked={newOverrideClosed} onChange={() => setNewOverrideClosed(true)} className={styles.srOnly} />
                      예약 불가
                    </label>
                    <label className={`${styles.radioLabel} ${!newOverrideClosed ? styles.radioActive : ''}`}>
                      <input type="radio" name="ov-closed" checked={!newOverrideClosed} onChange={() => setNewOverrideClosed(false)} className={styles.srOnly} />
                      예약 가능
                    </label>
                  </div>
                  <div className={styles.inputGroupFull}>
                    <label htmlFor="ov-memo" className={styles.label}>메모</label>
                    <input id="ov-memo" type="text" value={newOverrideMemo} onChange={e => setNewOverrideMemo(e.target.value)} placeholder="예: 대체휴무, 시공팀 교육" className={styles.input} />
                  </div>
                  <button type="submit" disabled={overrideSubmitting} className={styles.submitBtn}>예외 일정 반영</button>
                </form>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>등록된 예외 일정</h2>
                {overrides.length === 0 ? (
                  <p className={styles.emptyText}>등록된 예외 일정이 없습니다.</p>
                ) : (
                  <ul className={styles.overrideList}>
                    {overrides.map(ov => (
                      <li key={ov.date} className={styles.overrideItem}>
                        <div>
                          <strong>{ov.date}</strong>
                          <p>{ov.memo || (ov.source === 'holiday' ? '공휴일' : '수동 설정')}</p>
                        </div>
                        <span className={`${styles.statusBadge} ${ov.is_closed ? styles.badgeClosed : styles.badgeOpen}`}>
                          {ov.is_closed ? '예약 불가' : '예약 가능'}
                        </span>
                        <button type="button" onClick={() => handleDeleteOverride(ov.date)} className={styles.textDanger}>삭제</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
