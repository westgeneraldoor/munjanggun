import { Nunito } from 'next/font/google'
import styles from './BlogBrandWordmark.module.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
  variable: '--mg-blog-wordmark-loaded',
})

type BlogBrandWordmarkProps = {
  className?: string
  compact?: boolean
  label?: string
}

export default function BlogBrandWordmark({ className = '', compact = false, label = 'BLOG' }: BlogBrandWordmarkProps) {
  return (
    <span className={`${styles.lockup} ${nunito.className} ${nunito.variable} ${compact ? styles.compact : ''} ${className}`}>
      <span className={styles.brand}>MUNJANGGUN</span>
      <span className={styles.blog}>{label}</span>
    </span>
  )
}
