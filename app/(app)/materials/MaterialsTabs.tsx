'use client'

import { useState } from 'react'
import MaterialsView from './MaterialsView'
import OrdersTab, { type OrderRow, type SiteOption as OrdersSiteOption, type SupplierOption } from './OrdersTab'
import StockTab, { type SiteStockRow, type SiteOption as StockSiteOption } from './StockTab'
import SettingsTab, { type ConversionSettingRow, type ConversionLinkRow } from './SettingsTab'
import type { RatioRow, SiteOption as PlantRatioSiteOption } from './PlantRatiosSettings'
import type { MonthMaterialGroup } from './lib'

type Tab = 'planning' | 'orders' | 'stock' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'orders',   label: 'Orders' },
  { id: 'stock',    label: 'Stock' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  // Planning
  months: MonthMaterialGroup[]
  lotSitePlanUrls: Record<string, string>
  // Orders
  orders: OrderRow[]
  ordersSites: OrdersSiteOption[]
  suppliers: SupplierOption[]
  ordersTableExists: boolean
  // Stock
  stockSites: StockSiteOption[]
  stockBySite: Record<string, SiteStockRow>
  stockTableExists: boolean
  // Settings
  conversionSettings: ConversionSettingRow[]
  conversionSettingsTableExists: boolean
  conversionLinks: ConversionLinkRow[]
  conversionLinksTableExists: boolean
  plantRatiosGlobal: RatioRow | null
  plantRatiosOverrides: RatioRow[]
  plantRatiosSites: PlantRatioSiteOption[]
  // Access
  showPlanning: boolean
  canManageOrders: boolean
  canEditStock: boolean
  isAdmin: boolean
}

export default function MaterialsTabs({
  months, lotSitePlanUrls,
  orders, ordersSites, suppliers, ordersTableExists,
  stockSites, stockBySite, stockTableExists,
  conversionSettings, conversionSettingsTableExists,
  conversionLinks, conversionLinksTableExists,
  plantRatiosGlobal, plantRatiosOverrides, plantRatiosSites,
  showPlanning, canManageOrders, canEditStock, isAdmin,
}: Props) {
  const visibleTabs = TABS.filter((t) => t.id !== 'planning' || showPlanning)
  const [active, setActive] = useState<Tab>(visibleTabs[0]?.id ?? 'orders')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-green-700 text-white'
                : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'planning' && showPlanning && (
        <MaterialsView months={months} lotSitePlanUrls={lotSitePlanUrls} />
      )}

      {active === 'orders' && (
        <OrdersTab
          orders={orders}
          sites={ordersSites}
          suppliers={suppliers}
          canManage={canManageOrders}
          isAdmin={isAdmin}
          tableExists={ordersTableExists}
          conversionSettings={conversionSettings}
          conversionLinks={conversionLinks}
        />
      )}

      {active === 'stock' && (
        <StockTab
          sites={stockSites}
          stockBySite={stockBySite}
          canEdit={canEditStock}
          tableExists={stockTableExists}
        />
      )}

      {active === 'settings' && (
        <SettingsTab
          settings={conversionSettings}
          isAdmin={isAdmin}
          tableExists={conversionSettingsTableExists}
          conversionLinks={conversionLinks}
          conversionLinksTableExists={conversionLinksTableExists}
          plantRatiosGlobal={plantRatiosGlobal}
          plantRatiosOverrides={plantRatiosOverrides}
          plantRatiosSites={plantRatiosSites}
        />
      )}
    </div>
  )
}
