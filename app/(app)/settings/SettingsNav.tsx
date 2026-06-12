'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/settings/materials', label: 'Materials Template' },
  { href: '/settings/plant-ratios', label: 'Plant Ratios' },
]

export default function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-stone-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              active
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
