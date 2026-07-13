'use client'

import { useEffect, useRef, useState } from 'react'

type BlogAutoplayVideoProps = {
  src: string
  poster?: string
  alt: string
  className?: string
}

export default function BlogAutoplayVideo({ src, poster, alt, className }: BlogAutoplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncPlayback = () => {
      const shouldPlay = !mediaQuery.matches
      const video = videoRef.current
      setMotionAllowed(shouldPlay)

      if (!video) return
      if (shouldPlay) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }

    syncPlayback()
    mediaQuery.addEventListener('change', syncPlayback)
    return () => mediaQuery.removeEventListener('change', syncPlayback)
  }, [])

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={motionAllowed}
      muted
      loop
      playsInline
      poster={poster}
      aria-label={alt}
    >
      <source src={src} />
    </video>
  )
}
