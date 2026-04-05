import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import LotForm from './LotForm'

interface Props {
  params: Promise<{ siteId: string; stageId: string }>
}

export const metadata = { title: 'Add Lot — Earthcare Landscapes' }

export default async function NewLotPage({ params }: Props) {
  const { siteId, stageId } = await params
  const profile = await requireAuth()
  requireRole(profile, 'leading_hand')

  const supabase = await createClient()
  const { data: stage } = await supabase
    .from('stages')
    .select('id, name, sites!inner(id, name)')
    .eq('id', stageId)
    .single()

  if (!stage) notFound()

  const site = Array.isArray(stage.sites)
    ? stage.sites[0]
    : (stage.sites as { id: string; name: string })

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        <Link
          href={`/sites/${siteId}/stages/${stageId}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {stage.name}
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-stone-900">Add lot</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {site.name} — {stage.name}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <LotForm stageId={stageId} siteId={siteId} />
        </div>
      </div>
    </div>
  )
}
