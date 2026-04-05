'use client'

import { useActionState, useState, useMemo } from 'react'
import { createContact, updateContact, deleteContact } from './actions'
import type { Contact } from '@/types/database'

type ActionState = { error?: string; success?: string } | null

interface Props {
  contacts: Contact[]
  canManage: boolean
}

const FIELD_CLASS = 'mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600'

export default function ContactsView({ contacts, canManage }: Props) {
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Collect unique categories for quick filter chips
  const categories = useMemo(() => {
    const cats = contacts.map((c) => c.category).filter(Boolean) as string[]
    return Array.from(new Set(cats)).sort()
  }, [contacts])

  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return contacts.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
      const matchesCategory = !activeCategory || c.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [contacts, query, activeCategory])

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Contacts</h1>
        {canManage && (
          <button
            onClick={() => { setShowAdd((v) => !v); setExpandedId(null) }}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
          >
            {showAdd ? 'Cancel' : '+ Add contact'}
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && canManage && (
        <ContactForm
          mode="add"
          onSuccess={() => setShowAdd(false)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or company…"
          className="block w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === null
                ? 'bg-green-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-green-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-stone-500">
            {contacts.length === 0
              ? 'No contacts yet.'
              : 'No contacts match your search.'}
          </p>
          {contacts.length === 0 && canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm font-medium text-green-700 hover:underline"
            >
              Add the first contact →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              canManage={canManage}
              expanded={expandedId === contact.id}
              onToggle={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              onClose={() => setExpandedId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ContactCard({
  contact,
  canManage,
  expanded,
  onToggle,
  onClose,
}: {
  contact: Contact
  canManage: boolean
  expanded: boolean
  onToggle: () => void
  onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-stone-50 active:bg-stone-100 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-900">{contact.name}</span>
            {contact.company && (
              <span className="text-sm text-stone-500">{contact.company}</span>
            )}
            {contact.category && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                {contact.category}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 flex-wrap">
            {contact.phone && (
              <span className="text-xs text-stone-400">{contact.phone}</span>
            )}
            {contact.email && (
              <span className="text-xs text-stone-400">{contact.email}</span>
            )}
          </div>
        </div>
        <svg
          className={`ml-3 h-4 w-4 shrink-0 text-stone-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-4 py-4 space-y-4">
          {/* Contact detail view */}
          <div className="space-y-2">
            {contact.phone && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-16 shrink-0">Phone</span>
                <a href={`tel:${contact.phone}`} className="text-sm text-stone-800 hover:text-green-700">{contact.phone}</a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-16 shrink-0">Email</span>
                <a href={`mailto:${contact.email}`} className="text-sm text-stone-800 hover:text-green-700 break-all">{contact.email}</a>
              </div>
            )}
            {contact.category && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-16 shrink-0">Category</span>
                <span className="text-sm text-stone-800">{contact.category}</span>
              </div>
            )}
            {contact.notes && (
              <div className="flex gap-2">
                <span className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">Notes</span>
                <p className="text-sm text-stone-800 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>

          {canManage && (
            <EditContactForm contact={contact} onSuccess={onClose} />
          )}
        </div>
      )}
    </div>
  )
}

function ContactForm({
  mode,
  contact,
  onSuccess,
}: {
  mode: 'add' | 'edit'
  contact?: Contact
  onSuccess: () => void
}) {
  const action = mode === 'add' ? createContact : updateContact
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)

  if (state?.success) {
    onSuccess()
    return null
  }

  return (
    <div className={mode === 'add' ? 'rounded-xl border border-stone-200 bg-white p-5' : ''}>
      {mode === 'add' && <h2 className="text-sm font-semibold text-stone-800 mb-4">New contact</h2>}
      <form action={formAction} className="space-y-4">
        {contact && <input type="hidden" name="contact_id" value={contact.id} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={contact?.name ?? ''}
              placeholder="e.g. John Smith"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Company</label>
            <input
              name="company"
              type="text"
              defaultValue={contact?.company ?? ''}
              placeholder="e.g. Acme Supplies"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Phone</label>
            <input
              name="phone"
              type="tel"
              defaultValue={contact?.phone ?? ''}
              placeholder="e.g. 0400 000 000"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={contact?.email ?? ''}
              placeholder="e.g. john@example.com"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700">Category</label>
          <input
            name="category"
            type="text"
            defaultValue={contact?.category ?? ''}
            placeholder="e.g. Materials Suppliers, Contractors, Maintenance"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={contact?.notes ?? ''}
            placeholder="Any relevant notes…"
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : mode === 'add' ? 'Add contact' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

function EditContactForm({ contact, onSuccess }: { contact: Contact; onSuccess: () => void }) {
  const [showEdit, setShowEdit] = useState(false)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteContact, null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (deleteState?.success) {
    onSuccess()
    return null
  }

  return (
    <div className="space-y-3 pt-2 border-t border-stone-100">
      <button
        onClick={() => setShowEdit((v) => !v)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        {showEdit ? 'Cancel edit' : 'Edit contact'}
      </button>

      {showEdit && (
        <ContactForm mode="edit" contact={contact} onSuccess={onSuccess} />
      )}

      {/* Delete */}
      <div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete contact
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone-600">Are you sure?</p>
            <form action={deleteAction}>
              <input type="hidden" name="contact_id" value={contact.id} />
              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </form>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        )}
        {deleteState?.error && (
          <p className="mt-2 text-sm text-red-600">{deleteState.error}</p>
        )}
      </div>
    </div>
  )
}
