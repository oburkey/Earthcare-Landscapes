import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import SeedClient from './SeedClient'

export default async function SeedPage() {
  const profile = await requireAuth()
  if (profile.role !== 'admin') redirect('/safety')

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <SeedClient />
    </div>
  )
}
