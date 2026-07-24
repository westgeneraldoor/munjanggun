'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SCROLL_STORAGE_KEY_PREFIX = 'catalog-scroll-y:'
export const SHOWROOM_SCROLL_RESET_PATH_KEY = 'showroom-scroll-reset-path'

export function requestShowroomScrollReset(pathname: string) {
  try {
    // Save synchronously before navigation changes the document scroll. Next
    // navigation may otherwise scroll while the source route listener is
    // still mounted, which would replace the return position with zero.
    const sourceStorageKey = `${SCROLL_STORAGE_KEY_PREFIX}${window.location.pathname}`
    window.sessionStorage.setItem(sourceStorageKey, window.scrollY.toString())
    window.sessionStorage.setItem(SHOWROOM_SCROLL_RESET_PATH_KEY, pathname)
  } catch {
    // Navigation still works when storage is unavailable.
  }
}

export default function ScrollRestorer() {
  const pathname = usePathname()

  useEffect(() => {
    const storageKey = `${SCROLL_STORAGE_KEY_PREFIX}${pathname}`
    let shouldResetToTop = false

    try {
      shouldResetToTop = window.sessionStorage.getItem(SHOWROOM_SCROLL_RESET_PATH_KEY) === pathname
      if (shouldResetToTop) {
        window.sessionStorage.removeItem(SHOWROOM_SCROLL_RESET_PATH_KEY)
        // A direct node or lightbox-option navigation starts a new showroom
        // context. Remove any old position for the destination as well: in
        // development, React can replay this effect and otherwise the replay
        // would immediately restore the stale destination position.
        window.sessionStorage.removeItem(storageKey)
        window.scrollTo({ top: 0, behavior: 'instant' })
      } else {
        const savedScrollY = window.sessionStorage.getItem(storageKey)
        if (savedScrollY !== null) {
          window.scrollTo({
            top: Number.parseInt(savedScrollY, 10),
            behavior: 'instant',
          })
        }
      }
    } catch {
      // No restoration is safer than a navigation failure when storage is unavailable.
    }

    const handleScroll = () => {
      try {
        // Do not let an in-flight navigation replace the synchronously saved
        // source position with a transient layout/scroll position.
        if (window.sessionStorage.getItem(SHOWROOM_SCROLL_RESET_PATH_KEY) !== null) return
        window.sessionStorage.setItem(storageKey, window.scrollY.toString())
      } catch {
        // Keep the page usable when storage is unavailable.
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

  return null
}
