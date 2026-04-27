'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './ColorCard.module.css'

interface ColorCardProps {
  color: {
    name: string
    slug: string
    tagline: string | null
    texture_image_url: string | null
  }
  collectionSlug: string
}

export default function ColorCard({ color, collectionSlug }: ColorCardProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <Link href={`/color/${collectionSlug}/${color.slug}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {color.texture_image_url ? (
          <Image
            src={color.texture_image_url}
            alt={`${color.name} 텍스처`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={`${styles.image} ${loaded ? styles.imageLoaded : ''}`}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className={styles.placeholder}>{color.name}</div>
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>{color.name}</h3>
        {color.tagline && (
          <p className={styles.tagline}>{color.tagline}</p>
        )}
      </div>
    </Link>
  )
}
