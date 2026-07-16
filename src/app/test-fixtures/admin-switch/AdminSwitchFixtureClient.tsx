'use client'

import { useState } from 'react'
import { PlatformSwitch } from '@/components/platform/ui'
import styles from './switch-fixture.module.css'

export function AdminSwitchFixtureClient() {
  const [enabled, setEnabled] = useState(false)

  return (
    <section className={styles.fixture} data-admin-switch-fixture>
      <h1>관리자 스위치 계약</h1>
      <PlatformSwitch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="히어로 사용"
        description="관리자 화면의 히어로 영역을 켜거나 끕니다."
      />
      <PlatformSwitch
        checked
        onCheckedChange={() => undefined}
        label="처리 중 스위치"
        disabled
      />
      <p role="status">현재 상태: {enabled ? '사용' : '사용 안 함'}</p>
    </section>
  )
}
