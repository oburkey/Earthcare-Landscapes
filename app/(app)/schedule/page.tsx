import { requireAuth } from '@/lib/auth'
import { getCachedScheduleData, getCachedTradeStatusByLotIds } from '@/lib/data'
import ScheduleView, { type LotItem, type JobItem, type SiteOption } from './ScheduleView'
import type { LotStatus, ExtraJobStatus } from '@/types/database'

export const metadata = { title: 'Schedule — Earthcare Landscapes' }

export default async function SchedulePage() {
  await requireAuth()

  const { lots, jobs } = await getCachedScheduleData()

  const lotItems: LotItem[] = []
  const jobItems: JobItem[] = []
  const sitesById = new Map<string, string>()

  for (const lot of lots ?? []) {
    const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
    const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
    sitesById.set(site.id, site.name)
    lotItems.push({
      id: lot.id,
      siteId: site.id,
      siteName: site.name,
      stageId: stage.id,
      stageName: stage.name,
      lotId: lot.id,
      lotNumber: lot.lot_number,
      status: lot.status as LotStatus,
      dueDate: lot.due_date as string,
      tradesCompleted: [],
      readyForLandscaping: false,
    })
  }

  for (const job of jobs ?? []) {
    const stage = Array.isArray(job.stages) ? job.stages[0] : job.stages as { id: string; name: string; sites: unknown }
    const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
    sitesById.set(site.id, site.name)
    jobItems.push({
      id: job.id,
      siteId: site.id,
      siteName: site.name,
      stageId: stage.id,
      stageName: stage.name,
      title: job.title,
      status: job.status as ExtraJobStatus,
      dueDate: job.due_date as string,
    })
  }

  const lotIds = lotItems.map((item) => item.lotId)
  const tradeStatusMap = await getCachedTradeStatusByLotIds(lotIds)

  for (const item of lotItems) {
    const status = tradeStatusMap[item.lotId]
    item.tradesCompleted = status?.trades_completed ?? []
    item.readyForLandscaping = status?.ready_for_landscaping ?? false
  }

  const sites: SiteOption[] = [...sitesById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <h1 className="text-xl font-semibold text-fg">Schedule</h1>
        <ScheduleView lotItems={lotItems} jobItems={jobItems} sites={sites} today={today} />
      </div>
    </div>
  )
}
