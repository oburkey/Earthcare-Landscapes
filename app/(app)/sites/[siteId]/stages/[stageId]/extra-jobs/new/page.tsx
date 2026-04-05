import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ExtraJobForm from './ExtraJobForm'

interface Props {
  params: Promise<{ siteId: string; stageId: string }>
}

export const metadata = { title: 'Add Extra Job — Earthcare Landscapes' }

export default async function NewExtraJobPage({ params }: Props) {
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

  const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        <nav className="flex items-center gap-1.5 text-sm text-stone-500">
          <Link href="/sites" className="hover:text-stone-700">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-stone-700 truncate max-w-[120px]">{site.name}</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}/stages/${stageId}`} className="hover:text-stone-700 truncate max-w-[120px]">{stage.name}</Link>
          <span>/</span>
          <span className="text-stone-700 font-medium">Add extra job</span>
        </nav>

        <div>
          <h1 className="text-xl font-semibold text-stone-900">Add extra job</h1>
          <p className="mt-0.5 text-sm text-stone-500">Add an extra job to {stage.name}.</p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <ExtraJobForm stageId={stageId} siteId={siteId} />
        </div>
      </div>
    </div>
  )
}
