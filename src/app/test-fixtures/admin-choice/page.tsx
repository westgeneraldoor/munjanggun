import { PlatformCheckbox } from '@/components/platform/ui/PlatformCheckbox'
import { PlatformChip } from '@/components/platform/ui/PlatformChip'

export default function AdminChoiceFixturePage() {
  return (
    <main data-mg-theme="admin">
      <h1>선택 프리미티브 테스트</h1>
      <PlatformCheckbox name="enabledChoice">활성 확인</PlatformCheckbox>
      <PlatformCheckbox name="disabledChoice" disabled>비활성 확인</PlatformCheckbox>
      <PlatformChip tone="accent">분류</PlatformChip>
      <PlatformChip tone="selected">선택</PlatformChip>
    </main>
  )
}
