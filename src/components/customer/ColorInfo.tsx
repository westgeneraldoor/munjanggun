import ScrollAnimationWrapper from './ScrollAnimationWrapper'
import styles from './ColorInfo.module.css'

interface ColorInfoProps {
  collectionName: string
  colorName: string
  tagline: string | null
  description: string | null
}

export default function ColorInfo({
  collectionName,
  colorName,
  tagline,
  description,
}: ColorInfoProps) {
  return (
    <section className={styles.section}>
      <ScrollAnimationWrapper delay={0}>
        <div className={styles.tag}>{collectionName}</div>
      </ScrollAnimationWrapper>

      <ScrollAnimationWrapper delay={100}>
        <h1 className={styles.title}>{colorName}</h1>
      </ScrollAnimationWrapper>

      {tagline && (
        <ScrollAnimationWrapper delay={200}>
          <p className={styles.tagline}>{tagline}</p>
        </ScrollAnimationWrapper>
      )}

      {description && (
        <ScrollAnimationWrapper delay={300}>
          <p className={styles.description}>{description}</p>
        </ScrollAnimationWrapper>
      )}
    </section>
  )
}
