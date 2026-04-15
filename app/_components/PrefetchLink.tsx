'use client'

// Wraps Next.js Link and prefetches the destination on hover.
// Use on list items where users typically hover before clicking.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof Link>

export function PrefetchLink({ href, onMouseEnter, ...rest }: Props) {
  const router = useRouter()
  return (
    <Link
      href={href}
      onMouseEnter={(e) => {
        router.prefetch(String(href))
        onMouseEnter?.(e)
      }}
      {...rest}
    />
  )
}
