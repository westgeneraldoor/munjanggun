'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SCROLL_KEY_PREFIX = 'catalog-scroll-y:'
const NAV_DIRECTION_KEY = 'catalog-nav-direction'

export default function ScrollRestorer() {
  const pathname = usePathname()

  useEffect(() => {
    const scrollKey = `${SCROLL_KEY_PREFIX}${pathname}`
    const navDirection = sessionStorage.getItem(NAV_DIRECTION_KEY)

    if (navDirection === 'forward') {
      sessionStorage.removeItem(NAV_DIRECTION_KEY)
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    } else {
      const savedScrollY = sessionStorage.getItem(scrollKey)
      window.scrollTo({
        top: savedScrollY ? parseInt(savedScrollY, 10) : 0,
        behavior: 'auto',
      })
    }

    const handleScroll = () => {
      sessionStorage.setItem(scrollKey, window.scrollY.toString())
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      sessionStorage.setItem(scrollKey, window.scrollY.toString())
      window.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

  return null
}
