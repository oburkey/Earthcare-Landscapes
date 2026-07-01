'use client'

import { useState } from 'react'
import FormCompletionView, { type CompletionAssignment } from './FormCompletionView'
import type { SafetyFormType } from '@/types/database'

export type MyAssignmentRow = {
  id: string
  templateId: string
  templateTitle: string
  formType: SafetyFormType
  isSiteSpecific: boolean
  sections: CompletionAssignment['sections']
  contentHtml: string | null
  requireWitness: boolean
  siteId: string | null
  siteName: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

interface Props {
  assignments: MyAssignmentRow[]
  tableExists: boolean
}

const TYPE_LABEL: Record<SafetyFormType, string> = {
  interactive: 'Induction',
  swms:        'SWMS',
  jsa:         'JSA',
  reference:   'Reference',
}

const TYPE_COLOUR: Record<SafetyFormType, string> = {
  interactive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  swms:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  jsa:         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  reference:   'bg-surface-raised text-fg-muted',
}

export default function FormsTab({ assignments, tableExists }: Props) {
  const [localAssignments, setLocalAssignments] = useState<MyAssignmentRow[]>(assignments)
  const [active, setActive] = useState<MyAssignmentRow | null>(null)

  const outstanding = localAssignments.filter(a => !a.completedAt)
  const completed   = localAssignments.filter(a =>  a.completedAt)

  function markCompleted(assignmentId: string) {
    setLocalAssignments(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, completedAt: new Date().toISOString() } : a)
    )
  }

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm text-fg-muted">Safety forms tables not yet set up.</p>
        <p className="text-xs text-fg-muted mt-1">Run the SQL migration in Supabase to enable this feature.</p>
      </div>
    )
  }

  return (
    <>
      {active && (
        <FormCompletionView
          assignment={{
            id:             active.id,
            templateTitle:  active.templateTitle,
            formType:       active.formType,
            sections:       active.sections,
            contentHtml:    active.contentHtml,
            requireWitness: active.requireWitness,
            siteName:       active.siteName,
          }}
          onClose={() => setActive(null)}
          onCompleted={markCompleted}
        />
      )}

      <div className="space-y-6">

        {/* Outstanding */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">
            Outstanding ({outstanding.length})
          </h2>
          {outstanding.length === 0 ? (
            <p className="text-sm text-fg-muted">No outstanding forms — all caught up.</p>
          ) : (
            <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
              {outstanding.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${TYPE_COLOUR[a.formType]}`}>
                        {TYPE_LABEL[a.formType]}
                      </span>
                      {a.dueDate && new Date(a.dueDate) < new Date() && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-fg truncate">{a.templateTitle}</p>
                    <p className="text-xs text-fg-muted">
                      {a.siteName && <span>{a.siteName} · </span>}
                      {a.dueDate
                        ? `Due ${new Date(a.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'No due date'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(a)}
                    className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 transition-colors"
                  >
                    Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">
              Completed ({completed.length})
            </h2>
            <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
              {completed.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-3 opacity-70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${TYPE_COLOUR[a.formType]}`}>
                        {TYPE_LABEL[a.formType]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-fg truncate">{a.templateTitle}</p>
                    <p className="text-xs text-fg-muted">
                      {a.siteName && <span>{a.siteName} · </span>}
                      Completed {new Date(a.completedAt!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-muted">Done</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
