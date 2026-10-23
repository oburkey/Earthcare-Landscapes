'use client'

import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
  type DraggableAttributes, type DraggableSyntheticListeners,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Drag-and-drop for "sections of line items" editors — the quote builder
// (quotes/QuotesView.tsx) and Settings → Quote Templates. Sections reorder
// among themselves; items reorder within a section or move to another one.
// Dragging only starts from a <DragHandle>, so typing in fields is unaffected.
//
// Every section and item needs a stable client-side `uid` (see newUid /
// withUids) — DB ids aren't enough since unsaved rows don't have one yet.
//
// With `withDivider`, a fixed "Total" divider sits in the section list:
// sections below it are optional (excludeFromTotal). Sections must be kept
// ordered with all included ones first — the loaders sort that way and
// dropping a section re-derives every flag from its side of the divider.

type Orderable = { uid?: string; orderIndex: number }
type SectionShape<I extends Orderable> = Orderable & { items: I[]; excludeFromTotal?: boolean }

const SECTION = 's:'
const ITEM = 'i:'
const DIVIDER = 'd:total'

// Position of the total divider = number of included sections.
export function dividerIndex(sections: { excludeFromTotal?: boolean }[]): number {
  const idx = sections.findIndex((s) => s.excludeFromTotal)
  return idx < 0 ? sections.length : idx
}

let uidCounter = 0
export function newUid(): string {
  uidCounter += 1
  return `k${uidCounter}`
}

// Fills in a uid on any section/item that doesn't have one yet — call
// wherever sections enter an editor (open existing, apply template, etc.).
export function withUids<I extends Orderable, S extends SectionShape<I>>(sections: S[]): S[] {
  return sections.map((s) => ({
    ...s,
    uid: s.uid ?? newUid(),
    items: s.items.map((i) => ({ ...i, uid: i.uid ?? newUid() })),
  }) as S)
}

function reindex<T extends { orderIndex: number }>(arr: T[]): T[] {
  return arr.map((item, i) => ({ ...item, orderIndex: i }))
}

export function sectionLabel(section: { name: string }, idx: number): string {
  return section.name.trim() || `Section ${idx + 1}`
}

// Shown in a section once every item has been dragged/moved out of it. The
// whole section card stays a drop target, so items can be dragged back in.
export function EmptySectionNotice({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded border border-dashed border-border px-3 py-3 text-sm text-fg-muted">
      <span>No line items — drag one here or add a line.</span>
      <button
        type="button"
        onClick={onDelete}
        className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
      >
        Delete section
      </button>
    </div>
  )
}

export type DragHandleProps = {
  setActivatorRef: (el: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

export function DragHandle({
  handle: { setActivatorRef, attributes, listeners }, label,
}: { handle: DragHandleProps; label: string }) {
  return (
    <button
      type="button"
      ref={setActivatorRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      // touch-none stops iPad Safari scrolling the page instead of dragging.
      className="shrink-0 touch-none cursor-grab active:cursor-grabbing select-none rounded px-1.5 py-1 text-base leading-none text-fg-muted hover:text-fg-secondary hover:bg-surface"
    >
      ⋮⋮
    </button>
  )
}

export function SortableSections<I extends Orderable, S extends SectionShape<I>>({
  sections, onChange, onDrop, sectionLabel, itemLabel, withDivider = false, children,
}: {
  sections: S[]
  // Render a <SortableTotalDivider> at dividerIndex(sections) among the
  // section cards when this is set.
  withDivider?: boolean
  // Called on every live change during a drag (an item crossing into another
  // section) and once more with the final order on drop.
  onChange: (next: S[]) => void
  // Called once per completed drag that changed anything — `before` is the
  // order at drag start, for working out what to persist.
  onDrop?: (before: S[], after: S[]) => void
  sectionLabel: (section: S, idx: number) => string
  itemLabel: (item: S['items'][number]) => string
  children: ReactNode
}) {
  const dndId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const snapshot = useRef<S[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortableIds = sections.map((s) => SECTION + s.uid)
  if (withDivider) sortableIds.splice(dividerIndex(sections), 0, DIVIDER)

  function sectionIdxOf(id: string): number {
    if (id.startsWith(SECTION)) return sections.findIndex((s) => s.uid === id.slice(SECTION.length))
    const uid = id.slice(ITEM.length)
    return sections.findIndex((s) => s.items.some((i) => i.uid === uid))
  }

  // Sections only collide with sections (and the divider). Items prefer the
  // item under the pointer, then (for a section with no items left) the
  // section itself.
  const collisionDetection: CollisionDetection = (args) => {
    const active = String(args.active.id)
    if (active.startsWith(SECTION)) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(SECTION) || c.id === DIVIDER),
      })
    }
    const itemContainers = args.droppableContainers.filter((c) => String(c.id).startsWith(ITEM))
    const within = pointerWithin(args)
    const itemHit = within.find((c) => String(c.id).startsWith(ITEM))
    if (itemHit) return [itemHit]
    const sectionHit = within.find((c) => String(c.id).startsWith(SECTION))
    if (sectionHit) {
      const section = sections[sectionIdxOf(String(sectionHit.id))]
      if (section && section.items.length > 0) {
        const uids = new Set(section.items.map((i) => ITEM + i.uid))
        return closestCenter({ ...args, droppableContainers: itemContainers.filter((c) => uids.has(String(c.id))) })
      }
      return [sectionHit]
    }
    return closestCenter({ ...args, droppableContainers: itemContainers })
  }

  function handleDragStart({ active }: DragStartEvent) {
    snapshot.current = sections
    setActiveId(String(active.id))
  }

  // Moves an item into a different section as soon as it's dragged over it,
  // so it renders in the new section (and subtotals update) mid-drag.
  function handleDragOver({ active, over }: DragOverEvent) {
    const activeKey = String(active.id)
    if (!over || !activeKey.startsWith(ITEM)) return
    const overKey = String(over.id)
    const from = sectionIdxOf(activeKey)
    const to = sectionIdxOf(overKey)
    if (from < 0 || to < 0 || from === to) return

    const itemIdx = sections[from].items.findIndex((i) => ITEM + i.uid === activeKey)
    const item = sections[from].items[itemIdx]
    let insertAt = sections[to].items.length
    if (overKey.startsWith(ITEM)) {
      const overIdx = sections[to].items.findIndex((i) => ITEM + i.uid === overKey)
      const translated = active.rect.current.translated
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false
      insertAt = overIdx + (below ? 1 : 0)
    }

    onChange(sections.map((s, idx) => {
      if (idx === from) return { ...s, items: reindex(s.items.filter((_, i) => i !== itemIdx)) } as S
      if (idx === to) {
        const items = [...s.items]
        items.splice(insertAt, 0, item)
        return { ...s, items: reindex(items) } as S
      }
      return s
    }))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const before = snapshot.current
    snapshot.current = null
    setActiveId(null)
    if (!before) return

    let next = sections
    const activeKey = String(active.id)
    if (over) {
      const overKey = String(over.id)
      if (activeKey.startsWith(SECTION)) {
        // Moved within the list that includes the divider, so dropping onto
        // the divider's slot lands on whichever side the drag came from.
        const oldIdx = sortableIds.indexOf(activeKey)
        const newIdx = sortableIds.indexOf(overKey)
        if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
          const moved = arrayMove(sortableIds, oldIdx, newIdx)
          const dIdx = moved.indexOf(DIVIDER)
          const byKey = new Map(sections.map((s) => [SECTION + s.uid, s]))
          next = reindex(moved.filter((k) => k !== DIVIDER).map((k, i) => {
            const s = byKey.get(k)!
            return withDivider ? { ...s, excludeFromTotal: i >= dIdx } as S : s
          }))
        }
      } else if (overKey.startsWith(ITEM)) {
        const sIdx = sectionIdxOf(activeKey)
        if (sIdx >= 0 && sIdx === sectionIdxOf(overKey)) {
          const items = sections[sIdx].items
          const oldIdx = items.findIndex((i) => ITEM + i.uid === activeKey)
          const newIdx = items.findIndex((i) => ITEM + i.uid === overKey)
          if (oldIdx !== newIdx) {
            next = sections.map((s, idx) => (idx === sIdx ? { ...s, items: reindex(arrayMove(items, oldIdx, newIdx)) } as S : s))
          }
        }
      }
    }

    if (next !== sections) onChange(next)
    if (next !== before) onDrop?.(before, next)
  }

  function handleDragCancel() {
    if (snapshot.current) onChange(snapshot.current)
    snapshot.current = null
    setActiveId(null)
  }

  let overlay: string | null = null
  if (activeId?.startsWith(SECTION)) {
    const idx = sectionIdxOf(activeId)
    if (idx >= 0) overlay = sectionLabel(sections[idx], idx)
  } else if (activeId) {
    const section = sections[sectionIdxOf(activeId)]
    const item = section?.items.find((i) => ITEM + i.uid === activeId)
    if (item) overlay = itemLabel(item)
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {/* Rendered outside the sections so a dragged row isn't clipped by the
          tables' overflow-x-auto wrappers. */}
      <DragOverlay>
        {overlay != null && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg shadow-lg">
            <span className="text-fg-muted">⋮⋮</span>
            <span className="truncate max-w-xs">{overlay}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Wraps a section's item rows (inside its <tbody>).
export function SortableItems<I extends Orderable>({ items, children }: { items: I[]; children: ReactNode }) {
  return (
    <SortableContext items={items.map((i) => ITEM + i.uid)} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  )
}

function useSortableNode(id: string) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  const handle: DragHandleProps = { setActivatorRef: setActivatorNodeRef, attributes, listeners }
  return { setNodeRef, style, handle, isDragging }
}

export function SortableSectionCard({
  uid, className, children,
}: {
  uid: string | undefined
  className?: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const { setNodeRef, style, handle, isDragging } = useSortableNode(SECTION + uid)
  return (
    <div ref={setNodeRef} style={style} className={`${className ?? ''} ${isDragging ? 'opacity-40' : ''}`}>
      {children(handle)}
    </div>
  )
}

// The fixed "Total" line between included and optional sections. It can't
// be dragged itself, but shifts out of the way as sections are dragged past.
export function SortableTotalDivider({ className, children }: { className?: string; children: ReactNode }) {
  const { setNodeRef, transform, transition } = useSortable({ id: DIVIDER, disabled: { draggable: true } })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={className}>
      {children}
    </div>
  )
}

export function SortableRow({
  uid, className, children,
}: {
  uid: string | undefined
  className?: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const { setNodeRef, style, handle, isDragging } = useSortableNode(ITEM + uid)
  return (
    <tr ref={setNodeRef} style={style} className={`${className ?? ''} ${isDragging ? 'opacity-40' : ''}`}>
      {children(handle)}
    </tr>
  )
}
