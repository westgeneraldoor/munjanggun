import ScrollAnimationWrapper from './ScrollAnimationWrapper'
import styles from './NodeInfo.module.css'

interface NodeInfoProps {
  node: {
    name: string
    tagline: string | null
    description: string | null
    image_url: string | null
  }
}

export default function NodeInfo({ node }: NodeInfoProps) {
  return (
    <section className={styles.section}>
      <ScrollAnimationWrapper delay={0}>
        <h1 className={styles.title}>{node.name}</h1>
      </ScrollAnimationWrapper>

      {node.tagline && (
        <ScrollAnimationWrapper delay={100}>
          <p className={styles.tagline}>{node.tagline}</p>
        </ScrollAnimationWrapper>
      )}

      {node.description && (
        <ScrollAnimationWrapper delay={200}>
          <p className={styles.description}>{node.description}</p>
        </ScrollAnimationWrapper>
      )}
    </section>
  )
}
