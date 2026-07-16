'use client'

import { useState } from 'react'
import ConfirmModal from '@/components/admin/ConfirmModal'
import NodeAddModal from '@/components/admin/NodeAddModal'
import NodeMoveModal from '@/components/admin/NodeMoveModal'
import { PlatformButton, PlatformModal } from '@/components/platform/ui'
import styles from './modal-fixture.module.css'

type OpenModal = 'confirm' | 'locked' | 'closable' | 'node-add' | 'node-move' | null

export function AdminModalFixtureClient() {
  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [result, setResult] = useState('아직 처리하지 않았습니다.')

  return (
    <section className={styles.fixture} data-admin-modal-fixture>
      <h1>관리자 모달 계약</h1>
      <p>포커스, 키보드, 로딩 잠금과 반응형 상태를 검증합니다.</p>
      <div className={styles.actions}>
        <PlatformButton id="open-confirm" type="button" onClick={() => setOpenModal('confirm')}>
          확인 모달 열기
        </PlatformButton>
        <PlatformButton id="open-locked" type="button" variant="secondary" onClick={() => setOpenModal('locked')}>
          처리 중 모달 열기
        </PlatformButton>
        <PlatformButton id="open-closable" type="button" variant="secondary" onClick={() => setOpenModal('closable')}>
          닫기 버튼 모달 열기
        </PlatformButton>
        <PlatformButton id="open-node-add" type="button" variant="secondary" onClick={() => setOpenModal('node-add')}>
          자식 노드 추가 열기
        </PlatformButton>
        <PlatformButton id="open-node-move" type="button" variant="secondary" onClick={() => setOpenModal('node-move')}>
          노드 이동 열기
        </PlatformButton>
      </div>
      <p role="status" className={styles.result}>{result}</p>

      <ConfirmModal
        isOpen={openModal === 'confirm'}
        title="노드 삭제 확인"
        message="선택한 노드를 삭제할까요? 이 동작은 되돌릴 수 없습니다."
        confirmText="삭제하기"
        onConfirm={() => {
          setResult('삭제 확인을 선택했습니다.')
          setOpenModal(null)
        }}
        onCancel={() => setOpenModal(null)}
        isDestructive
      />

      <ConfirmModal
        isOpen={openModal === 'locked'}
        title="노드 처리 중"
        message="서버 처리가 끝날 때까지 모달을 닫을 수 없습니다."
        confirmText="처리"
        onConfirm={() => undefined}
        onCancel={() => setOpenModal(null)}
        isLoading
      />

      <PlatformModal
        isOpen={openModal === 'closable'}
        title="닫기 버튼 계약"
        description="닫기 아이콘과 바깥 영역 닫기를 확인합니다."
        onClose={() => setOpenModal(null)}
        showCloseButton
        closeOnBackdrop
        footer={(
          <PlatformButton type="button" onClick={() => setOpenModal(null)} data-modal-initial-focus>
            확인
          </PlatformButton>
        )}
      />

      <NodeAddModal
        isOpen={openModal === 'node-add'}
        onClose={() => setOpenModal(null)}
        onSuccess={() => setOpenModal(null)}
        parentId="fixture-parent"
        displayOrder={0}
      />

      <NodeMoveModal
        isOpen={openModal === 'node-move'}
        node={{ id: 'fixture-node', name: '테스트 노드', parent_id: 'current-parent' }}
        onClose={() => setOpenModal(null)}
        onSuccess={() => setOpenModal(null)}
      />
    </section>
  )
}
