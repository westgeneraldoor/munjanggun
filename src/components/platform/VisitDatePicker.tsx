'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { logError } from '@/lib/logger'
import styles from './visit-date-picker.module.css'

export type VisitRegionMode = 'standard' | 'chungcheong_limited' | 'unsupported'

interface Props {
  selectedDate: string
  onChange: (date: string) => void
  regionMode?: VisitRegionMode
}

interface BookingSettings {
  min_days_out: number
  max_days_out: number
  close_saturday: boolean
  close_sunday: boolean
  close_holidays: boolean
}

interface OverrideMap {
  [dateStr: string]: {
    isClosed: boolean
    source: 'manual' | 'holiday'
  }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function VisitDatePicker({ selectedDate, onChange, regionMode = 'standard' }: Props) {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<BookingSettings>({
    min_days_out: 2,
    max_days_out: 30,
    close_saturday: true,
    close_sunday: true,
    close_holidays: true,
  })
  const [overrides, setOverrides] = useState<OverrideMap>({})
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [lastBlockedReason, setLastBlockedReason] = useState('')

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/platform/measure/booking-config')
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? '예약 설정을 불러오지 못했습니다.')
        }

        const data = await res.json() as {
          settings: BookingSettings | null
          overrides: Array<{ date: string; is_closed: boolean; source: 'manual' | 'holiday' | null }>
        }

        if (data.settings) setSettings(data.settings)

        const map: OverrideMap = {}
        data.overrides.forEach(item => {
          map[item.date] = {
            isClosed: item.is_closed,
            source: item.source === 'holiday' ? 'holiday' : 'manual',
          }
        })
        setOverrides(map)
      } catch (err) {
        logError('Unexpected error in VisitDatePicker setup', err)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  const todayStr = useMemo(() => toDateKey(new Date()), [])

  const checkDateAvailable = useMemo(() => {
    return (date: Date): { available: boolean; reason?: string } => {
      const dateStr = toDateKey(date)
      const today = new Date(todayStr)
      const targetDate = new Date(dateStr)
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const dow = date.getDay()

      if (regionMode === 'unsupported') {
        return { available: false, reason: '현재 방문 상담 가능 지역 밖입니다.' }
      }

      if (diffDays < settings.min_days_out) {
        return { available: false, reason: `오늘 기준 ${settings.min_days_out}일 후부터 신청할 수 있습니다.` }
      }

      if (diffDays > settings.max_days_out) {
        return { available: false, reason: `오늘 기준 ${settings.max_days_out}일 이내 날짜만 신청할 수 있습니다.` }
      }

      if (regionMode === 'chungcheong_limited' && dow !== 3 && dow !== 6) {
        return { available: false, reason: '충청권은 수요일과 토요일 중심으로 방문 상담을 운영합니다.' }
      }

      const override = overrides[dateStr]
      if (override) {
        if (override.source === 'manual') {
          return override.isClosed
            ? { available: false, reason: '운영자가 닫아 둔 날짜입니다.' }
            : { available: true }
        }

        if (settings.close_holidays && override.isClosed) {
          return { available: false, reason: '공휴일은 신청할 수 없습니다.' }
        }
      }

      if (settings.close_saturday && dow === 6 && regionMode !== 'chungcheong_limited') return { available: false, reason: '토요일은 신청할 수 없습니다.' }
      if (settings.close_sunday && dow === 0) return { available: false, reason: '일요일은 신청할 수 없습니다.' }

      return { available: true }
    }
  }, [settings, overrides, todayStr, regionMode])

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days: Array<null | { day: number; dateStr: string; available: boolean; reason?: string; isToday: boolean }> = []

    for (let i = 0; i < firstDayIndex; i += 1) days.push(null)

    for (let d = 1; d <= totalDays; d += 1) {
      const dateObj = new Date(currentYear, currentMonth, d)
      const availability = checkDateAvailable(dateObj)
      const dateStr = toDateKey(dateObj)
      days.push({
        day: d,
        dateStr,
        available: availability.available,
        reason: availability.reason,
        isToday: dateStr === todayStr,
      })
    }

    return days
  }, [currentYear, currentMonth, checkDateAvailable, todayStr])

  const moveMonth = (direction: -1 | 1) => {
    const next = new Date(currentYear, currentMonth + direction, 1)
    setCurrentYear(next.getFullYear())
    setCurrentMonth(next.getMonth())
    setLastBlockedReason('')
  }

  const handleDateClick = (dateStr: string, available: boolean, reason?: string) => {
    if (!available) {
      setLastBlockedReason(reason ?? '선택할 수 없는 날짜입니다.')
      return
    }

    setLastBlockedReason('')
    onChange(dateStr)
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>예약 가능한 날짜를 확인하고 있습니다.</p>
      </div>
    )
  }

  return (
    <div className={styles.pickerContainer}>
      <div className={styles.calendarCard}>
        <header className={styles.calendarHeader}>
          <button type="button" onClick={() => moveMonth(-1)} className={styles.navBtn} aria-label="이전 달">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <span className={styles.currentMonth}>{currentYear}년 {currentMonth + 1}월</span>
          <button type="button" onClick={() => moveMonth(1)} className={styles.navBtn} aria-label="다음 달">
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.weekHeader}>
          {WEEKDAYS.map(day => (
            <span key={day} className={styles.weekDay}>{day}</span>
          ))}
        </div>

        <div className={styles.daysGrid}>
          {calendarDays.map((d, index) => {
            if (!d) return <div key={`empty-${index}`} className={styles.emptyDay} />

            const isSelected = selectedDate === d.dateStr
            let btnClass = styles.dayBtn
            if (isSelected) btnClass += ` ${styles.selected}`
            if (d.isToday) btnClass += ` ${styles.today}`
            if (!d.available) btnClass += ` ${styles.disabled}`

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => handleDateClick(d.dateStr, d.available, d.reason)}
                className={btnClass}
                aria-pressed={isSelected}
                aria-disabled={!d.available}
                title={d.reason}
              >
                {d.day}
              </button>
            )
          })}
        </div>

        <div className={styles.calendarFooter}>
          <span>선택 가능</span>
          <span>예약 불가</span>
        </div>
      </div>

      {selectedDate && (
        <p className={styles.selectedNotice}>
          선택한 방문 희망일: <strong>{selectedDate}</strong>
        </p>
      )}
      {lastBlockedReason && (
        <p className={styles.blockedNotice} role="status">{lastBlockedReason}</p>
      )}
      <p className={styles.timeNotice}>
        정확한 방문 시간은 방문 전날 오후 4~5시쯤 코스를 마감한 뒤 담당자가 직접 안내드립니다.
        전화가 부재중이면 문자라도 남겨드리고, 안내받은 시간이 맞지 않으면 일정을 변경해드립니다.
      </p>
    </div>
  )
}
