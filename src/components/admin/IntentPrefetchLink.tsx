'use client'

import { useState, type ComponentPropsWithoutRef } from 'react'
import Link from 'next/link'

export type IntentPrefetchLinkProps = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  'prefetch'
>

export function IntentPrefetchLink({
  onMouseEnter,
  onFocus,
  ...props
}: IntentPrefetchLinkProps) {
  const [hasIntent, setHasIntent] = useState(false)

  return (
    <Link
      {...props}
      prefetch={hasIntent ? null : false}
      onMouseEnter={(event) => {
        setHasIntent(true)
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        setHasIntent(true)
        onFocus?.(event)
      }}
    />
  )
}
