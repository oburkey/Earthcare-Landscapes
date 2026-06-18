import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  RANGE_OPTIONS,
  getPipelineRange,
  getCompletionRange,
  buildAnalyticsData,
  type RangeKey,
  type SiteRow,
  type StageRow,
  type LotRow,
  type CompletedLotRow,
  type QuoteRow,
  type RatioRow,
} from './lib'
import DateRangeFilter from './DateRangeFilter'
import AnalyticsView from './AnalyticsView'

export const metadata = { title: 'Analytics — Earthcare Landscapes' }

interface Props {
  searchParams: Promise<{ range?: string }>
}

function isRangeKey(value: string | undefined): value is RangeKey {
  return value === '3m' || value === '6m' || value === '12m' || value === 'all'
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const { range: rawRange } = await searchParams
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : '3m'
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)?.label ?? '3 months'
  const { startDate: pipelineStartDate, endDate: pipelineEndDate } = getPipelineRange(range)
  const { startDate: completionStartDate, endDate: completionEndDate } = getCompletionRange(range)

  const supabase = await createClient()

  const [sitesResult, stagesResult, ratiosResult] = await Promise.all([
    supabase.from('sites').select('id, name').order('name'),
    supabase.from('stages').select('id, name, site_id, order').order('order'),
    supabase.from('plant_ratio_settings').select('site_id, front_ratio, rear_ratio'),
  ])

  let lotsQuery = supabase
    .from('lots')
    .select('id, lot_number, stage_id, due_date, build_complete, invoiced, contract_price')
  if (pipelineStartDate && pipelineEndDate) {
    lotsQuery = lotsQuery.gte('due_date', pipelineStartDate).lt('due_date', pipelineEndDate)
  }
  const lotsResult = await lotsQuery

  let completedQuery = supabase
    .from('lots')
    .select('id, build_completed_at')
    .not('build_completed_at', 'is', null)
  if (completionStartDate && completionEndDate) {
    completedQuery = completedQuery.gte('build_completed_at', completionStartDate).lt('build_completed_at', completionEndDate)
  }
  const completedResult = await completedQuery

  const lots = (lotsResult.data ?? []) as LotRow[]
  const lotIds = lots.map((l) => l.id)

  let quotes: QuoteRow[] = []
  if (lotIds.length > 0) {
    const quotesResult = await supabase
      .from('lot_quotes')
      .select(`
        lot_id, is_estimated, status,
        lot_quote_items(
          item_name, quantity, unit_price_snapshot,
          quote_template_items(
            unit_price, plant_category,
            quote_template_sections(name, is_client_extra)
          )
        )
      `)
      .in('lot_id', lotIds)
    quotes = (quotesResult.data ?? []) as unknown as QuoteRow[]
  }

  const data = buildAnalyticsData({
    rangeLabel,
    pipelineStartDate,
    pipelineEndDate,
    completionStartDate,
    completionEndDate,
    sites: (sitesResult.data ?? []) as SiteRow[],
    stages: (stagesResult.data ?? []) as unknown as StageRow[],
    lots,
    completedLots: (completedResult.data ?? []) as CompletedLotRow[],
    quotes,
    plantRatioSettings: (ratiosResult.data ?? []) as RatioRow[],
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Analytics</h1>
          <p className="mt-1 text-sm text-stone-500">
            Revenue and materials accuracy for Providence-style per-lot quoted sites.
          </p>
        </div>
        <div className="text-right">
          <DateRangeFilter current={range} />
          <p className="mt-1 text-xs text-stone-400">
            Pipeline &amp; revenue look ahead from this month; completions look back.
          </p>
        </div>
      </div>

      <AnalyticsView data={data} />
    </div>
  )
}
