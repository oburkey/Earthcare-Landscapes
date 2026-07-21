'use client'

import { useActionState, useState } from 'react'
import {
  createOrder, deleteOrder, submitOrder, holdOrder, reactivateOrder, markOrderDelivered,
  uploadOrderAttachment, deleteOrderAttachment,
  ORDER_ITEM_CATEGORIES, type OrderItemPayload,
} from './orders-actions'
import type { ActionState } from '@/types/actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'draft' | 'ordered' | 'on_hold' | 'delivered'

export type OrderItemRow = {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unitPrice: number | null
  notes: string | null
}

export type OrderAttachmentRow = {
  id: string
  attachmentType: string
  fileName: string
  url: string
}

export type OrderRow = {
  id: string
  siteId: string
  siteName: string
  supplierId: string | null
  supplierName: string | null
  orderDate: string
  deliveryDate: string | null
  status: OrderStatus
  notes: string | null
  invoiceAmount: number | null
  items: OrderItemRow[]
  attachments: OrderAttachmentRow[]
}

export type SiteOption = { id: string; name: string }
export type SupplierOption = { id: string; name: string }

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft', ordered: 'Ordered', on_hold: 'On Hold', delivered: 'Delivered',
}
const STATUS_CLASSES: Record<OrderStatus, string> = {
  draft:     'bg-surface-raised text-fg-muted',
  ordered:   'bg-blue-100 text-blue-700',
  on_hold:   'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
}

function emptyItem(): OrderItemPayload {
  return { category: ORDER_ITEM_CATEGORIES[0], description: '', quantity: 0, unit: '', unit_price: null, notes: '' }
}

// ── New order form ────────────────────────────────────────────────────────────

function NewOrderForm({ sites, suppliers, onDone }: {
  sites: SiteOption[]; suppliers: SupplierOption[]; onDone: () => void
}) {
  const [items, setItems] = useState<OrderItemPayload[]>([emptyItem()])
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      formData.set('items', JSON.stringify(items))
      const result = await createOrder(prev, formData)
      if (!result) onDone()
      return result
    },
    null
  )

  function updateItem(i: number, patch: Partial<OrderItemPayload>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function submitWithStatus(status: 'draft' | 'ordered', e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest('form')
    if (!form) return
    const hidden = form.querySelector('input[name="status"]') as HTMLInputElement | null
    if (hidden) hidden.value = status
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <h2 className="text-sm font-semibold text-fg-secondary">New order</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="status" value="draft" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Site <span className="text-red-500">*</span></label>
            <select
              name="site_id" required defaultValue=""
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              <option value="" disabled>Select a site…</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Supplier</label>
            <select
              name="supplier_id" defaultValue=""
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Order date</label>
            <input
              name="order_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Expected delivery date</label>
            <input
              name="delivery_date" type="date"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Notes</label>
          <textarea
            name="notes" rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-fg-muted">Line items</label>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="text-xs font-medium text-accent-fg hover:underline"
            >
              + Add item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(i, { category: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
                  >
                    {ORDER_ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text" placeholder="Description" value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    className="col-span-2 sm:col-span-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
                  />
                  <input
                    type="number" step="0.01" min="0" placeholder="Qty" value={item.quantity || ''}
                    onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
                  />
                  <input
                    type="text" placeholder="Unit" value={item.unit}
                    onChange={(e) => updateItem(i, { unit: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number" step="0.01" min="0" placeholder="Unit price"
                    value={item.unit_price ?? ''}
                    onChange={(e) => updateItem(i, { unit_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text" placeholder="Notes" value={item.notes}
                      onChange={(e) => updateItem(i, { notes: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            onClick={(e) => submitWithStatus('draft', e)}
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            onClick={(e) => submitWithStatus('ordered', e)}
            disabled={pending}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save & Mark Ordered'}
          </button>
          <button type="button" onClick={onDone} className="text-sm text-fg-muted hover:text-fg-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Deliver confirmation ──────────────────────────────────────────────────────

function DeliverForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [updateStock, setUpdateStock] = useState(true)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await markOrderDelivered(prev, formData)
      if (!result) onDone()
      return result
    },
    null
  )

  return (
    <form action={formAction} className="rounded-lg border border-green-200 bg-accent-dim p-3 space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-sm font-medium text-fg-secondary">Confirm delivery</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Actual delivery date</label>
          <input
            name="delivered_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Invoice amount</label>
          <input
            name="invoice_amount" type="number" step="0.01" min="0" placeholder="0.00"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-fg-secondary">
        <input
          type="checkbox" checked={updateStock}
          onChange={(e) => setUpdateStock(e.target.checked)}
          className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600"
        />
        <input type="hidden" name="update_stock" value={updateStock ? 'true' : 'false'} />
        Update site stock with delivered quantities (Mulch, Edging, Turf, Drippers only — plant pot sizes aren&apos;t tracked on order lines)
      </label>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Confirm delivery'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-fg-muted hover:text-fg-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Status actions ────────────────────────────────────────────────────────────

function StatusButton({ action, orderId, label, className }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  orderId: string; label: string; className: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <button type="submit" disabled={pending} className={className}>
          {pending ? '…' : label}
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  )
}

// ── Attachments ───────────────────────────────────────────────────────────────

function AttachmentUpload({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadOrderAttachment, null)
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="order_id" value={orderId} />
      <select
        name="attachment_type" defaultValue="invoice"
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
      >
        <option value="invoice">Invoice</option>
        <option value="photo">Photo</option>
        <option value="document">Document</option>
      </select>
      <input
        name="file" type="file" required
        className="text-xs text-fg-muted file:mr-2 file:rounded-lg file:border-0 file:bg-surface-raised file:px-2 file:py-1 file:text-xs file:font-medium file:text-fg-secondary hover:file:bg-border"
      />
      <button
        type="submit" disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
      >
        {pending ? 'Uploading…' : 'Upload'}
      </button>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  )
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderCard({ order, canManage, isAdmin }: { order: OrderRow; canManage: boolean; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const itemCount = order.items.length

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-raised transition-colors"
      >
        <svg className={`h-3.5 w-3.5 text-fg-muted shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg-secondary truncate">
            {order.supplierName ?? 'No supplier'}
            <span className="text-fg-muted font-normal"> · {order.siteName}</span>
          </p>
          <p className="text-xs text-fg-muted">
            {fmtDate(order.orderDate)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
            {order.status === 'delivered' && order.invoiceAmount != null && <> · {fmt(order.invoiceAmount)}</>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-5 py-4 space-y-4">
          {order.notes && <p className="text-sm text-fg-muted italic">{order.notes}</p>}
          {order.deliveryDate && (
            <p className="text-xs text-fg-muted">
              {order.status === 'delivered' ? 'Delivered' : 'Expected'}: {fmtDate(order.deliveryDate)}
            </p>
          )}

          {/* Line items */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="text-left font-medium pb-1.5 pr-2">Category</th>
                  <th className="text-left font-medium pb-1.5 pr-2">Description</th>
                  <th className="text-right font-medium pb-1.5 pr-2">Qty</th>
                  <th className="text-left font-medium pb-1.5 pr-2">Unit</th>
                  <th className="text-right font-medium pb-1.5 pr-2">Unit price</th>
                  <th className="text-left font-medium pb-1.5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle">
                    <td className="py-1.5 pr-2 text-fg-secondary">{item.category}</td>
                    <td className="py-1.5 pr-2 text-fg-muted">{item.description || '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-fg-muted">{item.quantity}</td>
                    <td className="py-1.5 pr-2 text-fg-muted">{item.unit || '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-fg-muted">{item.unitPrice != null ? fmt(item.unitPrice) : '—'}</td>
                    <td className="py-1.5 text-fg-muted">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attachments */}
          <div className="space-y-2 border-t border-border-subtle pt-3">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Attachments</p>
            {order.attachments.length === 0 ? (
              <p className="text-sm text-fg-muted">No attachments yet.</p>
            ) : (
              <ul className="space-y-1">
                {order.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline truncate">
                      {a.fileName}
                    </a>
                    <span className="shrink-0 flex items-center gap-2">
                      <span className="text-xs text-fg-muted capitalize">{a.attachmentType}</span>
                      {canManage && (
                        <form action={async (fd) => { await deleteOrderAttachment(null, fd) }}>
                          <input type="hidden" name="attachment_id" value={a.id} />
                          <button type="submit" className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canManage && <AttachmentUpload orderId={order.id} />}
          </div>

          {/* Status flow */}
          {canManage && order.status !== 'delivered' && (
            <div className="border-t border-border-subtle pt-3">
              {delivering ? (
                <DeliverForm orderId={order.id} onDone={() => setDelivering(false)} />
              ) : (
                <div className="flex flex-wrap items-start gap-2">
                  {order.status === 'draft' && (
                    <StatusButton
                      action={submitOrder} orderId={order.id} label="Submit Order"
                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    />
                  )}
                  {order.status === 'ordered' && (
                    <StatusButton
                      action={holdOrder} orderId={order.id} label="Put On Hold"
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
                    />
                  )}
                  {order.status === 'on_hold' && (
                    <StatusButton
                      action={reactivateOrder} orderId={order.id} label="Reactivate"
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setDelivering(true)}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                  >
                    Mark Delivered
                  </button>
                </div>
              )}
            </div>
          )}

          {order.status === 'delivered' && isAdmin && (
            <div className="border-t border-border-subtle pt-3">
              <form action={async (fd) => { await deleteOrder(null, fd) }}>
                <input type="hidden" name="order_id" value={order.id} />
                <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                  Delete order
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Filter panel ──────────────────────────────────────────────────────────────

type Filters = { siteId: string; status: string; from: string; to: string }

function FilterPanel({ sites, filters, onChange, onClose }: {
  sites: SiteOption[]; filters: Filters; onChange: (f: Filters) => void; onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Site</label>
          <select
            value={filters.siteId}
            onChange={(e) => onChange({ ...filters, siteId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none"
          >
            <option value="">All sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">From date</label>
          <input
            type="date" value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">To date</label>
          <input
            type="date" value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ siteId: '', status: '', from: '', to: '' })}
          className="text-xs font-medium text-fg-muted hover:text-fg-secondary"
        >
          Clear filters
        </button>
        <button type="button" onClick={onClose} className="text-xs font-medium text-accent-fg hover:underline">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrdersTab({ orders, sites, suppliers, canManage, isAdmin, tableExists }: {
  orders: OrderRow[]
  sites: SiteOption[]
  suppliers: SupplierOption[]
  canManage: boolean
  isAdmin: boolean
  tableExists: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({ siteId: '', status: '', from: '', to: '' })

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">
          The material orders tables haven&apos;t been created yet. Run the SQL migration to enable this tab.
        </p>
      </div>
    )
  }

  const filtered = orders
    .filter((o) => !filters.siteId || o.siteId === filters.siteId)
    .filter((o) => !filters.status || o.status === filters.status)
    .filter((o) => !filters.from || o.orderDate >= filters.from)
    .filter((o) => !filters.to || o.orderDate <= filters.to)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised"
        >
          {showFilters ? 'Hide filters' : 'Filter'}
        </button>
        {canManage && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            + New Order
          </button>
        )}
      </div>

      {showFilters && (
        <FilterPanel sites={sites} filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
      )}

      {creating && canManage && (
        <NewOrderForm sites={sites} suppliers={suppliers} onDone={() => setCreating(false)} />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-fg-muted">No orders{orders.length > 0 ? ' match these filters' : ' yet'}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} canManage={canManage} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
