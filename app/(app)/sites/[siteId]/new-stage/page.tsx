import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import StageForm from './StageForm'

interface Props {
  params: Promise<{ siteId: string }>
}

export const metadata = { title: 'Add Stage — Earthcare Landscapes' }

export default async function NewStagePage({ params }: Props) {
  const { siteId } = await params
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  const supabase = await createClient()
  const { data: site } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', siteId)
    .single()

  if (!site) notFound()

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Back */}
        <Link
          href={`/sites/${siteId}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {site.name}
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-stone-900">Add stage</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Add a new stage to {site.name}.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <StageForm siteId={siteId} />
        </div>
      </div>
    </div>
  )
}
