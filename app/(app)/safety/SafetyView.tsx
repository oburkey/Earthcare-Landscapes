'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Profile } from '@/types/database'
import PreStartsTab from './PreStartsTab'
import DocumentsTab from './DocumentsTab'
import SignoffsTab from './SignoffsTab'
import ToolboxMeetingsTab from './ToolboxMeetingsTab'
import IncidentsTab from './IncidentsTab'
import FormsTab, { type MyAssignmentRow } from './FormsTab'
import FormTemplatesTab, { type TemplateRow } from './FormTemplatesTab'
import AssignFormsTab, { type AssignmentManagementRow, type TemplateOption, type WorkerOption } from './AssignFormsTab'

export type PreStartsSetter = Dispatch<SetStateAction<PreStartRow[]>>

// ── Shared types ──────────────────────────────────────────────────────────────

export type SiteOption    = { id: string; name: string }
export type StaffOption   = { id: string; first_name: string; last_name: string }
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

export type ToolboxMeetingRow = {
  id:            string
  siteId:        string
  siteName:      string
  date:          string
  topic:         string
  notes:         string | null
  attendees:     string[]
  submittedBy:   string
  submitterName: string
  createdAt:     string
}

export type IncidentRow = {
  id:              string
  siteId:          string
  siteName:        string
  date:            string
  time:            string | null
  type:            'incident' | 'near_miss' | 'first_aid' | 'property_damage'
  description:     string
  peopleInvolved:  string | null
  immediateAction: string | null
  reportedBy:      string
  reporterName:    string
  adminNotes:      string | null
  photoPaths:      string[]
  createdAt:       string
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'prestarts' | 'my_forms' | 'team' | 'safety_admin'

interface Props {
  profile:          Profile
  today:            string
  preStarts:        PreStartRow[]
  sites:            SiteOption[]
  staff:            StaffOption[]
  vehicles:         VehicleOption[]
  safetyDocs:       SafetyDocRow[]
  mySignoffIds:     string[]
  signoffs:         SignoffRow[]
  toolboxMeetings:  ToolboxMeetingRow[]
  incidents:        IncidentRow[]
  // Forms engine
  myAssignments:    MyAssignmentRow[]
  templates:        TemplateRow[]
  allAssignments:   AssignmentManagementRow[]
  preStartsHasMore: boolean
  tablesExist:      {
    preStarts: boolean; safetyDocuments: boolean; toolboxMeetings: boolean; incidents: boolean
    safetyForms: boolean
  }
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
  toolboxMeetings,
  incidents,
  myAssignments,
  templates,
  allAssignments,
  preStartsHasMore,
  tablesExist,
}: Props) {
  const isLeadingHandPlus = ['leading_hand', 'supervisor', 'admin'].includes(profile.role)
  const isSupervisorPlus  = ['supervisor', 'admin'].includes(profile.role)

  // Owned here so mutations survive tab unmount/remount
  const [localPreStarts, setLocalPreStarts] = useState<PreStartRow[]>(preStarts)
  const [localToolboxMeetings, setLocalToolboxMeetings] = useState<ToolboxMeetingRow[]>(toolboxMeetings)
  const [localIncidents, setLocalIncidents] = useState<IncidentRow[]>(incidents)

  const [activeTab, setActiveTab] = useState<Tab>('prestarts')

  // Tab visibility per role:
  // worker+       → Pre-starts, My Forms
  // leading_hand+ → + Team (Toolbox Meetings + Incidents)
  // supervisor+   → + Safety Admin (Documents, Sign-offs, Assign Forms, Form Templates)
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'prestarts',    label: 'Pre-starts' },
    { id: 'my_forms',     label: 'My Forms' },
    ...(isLeadingHandPlus ? [{ id: 'team' as Tab,         label: 'Team' }] : []),
    ...(isSupervisorPlus  ? [{ id: 'safety_admin' as Tab, label: 'Safety Admin' }] : []),
  ]

  const userName = `${profile.first_name} ${profile.last_name}`.trim()

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-fg">Safety</h1>

      {/* Tab bar */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-green-700 text-white'
                : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'prestarts' && (
        <PreStartsTab
          preStarts={localPreStarts}
          onPreStartsChange={setLocalPreStarts}
          sites={sites}
          staff={staff}
          vehicles={vehicles}
          role={profile.role}
          userId={profile.id}
          userName={userName}
          today={today}
          tableExists={tablesExist.preStarts}
          hasMorePreStarts={preStartsHasMore}
        />
      )}

      {activeTab === 'my_forms' && (
        <FormsTab
          assignments={myAssignments}
          tableExists={tablesExist.safetyForms}
          workerName={userName}
        />
      )}

      {activeTab === 'team' && isLeadingHandPlus && (
        <div className="space-y-8">
          <ToolboxMeetingsTab
            meetings={localToolboxMeetings}
            onMeetingsChange={setLocalToolboxMeetings}
            sites={sites}
            staff={staff}
            role={profile.role}
            userId={profile.id}
            userName={userName}
            today={today}
            tableExists={tablesExist.toolboxMeetings}
            canManage={isLeadingHandPlus}
            isAdmin={profile.role === 'admin'}
          />
          <IncidentsTab
            incidents={localIncidents}
            onIncidentsChange={setLocalIncidents}
            sites={sites}
            role={profile.role}
            userId={profile.id}
            userName={userName}
            today={today}
            tableExists={tablesExist.incidents}
            canManage={isLeadingHandPlus}
            isAdmin={profile.role === 'admin'}
          />
        </div>
      )}

      {activeTab === 'safety_admin' && isSupervisorPlus && (
        <div className="space-y-8">
          <DocumentsTab
            docs={safetyDocs}
            mySignoffIds={mySignoffIds}
            signoffs={signoffs}
            role={profile.role}
            userId={profile.id}
            userName={userName}
            isSupervisorPlus={isSupervisorPlus}
            tableExists={tablesExist.safetyDocuments}
          />
          <SignoffsTab
            signoffs={signoffs}
            docs={safetyDocs}
            mySignoffIds={mySignoffIds}
            isSupervisorPlus={isSupervisorPlus}
          />
          <AssignFormsTab
            assignments={allAssignments}
            templates={templates.map((t): TemplateOption => ({
              id: t.id, title: t.title, formType: t.formType, isSiteSpecific: t.isSiteSpecific,
            }))}
            workers={staff.map((s): WorkerOption => ({
              id: s.id, name: `${s.first_name} ${s.last_name}`.trim(),
            }))}
            sites={sites}
            tableExists={tablesExist.safetyForms}
          />
          {profile.role === 'admin' && (
            <FormTemplatesTab
              templates={templates}
              tableExists={tablesExist.safetyForms}
            />
          )}
        </div>
      )}
    </div>
  )
}
