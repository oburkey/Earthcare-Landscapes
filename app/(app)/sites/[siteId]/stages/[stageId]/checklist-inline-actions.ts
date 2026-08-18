'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CHECKLIST_SECTIONS, type ChecklistSectionId } from '@/lib/checklist'
import type { ActionState } from '@/types/actions'

function findSection(itemKey: string): ChecklistSectionId | null {
  for (const section of CHECKLIST_SECTIONS) {
    if (section.items.some((i) => i.key === itemKey)) return section.id
  }
  return null
}

// Toggles a single checklist item from the stage-level table view — a
// lighter-weight sibling to lots/[lotId]/actions.ts's updateChecklist, which
// submits the whole per-lot form at once. Both write the same
// lot_checklist_items table, so the lot detail page and this table stay in sync.
export async function toggleChecklistItemInline(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can update the checklist.' }
  }

  const lotId     = formData.get('lot_id')   as string
  const siteId    = formData.get('site_id')  as string
  const stageId   = formData.get('stage_id') as string
  const itemKey   = formData.get('item_key') as string
  const completed = formData.get('completed') === 'true'

  if (!lotId) return { error: 'Lot ID is missing.' }

  const section = findSection(itemKey)
  if (!section) return { error: 'Unknown checklist item.' }

  const today = new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { error } = await supabase
    .from('lot_checklist_items')
    .upsert(
      {
        lot_id: lotId,
        section,
        item_key: itemKey,
        completed,
        completed_date: completed ? today : null,
        completed_by: completed ? profile.id : null,
      },
      { onConflict: 'lot_id,item_key' }
    )

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidateTag('stages')
  return null
}

// Build Complete lives on lots.build_complete, not the checklist table —
// same field toggleLotFlag manages from the lot detail page, just with a
// matching FormData shape ("completed") so it can share InlineCheckbox.
export async function toggleBuildCompleteInline(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can toggle Build Complete.' }
  }

  const lotId     = formData.get('lot_id')   as string
  const siteId    = formData.get('site_id')  as string
  const stageId   = formData.get('stage_id') as string
  const completed = formData.get('completed') === 'true'

  if (!lotId) return { error: 'Lot ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({
      build_complete: completed,
      build_completed_at: completed ? new Date().toISOString() : null,
      updated_by: profile.id,
    })
    .eq('id', lotId)

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidateTag('stages')
  return null
}
