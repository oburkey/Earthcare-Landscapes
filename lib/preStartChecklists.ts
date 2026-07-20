// Shared pre-start checklist definitions — single source of truth so the
// safety form (PreStartsTab) and the vehicle fault-history view (Vehicles
// page) always agree on item keys/labels/inverted-answer logic.

export type ChecklistItem = {
  readonly key:               string
  readonly label:             string
  readonly inverted?:         boolean  // "yes" is the bad answer
  readonly blocksSubmission?: boolean  // bad answer prevents submit (truck Q1)
}

export const MACHINERY_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'air_filters',       label: 'Have air filters been cleaned today?' },
  { key: 'pre_cleaner_bowl',  label: 'Has the air filter been checked and bowl emptied?' },
  { key: 'engine_fluids',     label: 'Have engine oil, coolant and hydraulic fluid levels been checked, no leaks?' },
  { key: 'battery_water',     label: 'Have battery, leads and water level been checked?' },
  { key: 'belts_hoses',       label: 'Have belts, hoses and battery condition/connections been checked?' },
  { key: 'greased_today',     label: 'Has the machine been greased today?' },
  { key: 'attachments_secure',label: 'Are buckets, forks, attachment pins and bolts secure?' },
  { key: 'lights_working',    label: 'Are work lights, beacon, taillights and reverse lights working?' },
  { key: 'seatbelt_controls', label: 'Is the seatbelt working, and are controls, horn and reverse beeper operational?' },
  { key: 'fire_extinguisher', label: 'Is a fire extinguisher present and not expired?' },
  { key: 'door_seals',        label: 'Does the door open and close correctly with seals undamaged?' },
  { key: 'tyre_pressure',     label: 'Have tyre pressures been checked and wheel nuts are secure?' },
  { key: 'machine_washed',    label: 'Has the machine been washed in the last week?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

export const TRUCK_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'fitness_to_drive',  label: 'Are you fit, drug and alcohol free to drive this vehicle?', blocksSubmission: true },
  { key: 'fluid_levels',      label: 'Have fluid levels been checked (oil, coolant, brake/clutch fluid)?' },
  { key: 'battery_water',     label: 'Have battery, leads and water level been checked?' },
  { key: 'wheels_tyres',      label: 'Have wheels, tyres and hubs been checked (tread, pressure, wheel nuts)?' },
  { key: 'lights_reflectors', label: 'Are all lights and reflectors working?' },
  { key: 'windscreen_wipers', label: 'Are windscreen, wipers and mirrors clean and undamaged?' },
  { key: 'fluid_leaks',       label: 'Any fluid leaks visible (oil, fuel, water, hydraulic)?', inverted: true },
  { key: 'warning_lights',    label: 'After starting — any warning lights remain on?', inverted: true },
  { key: 'truck_washed',      label: 'Has the truck been washed in the last week?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

export const TRAILER_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'tyres_checked',     label: 'Have all tyres been checked (tread, damage, inflation, including spares)?' },
  { key: 'mudguards',         label: 'Are mudguards and mudflaps securely fitted?' },
  { key: 'lights_indicators', label: 'Are all lights, indicators and reflectors working?' },
  { key: 'chassis_suspension',label: 'Visual check of chassis, body and suspension complete?' },
  { key: 'tow_hitch',         label: 'Are tow hitch, safety chains and tie down straps secure (chains crossed left-right)?' },
  { key: 'brakes_tested',     label: 'Have brakes been tested at low speed (apply and release)?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

// Kept only for rendering legacy pre-start records in the detail view
export const OLD_MACHINERY_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'no_new_damage',   label: 'Is the machine free of new damage since last use?' },
  { key: 'fluid_levels',    label: 'Are all fluid levels checked (fuel, oil, hydraulic)?' },
  { key: 'brakes_steering', label: 'Are brakes and steering operating correctly?' },
  { key: 'guards_safety',   label: 'Are all guards and safety devices in place?' },
  { key: 'seatbelt',        label: 'Is the seatbelt working and in good condition?' },
  { key: 'tyres_tracks',    label: 'Are tyres/tracks in good condition?' },
  { key: 'greased_today',   label: 'Has the machine been greased today?' },
  { key: 'faults_concerns', label: 'Are there any faults or concerns to report?', inverted: true },
]

export function isBadAnswer(item: ChecklistItem, val: string | undefined | null): boolean {
  if (!val) return false
  return item.inverted ? val === 'yes' : val === 'no'
}
