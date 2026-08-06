'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  addEmailRecipient, removeEmailRecipient,
  previewWeeklyEmail, previewMonthlyEmail,
  sendTestWeeklyEmail, sendTestMonthlyEmail,
} from './actions'
import type { MutationState } from '@/types/actions'

export type RecipientRow = { id: string; email: string }

const INPUT = 'block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600'
const BUTTON_PRIMARY = 'rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 disabled:opacity-50'
const BUTTON_SECONDARY = 'rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50'

// ── Recipients ──────────────────────────────────────────────────────────────

function AddRecipientForm({ onAdded }: { onAdded: () => void }) {
  const [state, action, pending] = useActionState<MutationState, FormData>(addEmailRecipient, null)

  useEffect(() => {
    if (state && !state.error) onAdded() // remounts this form (via parent key), clearing the input
  }, [state, onAdded])

  return (
    <form action={action} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="email"
          type="email"
          required
          placeholder="name@example.com"
          className={INPUT}
        />
        {state?.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
        {pending ? 'Adding…' : 'Add email'}
      </button>
    </form>
  )
}

function RecipientRowItem({ recipient }: { recipient: RecipientRow }) {
  const [state, action, pending] = useActionState<MutationState, FormData>(removeEmailRecipient, null)

  return (
    <li className="flex items-center justify-between border-b border-border-subtle px-4 py-3 last:border-b-0">
      <span className="text-sm text-fg">{recipient.email}</span>
      <form action={action}>
        <input type="hidden" name="id" value={recipient.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {pending ? 'Removing…' : 'Remove'}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </li>
  )
}

function RecipientsSection({ recipients }: { recipients: RecipientRow[] }) {
  const [formKey, setFormKey] = useState(0)

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-raised">
        <AddRecipientForm key={formKey} onAdded={() => setFormKey((k) => k + 1)} />
      </div>
      {recipients.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-muted">No recipients yet — add an email above.</p>
      ) : (
        <ul>
          {recipients.map((r) => <RecipientRowItem key={r.id} recipient={r} />)}
        </ul>
      )}
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────────────────────

function PreviewButton({
  label, fetchPreview,
}: {
  label: string
  fetchPreview: () => Promise<{ html?: string; error?: string }>
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    if (html) { setHtml(null); return }
    setError(null)
    startTransition(async () => {
      const result = await fetchPreview()
      if (result.error) setError(result.error)
      else setHtml(result.html ?? null)
    })
  }

  return (
    <div>
      <button onClick={toggle} disabled={pending} className={BUTTON_SECONDARY}>
        {pending ? 'Loading…' : html ? `Hide ${label.toLowerCase()}` : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {html && (
        <iframe
          srcDoc={html}
          title={label}
          className="mt-3 w-full rounded-lg border border-border"
          style={{ height: '70vh' }}
        />
      )}
    </div>
  )
}

function SendTestButton({
  label, sendTest,
}: {
  label: string
  sendTest: () => Promise<MutationState>
}) {
  const [state, setState] = useState<MutationState>(null)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      setState(await sendTest())
    })
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending} className={BUTTON_SECONDARY}>
        {pending ? 'Sending…' : label}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-700">{state.success}</p>}
    </div>
  )
}

function PreviewSection() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <PreviewButton label="Preview weekly email" fetchPreview={previewWeeklyEmail} />
        <PreviewButton label="Preview monthly email" fetchPreview={previewMonthlyEmail} />
      </div>
      <div className="flex flex-wrap gap-3 pt-2 border-t border-border-subtle">
        <SendTestButton label="Send test weekly email now" sendTest={sendTestWeeklyEmail} />
        <SendTestButton label="Send test monthly email now" sendTest={sendTestMonthlyEmail} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScheduleEmailsSettings({ recipients }: { recipients: RecipientRow[] }) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-fg">Recipients</h2>
          <p className="text-sm text-fg-muted">Everyone on this list receives both the weekly and monthly reports.</p>
        </div>
        <RecipientsSection recipients={recipients} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-fg">Preview emails</h2>
          <p className="text-sm text-fg-muted">
            Preview renders with live data but sends nothing. &ldquo;Send test now&rdquo; emails only your own address.
          </p>
        </div>
        <PreviewSection />
      </section>
    </div>
  )
}
