'use client'

import { useState, type ReactNode } from 'react'
import AssignFormPanel, { type TemplateOption, type WorkerOption, type SiteOption } from './AssignFormsTab'
import NeedsAttention from './NeedsAttention'
import FormsList, { type AssignmentManagementRow } from './FormsList'
import FormTemplatesTab, { type TemplateRow } from './FormTemplatesTab'
import ReferenceDocsAdmin, { type ReferenceDocAdminRow } from './ReferenceDocsAdmin'
import SiteSafetyDetails, { type SiteSafetyRow } from './SiteSafetyDetails'
import SiteSwmsList, { type SiteSwmsRow } from './SiteSwmsList'
import type { CompanySafetyValues } from '@/lib/siteSafety'

// Safety Admin (supervisor+). Forms system only — the old upload-and-sign
// documents are no longer shown (their tables and files are kept).

interface Props {
  isAdmin: boolean
  todayPerth: string
  assignments: AssignmentManagementRow[]
  templates: TemplateRow[]
  workers: WorkerOption[]
  sites: SiteOption[]
  referenceDocs: ReferenceDocAdminRow[]
  companySafety: CompanySafetyValues | null
  siteSafety: SiteSafetyRow[]
  siteSwms: SiteSwmsRow[]
  tableExists: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-fg-secondary">{title}</h2>
      {children}
    </section>
  )
}

export default function SafetyAdminTab({
  isAdmin, todayPerth, assignments, templates, workers, sites, referenceDocs, companySafety, siteSafety, siteSwms, tableExists,
}: Props) {
  const [assignOpen, setAssignOpen]     = useState(false)
  const [createSignal, setCreateSignal] = useState(0)
  const [message, setMessage]           = useState<string | null>(null)

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm text-fg-muted">Safety forms tables not yet set up. Run the SQL migration to enable this feature.</p>
      </div>
    )
  }

  const templateOptions: TemplateOption[] = templates
    .filter(t => t.isActive)
    .map(t => ({ id: t.id, title: t.title, formType: t.formType, isSiteSpecific: t.isSiteSpecific }))

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setAssignOpen(v => !v); setMessage(null) }}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 transition-colors"
          >
            Assign a form
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCreateSignal(n => n + 1)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
            >
              New template
            </button>
          )}
        </div>
        {message && <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">{message}</p>}
        {assignOpen && (
          <AssignFormPanel
            templates={templateOptions}
            workers={workers}
            sites={sites}
            onClose={() => setAssignOpen(false)}
            onAssigned={setMessage}
          />
        )}
      </div>

      <NeedsAttention rows={assignments} todayPerth={todayPerth} />

      <Section title="Forms">
        <FormsList rows={assignments} todayPerth={todayPerth} isAdmin={isAdmin} />
      </Section>

      {isAdmin && (
        <Section title="Templates">
          <FormTemplatesTab templates={templates} tableExists={tableExists} createSignal={createSignal} />
        </Section>
      )}

      <Section title="Reference documents">
        <ReferenceDocsAdmin docs={referenceDocs} sites={sites} isAdmin={isAdmin} />
      </Section>

      <Section title="Site safety details">
        <SiteSafetyDetails
          isAdmin={isAdmin}
          todayPerth={todayPerth}
          company={companySafety}
          sites={siteSafety}
          renderSiteExtras={siteId => (
            <SiteSwmsList
              swms={siteSwms.filter(s => s.siteId === siteId)}
              company={companySafety}
              site={siteSafety.find(s => s.siteId === siteId)?.details ?? null}
            />
          )}
        />
      </Section>
    </div>
  )
}
