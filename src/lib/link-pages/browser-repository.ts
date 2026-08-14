'use client'

import {
  LINK_PAGE_CHANNEL,
  LINK_PAGE_EVENT_KEY,
  LINK_PAGE_STORAGE_KEY,
  LinkPageEvent,
  LinkPageState,
  createInitialLinkPageState,
  isLinkPageState,
} from './model'

export interface LinkPageRepository {
  load(): LinkPageState
  save(state: LinkPageState): void
  recordEvent(event: LinkPageEvent): void
  listEvents(): LinkPageEvent[]
  reset(): LinkPageState
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseEvents(raw: string | null): LinkPageEvent[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function createBrowserLinkPageRepository(): LinkPageRepository {
  return {
    load() {
      if (!canUseStorage()) return createInitialLinkPageState()
      const raw = window.localStorage.getItem(LINK_PAGE_STORAGE_KEY)
      if (!raw) {
        const initial = createInitialLinkPageState()
        window.localStorage.setItem(LINK_PAGE_STORAGE_KEY, JSON.stringify(initial))
        return initial
      }
      try {
        const parsed = JSON.parse(raw)
        if (isLinkPageState(parsed)) return parsed
      } catch {
        // Invalid prototype state falls back to the safe seed below.
      }
      return this.reset()
    },
    save(state) {
      if (!canUseStorage()) return
      window.localStorage.setItem(LINK_PAGE_STORAGE_KEY, JSON.stringify(state))
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(LINK_PAGE_CHANNEL)
        channel.postMessage({ type: 'state-updated' })
        channel.close()
      }
    },
    recordEvent(event) {
      if (!canUseStorage()) return
      const events = parseEvents(window.localStorage.getItem(LINK_PAGE_EVENT_KEY))
      if (events.some((item) => item.id === event.id)) return
      window.localStorage.setItem(LINK_PAGE_EVENT_KEY, JSON.stringify([...events.slice(-499), event]))
    },
    listEvents() {
      if (!canUseStorage()) return []
      return parseEvents(window.localStorage.getItem(LINK_PAGE_EVENT_KEY))
    },
    reset() {
      const initial = createInitialLinkPageState()
      if (canUseStorage()) window.localStorage.setItem(LINK_PAGE_STORAGE_KEY, JSON.stringify(initial))
      return initial
    },
  }
}

export function subscribeToLinkPageState(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const onStorage = (event: StorageEvent) => {
    if (event.key === LINK_PAGE_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(LINK_PAGE_CHANNEL) : null
  channel?.addEventListener('message', onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
}
