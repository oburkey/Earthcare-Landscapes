import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getCachedMaterialsPlanningData, getCachedPlantRatioSettings, getCachedSitesList } from '@/lib/data'
import { getR2SignedUrlSafe } from '@/lib/r2'
import { buildMaterialsPlan, getMaterialsDateRange, type MaterialsLotRow, type MaterialsExtraJobRow, type RatioSettingRow } from './lib'
import MaterialsTabs from './MaterialsTabs'
import type { OrderRow, SiteOption as OrdersSiteOption, SupplierOption } from './OrdersTab'
import type { SiteStockRow, SiteOption as StockSiteOption } from './StockTab'
import type { ConversionSettingRow } from './SettingsTab'
import type { RatioRow, SiteOption as PlantRatioSiteOption } from './PlantRatiosSettings'

export const metadata = { title: 'Materials — Earthcare Landscapes' }

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || !!error.message?.includes('does not exist')
}

export default async function MaterialsPage() {
  const profile = await requireAuth()
  requireRole(profile, 'worker')

  const showPlanning   = profile.role === 'supervisor' || profile.role === 'admin'
  const canManageOrders = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canEditStock    = canManageOrders
  const isAdmin          = profile.role === 'admin'

  const supabase = await createClient()

  // ── Planning tab data (unchanged) ─────────────────────────────────────────
  // ratioSettings is also used below by the Settings tab's Plant Ratios
  // section, so it's fetched unconditionally rather than gated on showPlanning.
  const { startDate, endDate, months } = getMaterialsDateRange()
  const [planningData, ratioSettings] = await Promise.all([
    showPlanning ? getCachedMaterialsPlanningData(startDate, endDate) : Promise.resolve({ lots: [], jobs: [] }),
    getCachedPlantRatioSettings(),
  ])
  const plan = showPlanning
    ? buildMaterialsPlan(
        planningData as { lots: MaterialsLotRow[]; jobs: MaterialsExtraJobRow[] },
        ratioSettings as RatioSettingRow[],
        months
      )
    : []
  const lotSitePlanUrls: Record<string, string> = {}
  for (const month of plan) {
    for (const site of month.sites) {
      for (const lot of site.lots) {
        if (lot.sitePlanPath) {
          lotSitePlanUrls[lot.id] = await getR2SignedUrlSafe(lot.sitePlanPath)
        }
      }
    }
  }

  // ── Shared: active sites + supplier contacts ──────────────────────────────
  const [{ data: sitesRaw }, { data: suppliersRaw }] = await Promise.all([
    supabase.from('sites').select('id, name').is('completed_at', null).order('name'),
    supabase.from('contacts').select('id, name, company, category').in('category', ['Nursery', 'Materials Suppliers']).order('company'),
  ])
  const sites: OrdersSiteOption[] = (sitesRaw ?? []).map((s) => ({ id: s.id, name: s.name }))
  // Supplier dropdown shows the company name (falling back to the contact's
  // own name if no company is set), with category in brackets for clarity.
  const suppliers: SupplierOption[] = (suppliersRaw ?? []).map((s) => ({
    id: s.id,
    name: `${s.company || s.name}${s.category ? ` [${s.category}]` : ''}`,
  }))

  // ── Plant Ratios (Settings tab, admin only) ───────────────────────────────
  // Uses all sites (not just active ones), matching the original
  // /settings/plant-ratios page's site-override options.
  const plantRatioRows = ratioSettings as unknown as RatioRow[]
  const plantRatiosGlobal: RatioRow | null = plantRatioRows.find((r) => r.site_id === null) ?? null
  const plantRatiosOverrides: RatioRow[] = plantRatioRows.filter((r) => r.site_id !== null)
  const allSitesForRatios = isAdmin ? await getCachedSitesList() : []
  const plantRatiosSites: PlantRatioSiteOption[] = allSitesForRatios.map((s) => ({ id: s.id, name: s.name }))

  // ── Orders tab data ────────────────────────────────────────────────────────
  let orders: OrderRow[] = []
  let ordersTableExists = true
  try {
    const { data, error } = await supabase
      .from('material_orders')
      .select(`
        id, site_id, supplier_id, order_date, delivery_date, status, notes, invoice_amount,
        sites(name), contacts(name),
        material_order_items(id, category, description, quantity, unit, unit_price, notes, order_index),
        material_order_attachments(id, attachment_type, storage_path, file_name)
      `)
      .order('order_date', { ascending: false })
      .limit(200)

    if (isMissingTable(error)) {
      ordersTableExists = false
    } else if (data) {
      orders = await Promise.all(
        data.map(async (o): Promise<OrderRow> => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const site = Array.isArray(o.sites) ? (o.sites as any)[0] : (o.sites as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const supplier = Array.isArray(o.contacts) ? (o.contacts as any)[0] : (o.contacts as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = ((o.material_order_items ?? []) as any[])
            .sort((a, b) => a.order_index - b.order_index)
            .map((i) => ({
              id:          i.id as string,
              category:    i.category as string,
              description: (i.description ?? '') as string,
              quantity:    Number(i.quantity ?? 0),
              unit:        (i.unit ?? '') as string,
              unitPrice:   i.unit_price != null ? Number(i.unit_price) : null,
              notes:       i.notes as string | null,
            }))
          const attachments = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((o.material_order_attachments ?? []) as any[]).map(async (a) => ({
              id:             a.id as string,
              attachmentType: a.attachment_type as string,
              fileName:       a.file_name as string,
              url:            await getR2SignedUrlSafe(a.storage_path),
            }))
          )
          return {
            id:            o.id,
            siteId:        o.site_id,
            siteName:      site?.name ?? '—',
            supplierId:    o.supplier_id,
            supplierName:  supplier?.name ?? null,
            orderDate:     o.order_date,
            deliveryDate:  o.delivery_date,
            status:        o.status,
            notes:         o.notes,
            invoiceAmount: o.invoice_amount != null ? Number(o.invoice_amount) : null,
            items,
            attachments,
          }
        })
      )
    }
  } catch {
    ordersTableExists = false
  }

  // ── Stock tab data ─────────────────────────────────────────────────────────
  let stockBySite: Record<string, SiteStockRow> = {}
  let stockTableExists = true
  try {
    const { data, error } = await supabase
      .from('site_stock')
      .select('site_id, plants_140mm, plants_200mm, mulch_tonnes, edging_metres, turf_rolls, drippers_packs, updated_at, profiles(first_name, last_name)')

    if (isMissingTable(error)) {
      stockTableExists = false
    } else if (data) {
      stockBySite = Object.fromEntries(
        data.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updater = Array.isArray(r.profiles) ? (r.profiles as any)[0] : (r.profiles as any)
          const row: SiteStockRow = {
            siteId:            r.site_id,
            plants140mm:       Number(r.plants_140mm ?? 0),
            plants200mm:       Number(r.plants_200mm ?? 0),
            mulchTonnes:       Number(r.mulch_tonnes ?? 0),
            edgingMetres:      Number(r.edging_metres ?? 0),
            turfRolls:         Number(r.turf_rolls ?? 0),
            drippersPacks:     Number(r.drippers_packs ?? 0),
            lastUpdatedByName: updater ? `${updater.first_name ?? ''} ${updater.last_name ?? ''}`.trim() || null : null,
            updatedAt:         r.updated_at,
          }
          return [r.site_id, row]
        })
      )
    }
  } catch {
    stockTableExists = false
  }
  const stockSites: StockSiteOption[] = sites

  // ── Settings tab data ─────────────────────────────────────────────────────
  let conversionSettings: ConversionSettingRow[] = []
  let conversionSettingsTableExists = true
  try {
    const { data, error } = await supabase
      .from('material_conversion_settings')
      .select('id, name, unit_from, unit_to, conversion_rate, wastage_pct, notes')
      .order('order_index')

    if (isMissingTable(error)) {
      conversionSettingsTableExists = false
    } else if (data) {
      conversionSettings = data.map((s) => ({
        id:              s.id,
        name:            s.name,
        unit_from:       s.unit_from,
        unit_to:         s.unit_to,
        conversion_rate: Number(s.conversion_rate),
        wastage_pct:     Number(s.wastage_pct),
        notes:           s.notes,
      }))
    }
  } catch {
    conversionSettingsTableExists = false
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">Materials</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Planning, ordering, and stock tracking for landscaping materials.
        </p>
      </div>
      <MaterialsTabs
        months={plan}
        lotSitePlanUrls={lotSitePlanUrls}
        orders={orders}
        ordersSites={sites}
        suppliers={suppliers}
        ordersTableExists={ordersTableExists}
        stockSites={stockSites}
        stockBySite={stockBySite}
        stockTableExists={stockTableExists}
        conversionSettings={conversionSettings}
        conversionSettingsTableExists={conversionSettingsTableExists}
        plantRatiosGlobal={plantRatiosGlobal}
        plantRatiosOverrides={plantRatiosOverrides}
        plantRatiosSites={plantRatiosSites}
        showPlanning={showPlanning}
        canManageOrders={canManageOrders}
        canEditStock={canEditStock}
        isAdmin={isAdmin}
      />
    </div>
  )
}
