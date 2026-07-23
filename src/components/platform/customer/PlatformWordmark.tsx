import { Nunito } from 'next/font/google'
import styles from './PlatformWordmark.module.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: '900',
  display: 'swap',
  variable: '--mg-platform-wordmark',
})

type PlatformWordmarkProps = {
  className?: string
}

/** The product wordmark is intentionally English-only: Nunito 900, uppercase. */
export function PlatformWordmark({ className = '' }: PlatformWordmarkProps) {
  return <span className={`${styles.wordmark} ${nunito.className} ${nunito.variable} ${className}`}>MUNJANGGUN</span>
}
