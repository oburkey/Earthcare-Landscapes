'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Profile } from '@/types/database'
import PreStartsTab from './PreStartsTab'
import ToolboxMeetingsTab from './ToolboxMeetingsTab'
import IncidentsTab from './IncidentsTab'
import FormsTab, { type MyAssignmentRow } from './FormsTab'
import { type TemplateRow } from './FormTemplatesTab'
import { type WorkerOption } from './AssignFormsTab'
import { type AssignmentManagementRow } from './FormsList'
import SafetyAdminTab from './SafetyAdminTab'
import { type ReferenceDocAdminRow } from './ReferenceDocsAdmin'
import { type SiteSafetyRow } from './SiteSafetyDetails'
import type { CompanySafetyValues } from '@/lib/siteSafety'

export type PreStartsSetter = Dispatch<SetStateAction<PreStartRow[]>>

// ── Shared types ──────────────────────────────────────────────────────────────

export type SiteOption    = { id: string; name: string }
export type StaffOption   = { id: string; first_name: string; last_name: string }
export type VehicleOption = {
  id:            string
  make:          string | null
  model:         string | null
  name:          string | null // trailers only
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
  trailerId:       string | null
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
  toolboxMeetings:  ToolboxMeetingRow[]
  incidents:        IncidentRow[]
  // Forms engine
  myAssignments:    MyAssignmentRow[]
  templates:        TemplateRow[]
  allAssignments:   AssignmentManagementRow[]
  referenceDocs:    ReferenceDocAdminRow[]
  companySafety:    CompanySafetyValues | null
  siteSafety:       SiteSafetyRow[]
  todayPerth:       string
  preStartsHasMore: boolean
  tablesExist:      {
    preStarts: boolean; toolboxMeetings: boolean; incidents: boolean
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
  toolboxMeetings,
  incidents,
  myAssignments,
  templates,
  allAssignments,
  referenceDocs,
  companySafety,
  siteSafety,
  todayPerth,
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
  // supervisor+   → + Safety Admin (forms, templates, reference documents, site safety details)
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
        <SafetyAdminTab
          isAdmin={profile.role === 'admin'}
          todayPerth={todayPerth}
          assignments={allAssignments}
          templates={templates}
          workers={staff.map((s): WorkerOption => ({
            id: s.id, name: `${s.first_name} ${s.last_name}`.trim(),
          }))}
          sites={sites}
          referenceDocs={referenceDocs}
          companySafety={companySafety}
          siteSafety={siteSafety}
          tableExists={tablesExist.safetyForms}
        />
      )}
    </div>
  )
}
