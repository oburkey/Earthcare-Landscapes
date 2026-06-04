import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import QuotesView, { type QuoteRow, type SiteOption } from './QuotesView'

export const metadata = { title: 'Quotes — Earthcare Landscapes' }

export default async function QuotesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

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
    const { data, error } = await supabase
      .from('quotes')
      .select('id, site_id, reference, description, status, line_items, notes, created_at, sites(name)')
      .order('created_at', { ascending: false })

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

  const canEdit = profile.role === 'admin' || profile.role === 'supervisor'

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <QuotesView
          initialQuotes={quotes}
          sites={sites}
          canEdit={canEdit}
          tableExists={tableExists}
        />
      </div>
    </div>
  )
}
