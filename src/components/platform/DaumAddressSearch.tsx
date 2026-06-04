'use client'

import React, { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { X } from 'lucide-react'
import { logError } from '@/lib/logger'
import styles from './daum-address-search.module.css'

interface DaumPostcodeData {
  zonecode: string
  roadAddress: string
  jibunAddress: string
  autoJibunAddress: string
  bname: string
  buildingName: string
  apartment: string
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void
  width?: string
  height?: string
  autoClose?: boolean
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: DaumPostcodeOptions) => {
        embed: (element: HTMLDivElement) => void
        open: () => void
      }
    }
  }
}

interface AddressData {
  postcode: string
  roadAddress: string
  jibunAddress: string
  addressExtra: string
  isManual: boolean
}

interface Props {
  onComplete: (data: AddressData) => void
  onClose: () => void
}

function toAddressData(data: DaumPostcodeData): AddressData {
  let extraAddr = ''

  if (data.bname && /[동|로|가]$/g.test(data.bname)) {
    extraAddr += data.bname
  }

  if (data.buildingName && data.apartment === 'Y') {
    extraAddr += extraAddr ? `, ${data.buildingName}` : data.buildingName
  }

  return {
    postcode: data.zonecode,
    roadAddress: data.roadAddress,
    jibunAddress: data.jibunAddress || data.autoJibunAddress || '',
    addressExtra: extraAddr ? ` (${extraAddr})` : '',
    isManual: false,
  }
}

export default function DaumAddressSearch({ onComplete, onClose }: Props) {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState(false)
  const [embedEmpty, setEmbedEmpty] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.daum?.Postcode) {
      setTimeout(() => setScriptLoaded(true), 0)
    }
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) return

    try {
      const Postcode = window.daum?.Postcode
      if (!Postcode) {
        setTimeout(() => setScriptError(true), 0)
        return
      }

      const postcode = new Postcode({
        oncomplete: (data) => onComplete(toAddressData(data)),
        width: '100%',
        height: '100%',
        autoClose: false,
      })

      postcode.embed(containerRef.current)

      const timer = window.setTimeout(() => {
        if (!containerRef.current) return
        const hasDaumContent = containerRef.current.querySelector('iframe') || containerRef.current.children.length > 0
        setEmbedEmpty(!hasDaumContent)
      }, 1800)

      return () => window.clearTimeout(timer)
    } catch (err) {
      logError('Daum Postcode embed error', err)
      setTimeout(() => setScriptError(true), 0)
    }
  }, [scriptLoaded, onComplete])

  const handleManualInput = () => {
    onComplete({
      postcode: '',
      roadAddress: '',
      jibunAddress: '',
      addressExtra: '',
      isManual: true,
    })
  }

  const handlePopupSearch = () => {
    try {
      const Postcode = window.daum?.Postcode
      if (!Postcode) {
        setScriptError(true)
        return
      }

      new Postcode({
        oncomplete: (data) => onComplete(toAddressData(data)),
        autoClose: true,
      }).open()
    } catch (err) {
      logError('Daum Postcode popup error', err)
      setScriptError(true)
    }
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="daum-address-title">
      <Script
        src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setScriptError(true)}
        strategy="afterInteractive"
      />

      <div className={styles.modalContent}>
        <header className={styles.header}>
          <h3 id="daum-address-title" className={styles.title}>주소 검색</h3>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="닫기">
            <X size={22} strokeWidth={1.8} />
          </button>
        </header>

        <div className={styles.body}>
          {!scriptLoaded && !scriptError && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>주소 검색 서비스를 불러오고 있습니다.</p>
            </div>
          )}

          {scriptError ? (
            <div className={styles.errorContainer}>
              <p className={styles.errorMsg}>
                주소 검색 서비스를 불러오지 못했습니다.
                <br />
                네트워크나 브라우저 보안 설정 때문에 일시적으로 막힐 수 있습니다.
              </p>
              <button type="button" onClick={handleManualInput} className={styles.fallbackBtn}>
                주소 직접 입력하기
              </button>
            </div>
          ) : (
            <div ref={containerRef} className={styles.searchContainer} />
          )}

          {scriptLoaded && !scriptError && embedEmpty && (
            <div className={styles.blankHelp}>
              <strong>주소 검색창이 보이지 않습니다.</strong>
              <p>일부 인앱 브라우저에서는 주소 검색 영역이 비어 보일 수 있습니다. 새 창으로 검색하거나 수동 입력을 이용해 주세요.</p>
              <div className={styles.blankActions}>
                <button type="button" onClick={handlePopupSearch} className={styles.fallbackBtn}>
                  새 창으로 주소 검색
                </button>
                <button type="button" onClick={handleManualInput} className={styles.secondaryBtn}>
                  수동 입력
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.manualAddressFooter}>
          <span className={styles.manualAddressText}>주소 검색이 작동하지 않을 때만</span>
          <button type="button" onClick={handleManualInput} className={styles.manualAddressLink}>
            수동 입력
          </button>
        </div>
      </div>
    </div>
  )
}
