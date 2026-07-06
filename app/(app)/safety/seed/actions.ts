'use server'

import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SafetyFormType, FormSection } from '@/types/database'

// ── HTML style constants ──────────────────────────────────────────────────────

const TD  = `border:1px solid #d1d5db;padding:5px 8px;font-size:12px;vertical-align:top;`
const TH  = `border:1px solid #d1d5db;padding:5px 8px;font-size:11px;font-weight:600;text-align:left;background:#f3f4f3;`
const TL  = `border:1px solid #d1d5db;padding:5px 8px;font-size:12px;font-weight:500;background:#f9faf8;`
const SEC = `background:#f0f0f0;color:#111;border-left:3px solid #333;padding:6px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 0 0;`
const TAB = `width:100%;border-collapse:collapse;`

// ── HTML helpers ──────────────────────────────────────────────────────────────

function sh(n: number | string, t: string): string {
  return `<div style="${SEC}">${n ? `${n}. ` : ''}${t}</div>`
}

function ir(l1: string, v1: string, l2?: string, v2?: string): string {
  if (l2 !== undefined) {
    return `<tr>
      <td style="${TL};width:22%">${l1}</td>
      <td style="${TD};width:28%">${v1}</td>
      <td style="${TL};width:22%">${l2}</td>
      <td style="${TD};width:28%">${v2 ?? ''}</td>
    </tr>`
  }
  return `<tr><td style="${TL};width:28%">${l1}</td><td style="${TD}" colspan="3">${v1}</td></tr>`
}

function infoTable(...rows: Array<[string, string, string?, string?]>): string {
  return `<table style="${TAB}">${rows.map(([l1, v1, l2, v2]) => ir(l1, v1, l2, v2)).join('')}</table>`
}

function hrwlSection(tickedIndices: number[]): string {
  const rows = HRWL_CATEGORIES.map((cat, i) => {
    const ticked = tickedIndices.includes(i)
    return `<tr>
      <td style="${TD};width:7%;text-align:center;font-size:15px;">${ticked ? '&#9745;' : '&#9744;'}</td>
      <td style="${TD}${ticked ? ';font-weight:600;' : ''}">${cat}</td>
    </tr>`
  }).join('')
  return `<table style="${TAB}">
    <thead><tr>
      <th style="${TH};width:7%;">Tick</th>
      <th style="${TH};">Category of High Risk Construction Work (WHS Regulations Schedule 5)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function hazardTable(rows: Array<[string, string, string, string]>): string {
  const trs = rows.map(([task, hazards, controls, person]) =>
    `<tr>
      <td style="${TD};width:18%;">${task}</td>
      <td style="${TD};width:20%;">${hazards}</td>
      <td style="${TD};width:47%;">${controls}</td>
      <td style="${TD};width:15%;">${person}</td>
    </tr>`
  ).join('')
  return `<table style="${TAB}">
    <thead><tr>
      <th style="${TH};width:18%;">Work Task</th>
      <th style="${TH};width:20%;">Potential Hazards</th>
      <th style="${TH};width:47%;">Control Measures</th>
      <th style="${TH};width:15%;">Person Responsible</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>`
}

function signOnTable(n = 10): string {
  const blank = Array(n).fill(
    `<tr>
      <td style="${TD};height:34px;width:25%;"></td>
      <td style="${TD};width:20%;"></td>
      <td style="${TD};width:35%;"></td>
      <td style="${TD};width:20%;"></td>
    </tr>`
  ).join('')
  return `<table style="${TAB}">
    <thead><tr>
      <th style="${TH};width:25%;">Name (print)</th>
      <th style="${TH};width:20%;">Company</th>
      <th style="${TH};width:35%;">Signature</th>
      <th style="${TH};width:20%;">Date</th>
    </tr></thead>
    <tbody>${blank}</tbody>
  </table>`
}

// ── High risk construction work categories (WA WHS Regs Schedule 5) ───────────

const HRWL_CATEGORIES = [
  'A risk of a person falling more than 2 metres',
  'Work on a telecommunications tower',
  'Demolition or alteration of a load-bearing element of a structure',
  'Disturbance of asbestos',
  'Structural alterations or repairs requiring temporary support to prevent collapse',
  'Work in or near a confined space',
  'Work in or near a shaft or trench deeper than 1.5 metres, or a tunnel',
  'Use of explosives',
  'Work on or near pressurised gas distribution mains or piping',
  'Work on or near chemical, fuel or refrigerant lines',
  'Work on or near energised electrical installations or services',
  'Work in an area that may have a contaminated or flammable atmosphere',
  'Tilt-up or precast concrete',
  'Work on, in or adjacent to a road, railway, shipping lane or other traffic corridor in use by traffic other than pedestrians',
  'Work in an area in which there is any movement of powered mobile plant',
  'Work in an area that has artificial extremes of temperature',
  'Work in or near water or other liquid that involves a risk of drowning',
  'Diving work that requires the use of breathing apparatus',
]

// ── SWMS document builder ─────────────────────────────────────────────────────

interface SwmsParams {
  ref: string
  title: string
  subtitle: string
  hrwlApplicable: number[]
  hrwlLicenceNote: string
  plant: string
  training: string
  chemicals: string
  ppe: string
  hazards: Array<[string, string, string, string]>
}

function buildSwmsHtml(p: SwmsParams): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1c1917;line-height:1.55;">

<div style="border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:4px;">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;">Earthcare Landscapes</div>
  <div style="font-size:16px;font-weight:bold;color:#111827;margin:3px 0 2px;">Safe Work Method Statement</div>
  <div style="font-size:12px;color:#6b7280;">${p.ref} &nbsp;&middot;&nbsp; ${p.title}</div>
</div>

<div style="font-size:11px;color:#6b7280;margin:6px 0 10px;font-style:italic;">${p.subtitle}</div>

${sh(1, 'Project Information')}
${infoTable(
  ['Head Contractor', '', 'Business Address / Phone', ''],
  ['Principal Contractor / PCBU', '', 'Date SWMS Provided to PC', ''],
  ['Project Manager / Workplace Location', '', 'Work Activity', p.title],
  ['Site Manager / Contact Phone', ''],
)}

${sh(2, 'SWMS Details')}
${infoTable(
  ['Person responsible for ensuring compliance with this SWMS', 'Site Supervisor'],
  ['Person responsible for reviewing control measures', 'Site Supervisor'],
  ['How will control measures be reviewed', 'Visual monitoring of control measures will be undertaken continuously. The SWMS will be reviewed and amended if there is any change in personnel, plant, environment or circumstances.'],
  ['Review date', ''],
)}

${sh(3, 'High Risk Construction Work &mdash; Tick Applicable')}
${hrwlSection(p.hrwlApplicable)}

${sh(4, 'High Risk Work Licence')}
<div style="border:1px solid #d1d5db;padding:8px 10px;font-size:12px;margin-bottom:0;">
  ${p.hrwlLicenceNote}
</div>

${sh(5, 'Supplementary Information')}
${infoTable(
  ['Plant and Equipment', p.plant],
  ['Training and Competencies Required', p.training],
  ['Hazardous Chemicals / SDS Required', p.chemicals],
)}

${sh(6, 'Mandatory PPE')}
<div style="border:1px solid #d1d5db;padding:8px 10px;font-size:12px;margin-bottom:0;">
  ${p.ppe}
</div>

${sh(7, 'Site Specific Hazards, Risks and Control Measures')}
${hazardTable(p.hazards)}

${sh(8, 'Consultation')}
<div style="border:1px solid #d1d5db;padding:8px 10px;font-size:12px;margin-bottom:0;">
  <div style="margin-bottom:5px;">Workers involved in the high-risk construction work covered by this SWMS have been consulted in its development and will be briefed on its requirements before commencing work. <strong>Yes &#10003;</strong></div>
  <div>Have relevant PCBUs been consulted and do they acknowledge the hazards, risks and control measures? <strong>Yes / N/A</strong></div>
</div>

${sh(9, 'WHS Management Plan')}
<div style="border:1px solid #d1d5db;padding:8px 10px;font-size:12px;margin-bottom:0;">
  This SWMS has been prepared in accordance with any relevant WHS Management Plan prepared for the construction site. <strong>Yes / N/A</strong>
</div>


</div>`
}

// ── Template 1: Site Induction (interactive) ──────────────────────────────────

const TEMPLATE_1_SECTIONS: FormSection[] = [
  {
    title: 'Site Induction Items',
    items: [
      { id: 'item_01', label: 'Introduced to key site personnel and organisation structure.', type: 'checkbox', required: true },
      { id: 'item_02', label: 'Shown location of Site Office and process for recording in Visitors/Subcontractors log for all site entries and exits.', type: 'checkbox', required: true },
      { id: 'item_03', label: 'Explained site-specific emergency procedures including muster points, emergency contacts, first aid kit location, and nearest hospital.', type: 'checkbox', required: true },
      { id: 'item_04', label: 'Shown location of site amenities including toilets, lunch break areas, and parking.', type: 'checkbox', required: true },
      { id: 'item_05', label: 'Explained site-specific PPE requirements (minimum: hi-vis vest, safety boots, sunscreen, hat).', type: 'checkbox', required: true },
      { id: 'item_06', label: 'Explained site-specific manual handling requirements and processes.', type: 'checkbox', required: true },
      { id: 'item_07', label: 'Explained the process for reporting hazards and near misses on site.', type: 'checkbox', required: true },
      { id: 'item_08', label: 'Explained the process for reporting incidents and injuries on site, including first aid requirements.', type: 'checkbox', required: true },
      { id: 'item_09', label: 'Explained the requirement to read and comply with all Safe Work Method Statements (SWMS) relevant to work being undertaken on this site.', type: 'checkbox', required: true },
      { id: 'item_10', label: "Explained the site's no drugs and alcohol policy — including zero tolerance for presenting to work under the influence.", type: 'checkbox', required: true },
      { id: 'item_11', label: "Explained the site's mobile phone policy — no personal phone use while operating machinery, plant, or vehicles.", type: 'checkbox', required: true },
      { id: 'item_12', label: 'Explained environmental requirements — no illegal dumping, manage run-off and erosion, protect waterways from sediment and chemical contamination.', type: 'checkbox', required: true },
      { id: 'item_13', label: 'Explained the site snake bite process and action plan.', type: 'checkbox', required: true },
      { id: 'item_14', label: 'Explained requirements for working alone or in isolation, including check-in procedures and communication expectations.', type: 'checkbox', required: true },
      { id: 'item_15', label: 'Explained the process for maintaining a clean and tidy worksite (housekeeping) and waste disposal requirements.', type: 'checkbox', required: true },
    ],
  },
  {
    title: 'Medical Declaration',
    items: [
      { id: 'item_16', label: 'Do you have any medical condition, or are you taking any prescribed medication(s) that could in any way affect your ability to safely perform your duties on this site?', type: 'yes_no', required: true },
    ],
  },
  {
    title: 'Declaration',
    items: [
      { id: 'item_17', label: 'I confirm that I have had the above health, safety and site requirements explained to me and that I fully understand and will comply with all requirements while working on this site.', type: 'checkbox', required: true },
    ],
  },
]

// ── Template 2: SWMS — Mobile Plant Movement ──────────────────────────────────

const SWMS_001_HTML = buildSwmsHtml({
  ref: 'SWMS-001',
  title: 'Mobile Plant Movement',
  subtitle: 'This SWMS covers the movement, manoeuvring and operation of powered mobile plant on site, including excavators, skid steers, loaders, dingo (pedestrian-operated plant), and tipper trucks operating within the site boundary.',
  hrwlApplicable: [14],
  hrwlLicenceNote: `Where a High Risk Work (HRW) licence is required to operate plant (e.g. excavator over 3 tonnes — Licence Class CN, dogging — DG, rigging — RB/RI/RE), the operator must hold a current licence. Licence numbers must be recorded on the sign-on register. Earthcare Landscapes will verify licences before allowing operation. Pedestrian-operated plant (Dingo, plate compactor, etc.) does not require an HRW licence but requires demonstrated competency.`,
  plant: 'Excavator, skid steer loader (bobcat), wheel loader, tipper truck(s), pedestrian-operated plant (Dingo, walk-behind), fuel containers, fire extinguisher, ground mats, rated loading ramps.',
  training: 'Current HRW Licence for applicable plant. Earthcare induction completed. Plant-specific pre-start training. Spotter competency where required.',
  chemicals: 'Diesel fuel (SDS required on site). Engine oil (SDS required on site). Hydraulic fluid (SDS required on site).',
  ppe: 'Hard hat (where overhead risk exists) &nbsp;&bull;&nbsp; Hi-vis vest or shirt at all times &nbsp;&bull;&nbsp; Steel-capped safety boots &nbsp;&bull;&nbsp; High-visibility gloves for rigging/spotting &nbsp;&bull;&nbsp; Eye protection where dust or debris is present &nbsp;&bull;&nbsp; Hearing protection near operating plant &nbsp;&bull;&nbsp; Sunscreen and sun-protective hat',
  hazards: [
    [
      'Pre-start inspection of plant',
      'Undetected mechanical defects — brake failure, tyre blow-out, hydraulic leak, structural failure',
      'Complete the Earthcare plant pre-start checklist before every shift. Do not operate defective plant — tag out and report immediately to supervisor. Ensure relevant licences and competencies are current before operating.',
      'Operator',
    ],
    [
      'General plant operation on site',
      'Collision with workers on foot, overturning on soft ground, falling objects, crush injuries',
      'Establish and enforce exclusion zones (minimum 5 m from operating plant). All workers on foot must remain visible to the operator at all times. Use spotters in restricted areas. Travel at no more than 10 km/h on site. Seatbelts to be worn at all times when fitted.',
      'Operator / Site Supervisor',
    ],
    [
      'Reversing and manoeuvring',
      'Collision with workers, vehicles or structures during reversing — reduced rear visibility',
      'Use a spotter for all reversing manoeuvres where rear visibility is limited. Sound horn before moving. All plant must have operational reverse alarms. Spotter maintains eye contact with operator at all times and uses agreed hand signals.',
      'Operator / Spotter',
    ],
    [
      'Operating pedestrian plant (Dingo / walk-behind)',
      'Operator run-over or foot crush, tip-over on uneven or sloped ground, pinch point injuries',
      'Only trained and competent operators. Wear steel-capped boots at all times. Operator must stand clear of attachment travel path. Do not operate on slopes exceeding manufacturer\'s rated limit. Never allow passengers or riders.',
      'Operator',
    ],
    [
      'Loading and unloading plant from trailer',
      'Plant falling from trailer or ramp, runaway plant, trailer instability, bystander injury',
      'Use rated loading ramps on level and firm ground. Ensure trailer is chocked and connected to tow vehicle. Spotter required. No bystanders within the loading zone. Engine off and park brake applied after plant is secured. Chains or straps rated to plant weight.',
      'Leading Hand',
    ],
    [
      'Refuelling plant',
      'Fire or explosion from fuel vapour, fuel spills contaminating ground or waterways, burns',
      'Turn off engine before refuelling. No smoking or ignition sources within 10 m. Use approved containers and funnels. Clean up spills immediately with absorbent material. Maintain accessible fire extinguisher. Refuel away from drains, waterways and vegetation.',
      'Operator',
    ],
    [
      'Operating on soft, wet or inclined ground',
      'Tip-over, plant bogging, loss of control on slope, embankment collapse',
      'Assess ground conditions before commencing work. Do not exceed manufacturer\'s rated slope limits. Load and operate away from excavation edges and embankments. Use ground mats or timber pads where ground is soft. Stop work and notify supervisor if conditions change.',
      'Operator / Site Supervisor',
    ],
    [
      'Working near public or residents',
      'Injury to members of public, flying debris strike, dust and noise nuisance',
      'Erect and maintain site boundary fencing and warning signage. Restrict operating hours near residents per permit conditions. Suppress dust with water or appropriate measures. Keep public clear of operating areas at all times. Post spotter near public access points.',
      'Site Supervisor',
    ],
    [
      'Securing plant at end of shift',
      'Theft, unauthorised use by untrained persons, safety hazard from unsecured plant',
      'Lower all attachments to the ground. Apply park brake. Remove ignition keys and take off site or secure in site office. Lock cab where applicable. Park away from public areas, excavation edges, embankments and drainage lines.',
      'Operator / Site Supervisor',
    ],
    [
      'Operating near services or roads',
      'Multiple combined hazards &mdash; refer to SWMS-002',
      'When mobile plant is operating near underground services, overhead powerlines, or live roads, SWMS-002 (Working Near Services and Roads) must also be read, briefed and signed by all workers before commencing those activities.',
      'Site Supervisor',
    ],
  ],
})

// ── Template 3: SWMS — Working Near Services and Roads ───────────────────────

const SWMS_002_HTML = buildSwmsHtml({
  ref: 'SWMS-002',
  title: 'Working Near Services and Roads',
  subtitle: 'This SWMS covers work on or near underground services (water, gas, electrical, communications, sewer), overhead powerlines, and live roads or traffic corridors. This SWMS must be used alongside SWMS-001 whenever mobile plant is also operating.',
  hrwlApplicable: [10, 13],
  hrwlLicenceNote: `Work on or near energised electrical infrastructure may require a licensed or registered electrician or electrical contractor depending on the nature of the work. A Traffic Management Coordinator (TMC) or Traffic Controller (TC) accreditation is required when installing or operating traffic control devices on public roads. Earthcare Landscapes will confirm applicable licence requirements prior to commencing work and ensure relevant personnel hold current credentials.`,
  plant: 'Excavator, skid steer, tipper truck(s), hand tools for service exposure, hydrovac truck or sucker truck (where available), DBYD service locator, cable/pipe locating equipment (CAT &amp; Genny or equivalent), traffic control devices (signs, cones, barriers, delineators), temporary fencing.',
  training: 'Earthcare induction completed. DBYD request process training. Traffic management training (where applicable). Competency in service locating equipment. Current HRW licence for plant operators (see SWMS-001).',
  chemicals: 'Diesel fuel (SDS on site). Spill response kit required where excavation is near fuel or chemical lines.',
  ppe: 'Hi-vis vest or shirt at all times (AS/NZS 4602.1 Class D) &nbsp;&bull;&nbsp; Steel-capped safety boots &nbsp;&bull;&nbsp; Hard hat (where overhead risk or excavation collapse risk exists) &nbsp;&bull;&nbsp; Eye protection &nbsp;&bull;&nbsp; Hearing protection near operating plant &nbsp;&bull;&nbsp; Rubber gloves and insulated tools near suspected electrical services &nbsp;&bull;&nbsp; Sunscreen and sun-protective hat',
  hazards: [
    [
      'Pre-site setup and planning',
      'Working near unknown, unmapped or incorrectly marked underground services',
      'Submit a Dial Before You Dig (DBYD) request minimum 48 hours before work commences. Obtain and review underground service drawings for the work area. Mark up all known services on site before work begins. Conduct a toolbox meeting / site briefing covering service locations before starting.',
      'Site Supervisor',
    ],
    [
      'Excavating near underground services',
      'Striking water, gas, electrical, communications or sewer lines — electrocution, explosion, flooding, injury',
      'Hand expose all services within 300 mm of the expected service location. Use non-destructive digging (hydrovac / sucker truck) where service location is uncertain. No mechanical excavation within 300 mm of a confirmed service location without supervisor approval. Treat all unidentified lines as live energised electrical cables until confirmed otherwise.',
      'Operator / Leading Hand',
    ],
    [
      'Working near overhead powerlines',
      'Electrocution from contact with live conductor by plant, equipment or workers',
      'Identify powerline voltage and position before commencing work. Maintain minimum exclusion zones per WA regulations (minimum 3 m for &lt;1 kV; 6.4 m for 132 kV; consult supervisor for higher voltages). Notify the relevant network operator if work is required within an exclusion zone. Erect height restriction goal posts if required. Do not work under powerlines in wet or adverse weather conditions.',
      'Site Supervisor',
    ],
    [
      'Working adjacent to live roads or traffic corridors',
      'Worker struck by passing vehicle, driver distraction, debris on road surface',
      'Obtain an approved Traffic Management Plan (TMP) and all required permits before commencing. Erect all required traffic control devices per the TMP. Use accredited Traffic Controllers where required. Hi-vis PPE worn by all workers in the traffic management zone at all times. Conduct traffic management briefing at start of each shift.',
      'Traffic Controller / Leading Hand',
    ],
    [
      'Trucks entering and exiting onto live roads',
      'Collision with passing traffic, truck overshooting road, road user confusion',
      'Appoint a Traffic Controller to manage all truck movements across or onto live roads. Trucks must wait for a clear signal from the controller before entering the road. No truck to exit site without a controller in position. Wheel wash or clean-down to prevent mud on road where required.',
      'Traffic Controller',
    ],
    [
      'Working near stormwater drains and drainage assets',
      'Contamination of waterways from sediment, concrete waste, or fuel/chemical spills',
      'Install silt fencing, sand bags or drain inlet guards near all stormwater inlets within or adjacent to the work area. No cement, concrete, fuel or chemical waste to be disposed of near drains. Spill response kit accessible on site at all times. Report any spills to supervisor immediately.',
      'Leading Hand',
    ],
    [
      'Striking an unknown service during excavation',
      'Electrocution, gas release, flooding, communication outage, fire or explosion',
      'STOP WORK immediately. Do not attempt to remove or disturb the service. Notify supervisor. Establish exclusion zone around the strike location. Contact relevant service authority. Do not resume excavation until the service has been identified, made safe and cleared by the service owner.',
      'All workers',
    ],
    [
      'Mobile plant operating in same area',
      'Combined risks from plant movement and service/road proximity &mdash; refer to SWMS-001',
      'Apply all controls from SWMS-001 (Mobile Plant Movement) when mobile plant is operating in the same work area. Establish combined exclusion zones covering both plant movement and service/road proximity hazards. Allocate a dedicated controller where both plant and traffic management are active.',
      'Site Supervisor',
    ],
  ],
})

// ── Seed action ───────────────────────────────────────────────────────────────

export type SeedResult =
  | { success: true; inserted: string[] }
  | { error: string; existing?: string[] }

export async function seedSafetyFormTemplates(): Promise<SeedResult> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const admin = createAdminClient()

  // Find an admin profile to use as created_by
  const { data: adminProfile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (profileErr) return { error: `Could not fetch admin profile: ${profileErr.message}` }
  if (!adminProfile) return { error: 'No admin profile found in database. Ensure at least one admin user exists.' }

  const TITLES = [
    'Health, Safety & Site Induction Checklist',
    'Safe Work Method Statement — Mobile Plant Movement',
    'Safe Work Method Statement — Working Near Services and Roads',
  ]

  // Idempotency check
  const { data: existing } = await admin
    .from('safety_form_templates')
    .select('title')
    .in('title', TITLES)

  if (existing && existing.length > 0) {
    return {
      error: 'Some templates already exist — aborting to avoid duplicates.',
      existing: existing.map((t: { title: string }) => t.title),
    }
  }

  const templates: Array<{
    title: string
    form_type: SafetyFormType
    description: string
    is_site_specific: boolean
    sections: FormSection[]
    content_html: string | null
    require_witness: boolean
    is_active: boolean
    created_by: string
  }> = [
    {
      title: 'Health, Safety & Site Induction Checklist',
      form_type: 'interactive',
      description: 'Form No: FHS001 — To be completed by all employees, contractors and visitors before commencing work on site. Requires inductee signature and witness/safety rep signature.',
      is_site_specific: true,
      sections: TEMPLATE_1_SECTIONS,
      content_html: null,
      require_witness: true,
      is_active: true,
      created_by: adminProfile.id,
    },
    {
      title: 'Safe Work Method Statement — Mobile Plant Movement',
      form_type: 'swms',
      description: 'SWMS-001 — Safe work method statement for the movement and operation of powered mobile plant on site, including excavators, skid steers, loaders, pedestrian plant and tipper trucks.',
      is_site_specific: true,
      sections: [],
      content_html: SWMS_001_HTML,
      require_witness: false,
      is_active: true,
      created_by: adminProfile.id,
    },
    {
      title: 'Safe Work Method Statement — Working Near Services and Roads',
      form_type: 'swms',
      description: 'SWMS-002 — Safe work method statement for work on or near underground services, overhead powerlines, and live roads or traffic corridors. Use alongside SWMS-001 when mobile plant is operating.',
      is_site_specific: true,
      sections: [],
      content_html: SWMS_002_HTML,
      require_witness: false,
      is_active: true,
      created_by: adminProfile.id,
    },
  ]

  const { data, error } = await admin
    .from('safety_form_templates')
    .insert(templates)
    .select('title')

  if (error) return { error: error.message }

  return {
    success: true,
    inserted: (data ?? []).map((t: { title: string }) => t.title),
  }
}

// ── Update existing SWMS templates (removes Section 10 + strips green) ────────

export type UpdateResult =
  | { success: true; updated: string[] }
  | { error: string }

export async function updateSwmsTemplates(): Promise<UpdateResult> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const admin = createAdminClient()

  const updates: Array<{ title: string; content_html: string }> = [
    {
      title: 'Safe Work Method Statement — Mobile Plant Movement',
      content_html: SWMS_001_HTML,
    },
    {
      title: 'Safe Work Method Statement — Working Near Services and Roads',
      content_html: SWMS_002_HTML,
    },
  ]

  const updated: string[] = []
  for (const { title, content_html } of updates) {
    const { error } = await admin
      .from('safety_form_templates')
      .update({ content_html })
      .eq('title', title)
    if (error) return { error: `Failed to update "${title}": ${error.message}` }
    updated.push(title)
  }

  return { success: true, updated }
}
