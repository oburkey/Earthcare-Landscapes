'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Profile } from '@/types/database'
import PreStartsTab from './PreStartsTab'
import DocumentsTab from './DocumentsTab'
import SignoffsTab from './SignoffsTab'

export type PreStartsSetter = Dispatch<SetStateAction<PreStartRow[]>>

// ── Shared types ──────────────────────────────────────────────────────────────

export type SiteOption    = { id: string; name: string }
export type StaffOption   = { id: string; full_name: string }
export type VehicleOption = {
  id:            string
  make:          string
  model:         string
  registration:  string | null
  vehicle_type:  string | null
  current_hours: number | null
  assigned_to:   string | null
}

export type PreStartRow = {
  id:              string
  siteId:          string
  siteName:        string
  submittedBy:     string
  submitterName:   string
  date:            string
  crewPresent:     string[]
  weather:         string[]
  siteHazards:     string | null
  ppeConfirmed:    boolean
  fitForWork:      boolean
  usingMachinery:  boolean
  machineryChecks: Record<string, string> | null
  machineId:       string | null
  usingTruck:      boolean
  truckId:         string | null
  truckChecks:     Record<string, string> | null
  usingTrailer:    boolean
  trailerChecks:   Record<string, string> | null
  notes:           string | null
  photoPaths:      string[]
  createdAt:       string
}

export type SafetyDocRow = {
  id:           string
  title:        string
  description:  string | null
  filePath:     string
  uploadedBy:   string
  uploaderName: string
  signoffCount: number
  createdAt:    string
}

export type SignoffRow = {
  id:             string
  documentId:     string
  documentTitle:  string
  signedBy:       string
  signerName:     string
  signedAt:       string
  signatureNotes: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'prestarts' | 'documents' | 'signoffs'

interface Props {
  profile:       Profile
  today:         string
  preStarts:     PreStartRow[]
  sites:         SiteOption[]
  staff:         StaffOption[]
  vehicles:      VehicleOption[]
  safetyDocs:    SafetyDocRow[]
  mySignoffIds:  string[]
  signoffs:      SignoffRow[]
  tablesExist:   { preStarts: boolean; safetyDocuments: boolean }
}

export default function SafetyView({
  profile,
  today,
  preStarts,
  sites,
  staff,
  vehicles,
  safetyDocs,
  mySignoffIds,
  signoffs,
  tablesExist,
}: Props) {
  const isLeadingHandPlus = ['leading_hand', 'supervisor', 'admin'].includes(profile.role)
  const isSupervisorPlus  = ['supervisor', 'admin'].includes(profile.role)

  // Owned here so deletions survive tab unmount/remount
  const [localPreStarts, setLocalPreStarts] = useState<PreStartRow[]>(preStarts)

  const [activeTab, setActiveTab] = useState<Tab>(
    isLeadingHandPlus ? 'prestarts' : 'documents'
  )

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(isLeadingHandPlus ? [{ id: 'prestarts' as Tab, label: 'Pre-starts' }] : []),
    { id: 'documents', label: 'Documents' },
    { id: 'signoffs',  label: 'Sign-offs' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-stone-900">Safety</h1>

      {/* Tab bar */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-stone-900 text-white'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'prestarts' && isLeadingHandPlus && (
        <PreStartsTab
          preStarts={localPreStarts}
          onPreStartsChange={setLocalPreStarts}
          sites={sites}
          staff={staff}
          vehicles={vehicles}
          role={profile.role}
          userId={profile.id}
          userName={profile.full_name}
          today={today}
          tableExists={tablesExist.preStarts}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab
          docs={safetyDocs}
          mySignoffIds={mySignoffIds}
          signoffs={signoffs}
          role={profile.role}
          userId={profile.id}
          userName={profile.full_name}
          isSupervisorPlus={isSupervisorPlus}
          tableExists={tablesExist.safetyDocuments}
        />
      )}

      {activeTab === 'signoffs' && (
        <SignoffsTab
          signoffs={signoffs}
          docs={safetyDocs}
          mySignoffIds={mySignoffIds}
          isSupervisorPlus={isSupervisorPlus}
        />
      )}
    </div>
  )
}
