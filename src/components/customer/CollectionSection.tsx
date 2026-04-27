import ColorCard from './ColorCard'
import styles from './CollectionSection.module.css'

interface Color {
  id: string
  name: string
  slug: string
  tagline: string | null
  texture_image_url: string | null
}

interface CollectionSectionProps {
  collection: {
    name: string
    slug: string
    description: string | null
  }
  colors: Color[]
}

export default function CollectionSection({ collection, colors }: CollectionSectionProps) {
  if (colors.length === 0) return null

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>{collection.name}</h2>
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
      </header>
      <div className={styles.grid}>
        {colors.map((color) => (
          <ColorCard
            key={color.id}
            color={color}
            collectionSlug={collection.slug}
          />
        ))}
      </div>
    </section>
  )
}
