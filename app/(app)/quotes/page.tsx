import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import QuotesView, { type QuoteRow, type SiteOption, type ConversionMap } from './QuotesView'

export const metadata = { title: 'Quotes — Earthcare Landscapes' }

export default async function QuotesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const supabase = await createClient()

  // Active sites for the site dropdown
  const { data: sitesRaw } = await supabase
    .from('sites')
    .select('id, name')
    .is('completed_at', null)
    .order('name')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sites: SiteOption[] = (sitesRaw ?? []).map((s: any) => ({ id: s.id, name: s.name }))

  // Quotes — graceful fallback if the table doesn't exist yet
  let quotes: QuoteRow[] = []
  let tableExists = true

  try {
    // Try full query with stage_id (requires migration_quote_conversion.sql)
    let { data, error } = await supabase
      .from('quotes')
      .select('id, site_id, stage_id, reference, description, status, line_items, notes, created_at, sites(name), stages(name)')
      .order('created_at', { ascending: false })

    // Fall back to simpler query if stage_id column doesn't exist yet
    if (error && error.code !== '42P01' && !error.message?.includes('does not exist')) {
      const fallback = await supabase
        .from('quotes')
        .select('id, site_id, reference, description, status, line_items, notes, created_at, sites(name)')
        .order('created_at', { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data = fallback.data as any
      error = fallback.error
    }

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        tableExists = false
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quotes = (data ?? []).map((q: any): QuoteRow => ({
        id:          q.id,
        siteId:      q.site_id ?? null,
        siteName:    q.sites?.name ?? null,
        stageId:     q.stage_id ?? null,
        stageName:   q.stages?.name ?? null,
        reference:   q.reference ?? '',
        description: q.description ?? '',
        status:      q.status ?? 'draft',
        lineItems:   Array.isArray(q.line_items) ? q.line_items : [],
        notes:       q.notes ?? '',
        createdAt:   q.created_at,
      }))
    }
  } catch {
    tableExists = false
  }

  const canEdit = profile.role === 'admin'

  // Fetch conversion data — which quotes have been converted to extra jobs
  const conversions: ConversionMap = {}
  try {
    const { data: convertedJobs } = await supabase
      .from('extra_jobs')
      .select('id, source_quote_id, stages!inner(id, name, site_id)')
      .not('source_quote_id', 'is', null)

    if (convertedJobs) {
      for (const j of convertedJobs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stage = Array.isArray(j.stages) ? (j.stages as any)[0] : (j.stages as any)
        if (j.source_quote_id && stage) {
          conversions[j.source_quote_id] = {
            extraJobId: j.id,
            stageName:  stage.name,
            siteId:     stage.site_id,
            stageId:    stage.id,
          }
        }
      }
    }
  } catch {
    // source_quote_id column doesn't exist yet — migration not run
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <QuotesView
          initialQuotes={quotes}
          sites={sites}
          canEdit={canEdit}
          tableExists={tableExists}
          initialConversions={conversions}
        />
      </div>
    </div>
  )
}
