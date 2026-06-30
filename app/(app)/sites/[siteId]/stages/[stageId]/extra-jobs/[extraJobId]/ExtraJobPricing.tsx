'use client'

import { useState, useTransition, useMemo } from 'react'
import { saveExtraJobPricing } from './pricing-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateItem = {
  id: string
  name: string
  unit: string
  unit_price: number | null
  is_auto_calculated: boolean
}

type TemplateSection = {
  id: string
  name: string
  order_index: number
  items: TemplateItem[]
}

type ExistingItem = {
  template_item_id: string | null
  description: string | null
  unit: string
  quantity: number | null
  unit_price: number | null
  item_type: string
}

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  sections: TemplateSection[]
  existingItems: ExistingItem[]
  canManage: boolean
  isAdmin: boolean
}

type AddItem = { desc: string; qty: string; unit: string; rate: string }

const INPUT = 'rounded-lg border border-border px-2 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg placeholder:text-fg-muted'
const NUM   = `${INPUT} w-20 text-right tabular-nums`

function fmt(n: number) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtraJobPricing({
  extraJobId, siteId, stageId, sections, existingItems, canManage, isAdmin,
}: Props) {

  // Initialise template values from existing items
  const initTemplate = () => {
    const v: Record<string, string> = {}
    for (const item of existingItems) {
      if (item.item_type === 'template' && item.template_item_id && item.quantity != null) {
        v[item.template_item_id] = String(item.quantity)
      }
    }
    return v
  }

  const initPreset = (type: string) => {
    const item = existingItems.find((i) => i.item_type === type)
    return item
      ? { hours: String(item.quantity ?? ''), rate: String(item.unit_price ?? '') }
      : { hours: '', rate: type === 'bobcat' ? '95' : '65' }
  }

  const initAdd = (type: string): AddItem => {
    const item = existingItems.find((i) => i.item_type === type)
    return item
      ? { desc: item.description ?? '', qty: String(item.quantity ?? ''), unit: item.unit, rate: String(item.unit_price ?? '') }
      : { desc: '', qty: '', unit: 'No.', rate: '' }
  }

  const [templateValues, setTemplateValues] = useState<Record<string, string>>(initTemplate)
  const [bobcat, setBobcat]                 = useState(initPreset('bobcat'))
  const [labour, setLabour]                 = useState(initPreset('labour'))
  const [add1, setAdd1]                     = useState<AddItem>(initAdd('additional_1'))
  const [add2, setAdd2]                     = useState<AddItem>(initAdd('additional_2'))

  const [error, setError]              = useState<string | null>(null)
  const [saved, setSaved]              = useState(false)
  const [isPending, startTransition]   = useTransition()

  const setVal = (id: string, v: string) => {
    setSaved(false)
    setTemplateValues((prev) => ({ ...prev, [id]: v }))
  }

  // Grand total
  const grandTotal = useMemo(() => {
    let total = 0
    for (const section of sections) {
      for (const item of section.items) {
        if (item.is_auto_calculated || item.unit === 'toggle' || item.unit === 'ITEM') continue
        if (item.unit_price == null) continue
        const qty = parseFloat(templateValues[item.id] || '0')
        if (qty > 0) total += qty * item.unit_price
      }
    }
    const bHrs = parseFloat(bobcat.hours || '0'); const bRate = parseFloat(bobcat.rate || '95')
    if (bHrs > 0) total += bHrs * (isNaN(bRate) ? 95 : bRate)
    const lHrs = parseFloat(labour.hours || '0'); const lRate = parseFloat(labour.rate || '65')
    if (lHrs > 0) total += lHrs * (isNaN(lRate) ? 65 : lRate)
    for (const add of [add1, add2]) {
      const qty = parseFloat(add.qty || '0'); const rate = parseFloat(add.rate || '0')
      if (qty > 0 && rate > 0) total += qty * rate
    }
    return total
  }, [sections, templateValues, bobcat, labour, add1, add2])

  function handleSave() {
    setSaved(false)
    setError(null)
    const fd = new FormData()
    fd.set('extra_job_id', extraJobId)
    fd.set('site_id', siteId)
    fd.set('stage_id', stageId)

    // Template items
    for (const section of sections) {
      for (const item of section.items) {
        const val = templateValues[item.id]
        if (val && parseFloat(val) > 0) {
          fd.set(`template_${item.id}`, val)
          fd.set(`unit_${item.id}`, item.unit)
        }
      }
    }

    fd.set('bobcat_hours', bobcat.hours)
    fd.set('bobcat_rate',  bobcat.rate)
    fd.set('labour_hours', labour.hours)
    fd.set('labour_rate',  labour.rate)
    fd.set('add1_desc', add1.desc); fd.set('add1_qty', add1.qty); fd.set('add1_unit', add1.unit); fd.set('add1_rate', add1.rate)
    fd.set('add2_desc', add2.desc); fd.set('add2_qty', add2.qty); fd.set('add2_unit', add2.unit); fd.set('add2_rate', add2.rate)

    startTransition(async () => {
      const result = await saveExtraJobPricing(null, fd)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Template sections */}
      {sections.map((section) => {
        const usableItems = section.items.filter(
          (i) => !i.is_auto_calculated && i.unit !== 'toggle' && i.unit !== 'ITEM'
        )
        if (usableItems.length === 0) return null
        return (
          <div key={section.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-raised border-b border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{section.name}</h4>
            </div>
            <div className="divide-y divide-border-subtle">
              {usableItems.map((item) => {
                const qty  = parseFloat(templateValues[item.id] || '0') || 0
                const line = isAdmin && item.unit_price != null && qty > 0 ? qty * item.unit_price : null
                return (
                  <div key={item.id} className={`grid ${isAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} gap-2 items-center px-4 py-2.5`}>
                    <span className="text-sm text-fg-secondary">{item.name}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" step="any"
                        value={templateValues[item.id] ?? ''}
                        onChange={(e) => setVal(item.id, e.target.value)}
                        disabled={!canManage}
                        placeholder="0"
                        className={NUM}
                      />
                      <span className="text-xs text-fg-muted w-8 shrink-0">{item.unit}</span>
                    </div>
                    {isAdmin && (item.unit_price != null
                      ? <span className="text-xs text-fg-muted tabular-nums">${item.unit_price.toFixed(2)}/unit</span>
                      : <span />)}
                    {isAdmin && (
                      <span className="text-sm font-medium text-fg-secondary tabular-nums min-w-[64px] text-right">
                        {line != null ? fmt(line) : <span className="text-fg-muted">—</span>}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Preset rate items */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-raised border-b border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">Preset rates</h4>
        </div>
        <div className="divide-y divide-border-subtle">
          {/* Bobcat */}
          {(['bobcat', 'labour'] as const).map((type) => {
            const state   = type === 'bobcat' ? bobcat : labour
            const setState = type === 'bobcat' ? setBobcat : setLabour
            const label    = type === 'bobcat' ? 'Bobcat' : 'Labour'
            const hrs  = parseFloat(state.hours || '0') || 0
            const rate = parseFloat(state.rate  || '0') || 0
            const line = isAdmin && hrs > 0 && rate > 0 ? hrs * rate : null
            return (
              <div key={type} className={`grid ${isAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} gap-2 items-center px-4 py-2.5`}>
                <span className="text-sm text-fg-secondary">{label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" step="0.5"
                    value={state.hours}
                    onChange={(e) => { setSaved(false); setState({ ...state, hours: e.target.value }) }}
                    disabled={!canManage}
                    placeholder="hrs"
                    className={NUM}
                  />
                  <span className="text-xs text-fg-muted w-8 shrink-0">hr</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-fg-muted">$</span>
                    <input
                      type="number" min="0" step="1"
                      value={state.rate}
                      onChange={(e) => { setSaved(false); setState({ ...state, rate: e.target.value }) }}
                      disabled={!canManage}
                      placeholder="rate"
                      className={`${INPUT} w-16 text-right tabular-nums`}
                    />
                    <span className="text-xs text-fg-muted">/hr</span>
                  </div>
                )}
                {isAdmin && (
                  <span className="text-sm font-medium text-fg-secondary tabular-nums min-w-[64px] text-right">
                    {line != null ? fmt(line) : <span className="text-fg-muted">—</span>}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Free-form additional items */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-raised border-b border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">Additional items</h4>
        </div>
        <div className="divide-y divide-border-subtle">
          {([add1, add2] as const).map((add, idx) => {
            const setAdd = idx === 0 ? setAdd1 : setAdd2
            const label  = `Additional Item ${idx + 1}`
            const qty    = parseFloat(add.qty  || '0') || 0
            const rate   = parseFloat(add.rate || '0') || 0
            const line   = isAdmin && qty > 0 && rate > 0 ? qty * rate : null
            return (
              <div key={idx} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-muted w-28 shrink-0">{label}</span>
                  <input
                    type="text"
                    value={add.desc}
                    onChange={(e) => { setSaved(false); setAdd({ ...add, desc: e.target.value }) }}
                    disabled={!canManage}
                    placeholder="Description"
                    className={`${INPUT} flex-1`}
                  />
                </div>
                <div className="flex items-center gap-2 pl-28">
                  <input
                    type="number" min="0" step="any"
                    value={add.qty}
                    onChange={(e) => { setSaved(false); setAdd({ ...add, qty: e.target.value }) }}
                    disabled={!canManage}
                    placeholder="Qty"
                    className={`${INPUT} w-16 text-right tabular-nums`}
                  />
                  <input
                    type="text"
                    value={add.unit}
                    onChange={(e) => { setSaved(false); setAdd({ ...add, unit: e.target.value }) }}
                    disabled={!canManage}
                    placeholder="Unit"
                    className={`${INPUT} w-14`}
                  />
                  {isAdmin && (
                    <>
                      <span className="text-xs text-fg-muted">@ $</span>
                      <input
                        type="number" min="0" step="any"
                        value={add.rate}
                        onChange={(e) => { setSaved(false); setAdd({ ...add, rate: e.target.value }) }}
                        disabled={!canManage}
                        placeholder="Rate"
                        className={`${INPUT} w-20 text-right tabular-nums`}
                      />
                      <span className="text-sm font-medium text-fg-secondary tabular-nums ml-auto min-w-[64px] text-right">
                        {line != null ? fmt(line) : <span className="text-fg-muted">—</span>}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grand total — admin only */}
      {isAdmin && grandTotal > 0 && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-fg-secondary">Grand Total (ex GST)</span>
          <span className="text-lg font-bold text-fg">{fmt(grandTotal)}</span>
        </div>
      )}

      {/* Feedback + save */}
      {error  && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved  && <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">Saved successfully.</p>}

      {canManage && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save pricing'}
        </button>
      )}
    </div>
  )
}
