'use client'

import { useState } from 'react'
import { seedSafetyFormTemplates, updateSwmsTemplates, type SeedResult, type UpdateResult } from './actions'

export default function SeedClient() {
  const [seedResult, setSeedResult]     = useState<SeedResult | null>(null)
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null)
  const [seedLoading, setSeedLoading]   = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)

  async function handleSeed() {
    setSeedLoading(true)
    setSeedResult(null)
    const r = await seedSafetyFormTemplates()
    setSeedResult(r)
    setSeedLoading(false)
  }

  async function handleUpdate() {
    setUpdateLoading(true)
    setUpdateResult(null)
    const r = await updateSwmsTemplates()
    setUpdateResult(r)
    setUpdateLoading(false)
  }

  return (
    <div className="space-y-8">

      {/* Seed */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-fg">Seed Safety Form Templates</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Inserts the 3 initial safety form templates (FHS001 site induction, SWMS-001 mobile plant, SWMS-002 services and roads).
            Aborts if any of the templates already exist.
          </p>
        </div>

        {seedResult && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            'success' in seedResult && seedResult.success
              ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {'success' in seedResult && seedResult.success ? (
              <div>
                <div className="font-semibold mb-1">Seeded successfully</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {seedResult.inserted.map((title) => <li key={title}>{title}</li>)}
                </ul>
              </div>
            ) : (
              <div>
                <div className="font-semibold mb-1">{'error' in seedResult ? seedResult.error : 'Unknown error'}</div>
                {'existing' in seedResult && seedResult.existing && seedResult.existing.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {seedResult.existing.map((title) => <li key={title}>{title}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSeed}
          disabled={seedLoading || ('success' in (seedResult ?? {}) && (seedResult as { success?: boolean })?.success === true)}
          className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {seedLoading ? 'Seeding…' : 'Seed 3 templates'}
        </button>
      </div>

      <hr className="border-border" />

      {/* Update SWMS */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-fg">Update SWMS templates</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Updates the content_html of the two existing SWMS templates (SWMS-001 and SWMS-002).
            Removes Section 10 (sign-on register) and replaces green section headers with neutral styling.
            Run this if the templates were seeded before these fixes.
          </p>
        </div>

        {updateResult && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            'success' in updateResult && updateResult.success
              ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {'success' in updateResult && updateResult.success ? (
              <div>
                <div className="font-semibold mb-1">Updated successfully</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {updateResult.updated.map((title) => <li key={title}>{title}</li>)}
                </ul>
              </div>
            ) : (
              <div className="font-semibold">{'error' in updateResult ? updateResult.error : 'Unknown error'}</div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleUpdate}
          disabled={updateLoading || ('success' in (updateResult ?? {}) && (updateResult as { success?: boolean })?.success === true)}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors"
        >
          {updateLoading ? 'Updating…' : 'Update SWMS templates'}
        </button>
      </div>

    </div>
  )
}
