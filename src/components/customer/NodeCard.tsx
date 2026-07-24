'use client'

import { useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { requestShowroomScrollReset } from '@/components/customer/ScrollRestorer'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import type { ShowroomImageSource } from '@/lib/showroom/image-sources'
import styles from './NodeCard.module.css'

interface NodeCardProps {
  node: {
    id: string
    name: string
    slug: string
    tagline: string | null
    card_subtitle: string | null
    image_url: string | null
    image_source?: ShowroomImageSource
    type?: string
  }
  basePath?: string
  textPosition?: 'overlay' | 'below'
}

export default function NodeCard({ node, basePath = '', textPosition = 'overlay' }: NodeCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const isBelow = textPosition === 'below'
  const href = basePath ? `${basePath}/${node.slug}` : `/${node.slug}`

  const handleNavigationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    requestShowroomScrollReset(href)
  }

  return (
    <Link
      href={href}
      scroll={false}
      className={`${styles.card} ${isBelow ? styles.cardBelow : ''}`}
      onClick={handleNavigationClick}
    >
      <div className={`${styles.imageWrapper} ${isBelow ? styles.imageWrapperBelow : ''}`}>
        {node.image_url ? (
          <ShowroomImage
            source={node.image_source ?? node.image_url}
            purpose="card"
            alt={`${node.name} 이미지`}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ''}`}
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
    </Link>
  )
}
