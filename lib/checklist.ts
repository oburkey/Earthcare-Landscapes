// Static definition of the lot completion checklist.
// Item keys are stored in lot_checklist_items.item_key — treat them as
// stable identifiers; renaming a key here orphans existing saved rows.

export type ChecklistSectionId = 'pre_checks' | 'landscaping_works' | 'finishing'

export interface ChecklistItemDef {
  key: string
  label: string
  type: 'checkbox' | 'yesno'
}

export interface ChecklistSectionDef {
  id: ChecklistSectionId
  title: string
  gatesBuildComplete: boolean
  items: ChecklistItemDef[]
}

export const CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
  {
    id: 'pre_checks',
    title: 'Pre-Checks',
    gatesBuildComplete: false,
    items: [
      { key: 'pc_backfill_grading',        label: 'Backfill, fine grading, rubbish removal',                   type: 'checkbox' },
      { key: 'pc_retic_water_meter',       label: 'Retic cut/water meter position correct (prelay)',           type: 'checkbox' },
      { key: 'pc_power_point_retic',       label: 'Power point for retic box correct location (prelay)',       type: 'checkbox' },
      { key: 'pc_downpipes_checked',       label: 'Downpipes require raising or lowering — checked',           type: 'checkbox' },
      { key: 'pc_fence_screen_posts',      label: 'Fence/screen posts installed',                              type: 'checkbox' },
      { key: 'pc_planterbox_installed',    label: 'Planterbox installed, waterproofed, drainage, retic cut in', type: 'checkbox' },
      { key: 'pc_retaining_walls',         label: 'Retaining walls, planter boxes, fence plinths installed',   type: 'checkbox' },
      { key: 'pc_check_supply_order',      label: 'Check supply and order: plants, trees, turf, retic, steppers', type: 'checkbox' },
      { key: 'pc_check_prelays',           label: 'Check prelays',                                             type: 'checkbox' },
    ],
  },
  {
    id: 'landscaping_works',
    title: 'Landscaping Works',
    gatesBuildComplete: true,
    items: [
      { key: 'lw_fine_grade',              label: 'Fine grade',                                  type: 'checkbox' },
      { key: 'lw_garden_bed_turf_marked',  label: 'Garden bed & turf area marked out',           type: 'checkbox' },
      { key: 'lw_irrigation_installed',    label: 'Irrigation installed and running',            type: 'checkbox' },
      { key: 'lw_irrigation_valve',        label: 'Irrigation valve installed',                  type: 'checkbox' },
      { key: 'lw_plant_set_out_approved',  label: 'Plant set out and approved',                  type: 'checkbox' },
      { key: 'lw_plants_installed',        label: 'Plants installed and fertilised',             type: 'checkbox' },
      { key: 'lw_planting_install_approved', label: 'Planting install approved',                 type: 'checkbox' },
      { key: 'lw_drippers_installed',      label: 'Drippers installed where required',           type: 'checkbox' },
      { key: 'lw_edging_installed',        label: 'Edging installed',                            type: 'yesno' },
      { key: 'lw_turf_installed',          label: 'Turf installed',                              type: 'yesno' },
      { key: 'lw_steppers_installed',      label: 'Steppers installed',                          type: 'yesno' },
      { key: 'lw_feature_tree_set_out',    label: 'Feature tree set out',                        type: 'yesno' },
      { key: 'lw_rock_installed',          label: 'Rock installed',                              type: 'yesno' },
      { key: 'lw_tree_installed_pills',    label: 'Tree installed with tree pills',              type: 'yesno' },
      { key: 'lw_tree_stake_tie_approved', label: 'Tree stake/tie installed and approved',       type: 'yesno' },
    ],
  },
  {
    id: 'finishing',
    title: 'Finishing',
    gatesBuildComplete: true,
    items: [
      { key: 'fin_hardstand_clean',   label: 'Hardstand area clean and swept',                type: 'checkbox' },
      { key: 'fin_valve_box',         label: 'Valve box installed',                           type: 'checkbox' },
      { key: 'fin_mulch',             label: 'Mulch — even thickness, decollar, covering retic', type: 'checkbox' },
      { key: 'fin_general_clean',     label: 'General site clean',                            type: 'checkbox' },
      { key: 'fin_retic_timer_set',   label: 'Retic timer set',                               type: 'checkbox' },
      { key: 'fin_quantity_survey',   label: 'Quantity survey taken',                         type: 'checkbox' },
    ],
  },
]

// Item keys whose completion gates the lot's build_complete flag.
export const GATING_ITEM_KEYS = new Set(
  CHECKLIST_SECTIONS.filter((s) => s.gatesBuildComplete).flatMap((s) => s.items.map((i) => i.key))
)

export const TOTAL_CHECKLIST_ITEMS = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
