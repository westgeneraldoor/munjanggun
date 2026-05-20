'use client'

import { useEffect } from 'react'

export default function ScrollRestorer() {
  useEffect(() => {
    // Restore scroll position
    const savedScrollY = sessionStorage.getItem('catalog-scroll-y')
    if (savedScrollY !== null) {
      window.scrollTo({
        top: parseInt(savedScrollY, 10),
        behavior: 'instant'
      })
    }

    // Save scroll position before leaving
    const handleScroll = () => {
      sessionStorage.setItem('catalog-scroll-y', window.scrollY.toString())
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return null
}
