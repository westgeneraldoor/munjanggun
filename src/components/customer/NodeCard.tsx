'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import Image from 'next/image'
import { shouldBypassNextImageOptimization } from '@/lib/image'
import styles from './NodeCard.module.css'

interface NodeCardProps {
  node: {
    id: string
    name: string
    slug: string
    tagline: string | null
    card_subtitle: string | null
    image_url: string | null
    type?: string
  }
  basePath?: string
  textPosition?: 'overlay' | 'below'
}

function CardPendingFeedback() {
  const { pending } = useLinkStatus()

  return (
    <span
      className={`${styles.pendingVeil} ${pending ? styles.pendingVeilActive : ''}`}
      aria-hidden="true"
    />
  )
}

export default function NodeCard({ node, basePath = '', textPosition = 'overlay' }: NodeCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  const isBelow = textPosition === 'below'
  const href = basePath ? `${basePath}/${node.slug}` : `/${node.slug}`

  const handleNavigate = () => {
    sessionStorage.setItem(`catalog-scroll-y:${window.location.pathname}`, window.scrollY.toString())
    sessionStorage.setItem('catalog-nav-direction', 'forward')
  }

  return (
    <Link
      href={href}
      transitionTypes={['nav-forward']}
      className={`${styles.card} ${isBelow ? styles.cardBelow : ''} ${isPressed ? styles.cardPressed : ''}`}
      onNavigate={handleNavigate}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
    >
      <div className={`${styles.imageWrapper} ${isBelow ? styles.imageWrapperBelow : ''}`}>
        {node.image_url ? (
          <Image
            src={node.image_url}
            alt={`${node.name} 이미지`}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ''}`}
            unoptimized={shouldBypassNextImageOptimization(node.image_url)}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderText}>{node.name}</span>
          </div>
        )}

        {!isBelow && (
          <>
            <div className={styles.overlay} />
            <div className={`${styles.content} ${styles.textLight}`}>
              <h2 className={styles.name}>{node.name}</h2>
              {(node.card_subtitle || node.tagline) && (
                <p className={styles.tagline}>{node.card_subtitle || node.tagline}</p>
              )}
            </div>
          </>
        )}
      </div>

      {isBelow && (
        <div className={styles.contentBelow}>
          <h2 className={styles.name}>{node.name}</h2>
          {(node.card_subtitle || node.tagline) && (
            <p className={styles.tagline}>{node.card_subtitle || node.tagline}</p>
          )}
        </div>
      )}

      <CardPendingFeedback />
    </Link>
  )
}
