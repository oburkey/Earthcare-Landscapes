'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  createSection, updateSectionName,
  toggleSectionActive, toggleSectionAdminOnly,
  moveSectionUp, moveSectionDown,
  createItem, updateItem, toggleItemActive, moveItemUp, moveItemDown,
} from './actions'

type Section = {
  id: string
  name: string
  order_index: number
  is_active: boolean
  admin_only: boolean
  quote_template_items: Item[]
}

type Item = {
  id: string
  name: string
  unit: string
  unit_price: number | null
  is_auto_calculated: boolean
  auto_calc_formula: string | null
  plant_category: string | null
  order_index: number
  is_active: boolean
}

const UNIT_OPTIONS = ['No.', 'm²', 'm³', 'Lm', 'tonne', 'ITEM', 'toggle']

// ── Subcomponent: single item row ─────────────────────────────────────────────

function ItemRow({ item, sectionId, isFirst, isLast }: {
  item: Item
  sectionId: string
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editState, editAction, editPending] = useActionState(updateItem, null)
  const [, startToggle] = useTransition()
  const [, startMove] = useTransition()

  if (editing) {
    return (
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
        <form action={async (fd) => { await editAction(fd); setEditing(false) }} className="space-y-2">
          <input type="hidden" name="item_id" value={item.id} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <input
                name="name"
                defaultValue={item.name}
                required
                placeholder="Item name"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <select
                name="unit"
                defaultValue={item.unit}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              >
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <input
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.unit_price ?? ''}
                placeholder="Unit price $"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
          </div>
          {editState?.error && (
            <p className="text-xs text-red-600">{editState.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={editPending}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {editPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`px-4 py-2.5 border-b border-stone-100 ${!item.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Reorder — bigger touch targets on mobile */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <form action={moveItemUp}>
            <input type="hidden" name="item_id"    value={item.id} />
            <input type="hidden" name="section_id" value={sectionId} />
            <button
              type="submit"
              disabled={isFirst}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveItemUp(fd) }) }}
              className="flex items-center justify-center w-8 h-8 sm:w-5 sm:h-5 rounded text-stone-400 hover:text-stone-600 disabled:opacity-20"
            >
              <svg className="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
          </form>
          <form action={moveItemDown}>
            <input type="hidden" name="item_id"    value={item.id} />
            <input type="hidden" name="section_id" value={sectionId} />
            <button
              type="submit"
              disabled={isLast}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveItemDown(fd) }) }}
              className="flex items-center justify-center w-8 h-8 sm:w-5 sm:h-5 rounded text-stone-400 hover:text-stone-600 disabled:opacity-20"
            >
              <svg className="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </form>
        </div>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-stone-800 truncate">{item.name}</span>
          {item.is_auto_calculated && (
            <span className="ml-2 text-xs text-blue-600 font-medium">auto</span>
          )}
          {item.plant_category && (
            <span className="ml-1 text-xs text-green-600">({item.plant_category})</span>
          )}
        </div>

        {/* Unit — desktop only */}
        <span className="hidden sm:block text-xs text-stone-500 shrink-0 w-14 text-center">{item.unit}</span>

        {/* Price — desktop only */}
        <span className="hidden sm:block text-xs text-stone-700 shrink-0 w-16 text-right">
          {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : <span className="text-stone-300">—</span>}
        </span>

        {/* Actions — desktop only */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {!item.is_auto_calculated && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Edit
            </button>
          )}
          <form action={toggleItemActive}>
            <input type="hidden" name="item_id"   value={item.id} />
            <input type="hidden" name="is_active" value={String(item.is_active)} />
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); startToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleItemActive(fd) }) }}
              className={`rounded px-2 py-1 text-xs font-medium ${item.is_active ? 'text-stone-500 hover:bg-stone-100' : 'text-green-700 hover:bg-green-50'}`}
            >
              {item.is_active ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      </div>

      {/* Mobile-only second row: unit + price + actions below the name */}
      <div className="sm:hidden flex items-center gap-3 mt-1.5 pl-10">
        <span className="text-xs text-stone-500">{item.unit}</span>
        <span className="text-xs text-stone-700">
          {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : <span className="text-stone-300">—</span>}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {!item.is_auto_calculated && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Edit
            </button>
          )}
          <form action={toggleItemActive}>
            <input type="hidden" name="item_id"   value={item.id} />
            <input type="hidden" name="is_active" value={String(item.is_active)} />
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); startToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleItemActive(fd) }) }}
              className={`rounded px-2 py-1 text-xs font-medium ${item.is_active ? 'text-stone-500 hover:bg-stone-100' : 'text-green-700 hover:bg-green-50'}`}
            >
              {item.is_active ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponent: add item form ───────────────────────────────────────────────

function AddItemForm({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createItem, null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 text-left border-t border-stone-100"
      >
        + Add item
      </button>
    )
  }

  return (
    <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
      <form action={async (fd) => { await action(fd); setOpen(false) }} className="space-y-2">
        <input type="hidden" name="section_id" value={sectionId} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-1">
            <input
              name="name"
              required
              placeholder="Item name"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <select
              name="unit"
              defaultValue="No."
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <input
              name="unit_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Unit price $"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add item'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Subcomponent: section card ────────────────────────────────────────────────

function SectionCard({ section, isFirst, isLast }: {
  section: Section
  isFirst: boolean
  isLast: boolean
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameState, nameAction, namePending] = useActionState(updateSectionName, null)
  const [, startToggle]       = useTransition()
  const [, startAdminToggle]  = useTransition()
  const [, startMove]         = useTransition()

  return (
    <div className={`rounded-xl border border-stone-200 bg-white overflow-hidden ${!section.is_active ? 'opacity-60' : ''}`}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
        {/* Section reorder */}
        <div className="flex gap-0.5 shrink-0">
          <form action={moveSectionUp}>
            <input type="hidden" name="section_id" value={section.id} />
            <button
              type="submit"
              disabled={isFirst}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveSectionUp(fd) }) }}
              className="flex items-center justify-center w-6 h-6 rounded text-stone-400 hover:text-stone-600 disabled:opacity-20"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
          </form>
          <form action={moveSectionDown}>
            <input type="hidden" name="section_id" value={section.id} />
            <button
              type="submit"
              disabled={isLast}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveSectionDown(fd) }) }}
              className="flex items-center justify-center w-6 h-6 rounded text-stone-400 hover:text-stone-600 disabled:opacity-20"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </form>
        </div>

        {/* Name */}
        {editingName ? (
          <form action={async (fd) => { await nameAction(fd); setEditingName(false) }} className="flex-1 flex items-center gap-2">
            <input type="hidden" name="section_id" value={section.id} />
            <input
              name="name"
              defaultValue={section.name}
              required
              autoFocus
              className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm font-semibold focus:border-green-600 focus:outline-none"
            />
            {nameState?.error && <span className="text-xs text-red-600">{nameState.error}</span>}
            <button type="submit" disabled={namePending} className="text-xs text-green-700 font-medium hover:underline disabled:opacity-50">
              {namePending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditingName(false)} className="text-xs text-stone-500 hover:underline">Cancel</button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex-1 text-sm font-semibold text-stone-800 text-left hover:text-green-700"
          >
            {section.name}
          </button>
        )}

        {/* Admin-only badge + toggle */}
        {section.admin_only && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 shrink-0">
            Admin only
          </span>
        )}
        <form action={toggleSectionAdminOnly}>
          <input type="hidden" name="section_id"  value={section.id} />
          <input type="hidden" name="admin_only"   value={String(section.admin_only)} />
          <button
            type="submit"
            onClick={(e) => { e.preventDefault(); startAdminToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleSectionAdminOnly(fd) }) }}
            className="rounded px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200"
          >
            {section.admin_only ? 'Make public' : 'Admin only'}
          </button>
        </form>

        {/* Toggle active */}
        <form action={toggleSectionActive}>
          <input type="hidden" name="section_id" value={section.id} />
          <input type="hidden" name="is_active"  value={String(section.is_active)} />
          <button
            type="submit"
            onClick={(e) => { e.preventDefault(); startToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleSectionActive(fd) }) }}
            className={`rounded px-2.5 py-1 text-xs font-medium ${section.is_active ? 'text-stone-500 hover:bg-stone-200' : 'text-green-700 hover:bg-green-100'}`}
          >
            {section.is_active ? 'Disable' : 'Enable'}
          </button>
        </form>
      </div>

      {/* Column headers — desktop only */}
      <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-stone-50 border-b border-stone-100">
        <div className="w-9 shrink-0" />
        <div className="flex-1 text-xs font-medium text-stone-400">Item</div>
        <div className="w-14 text-xs font-medium text-stone-400 text-center">Unit</div>
        <div className="w-16 text-xs font-medium text-stone-400 text-right">$/unit</div>
        <div className="w-24 shrink-0" />
      </div>

      {/* Items */}
      {section.quote_template_items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">No items yet.</p>
      ) : (
        section.quote_template_items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            sectionId={section.id}
            isFirst={i === 0}
            isLast={i === section.quote_template_items.length - 1}
          />
        ))
      )}

      <AddItemForm sectionId={section.id} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MaterialsSettings({ sections }: { sections: Section[] }) {
  const [addState, addAction, addPending] = useActionState(createSection, null)

  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <SectionCard
          key={s.id}
          section={s}
          isFirst={i === 0}
          isLast={i === sections.length - 1}
        />
      ))}

      {/* Add section */}
      <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4">
        <p className="text-sm font-medium text-stone-700 mb-2">Add section</p>
        <form action={addAction} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Section name"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
          <button
            type="submit"
            disabled={addPending}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 shrink-0"
          >
            {addPending ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addState?.error && <p className="mt-1 text-xs text-red-600">{addState.error}</p>}
      </div>
    </div>
  )
}
