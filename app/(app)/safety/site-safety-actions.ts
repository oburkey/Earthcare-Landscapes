'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { pickCompanySafety, pickSiteSafety } from '@/lib/siteSafety'

// Safety Admin → Site safety details. Company details are admin-only; site
// details are supervisor+ (matching the RLS policies in
// migration_safety_site_details.sql). Saving site details also counts as a
// review; "Mark reviewed, no changes" stamps the review alone.

type Result = { success?: true; error?: string }

function isSupervisorPlus(role: string) {
  return role === 'supervisor' || role === 'admin'
}

function emptyToNull<T extends Record<string, string>>(values: T): Record<keyof T, string | null> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])) as Record<keyof T, string | null>
}

export async function saveCompanyDetails(values: Record<string, string>): Promise<Result> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can edit company details.' }

  const clean = pickCompanySafety(values)
  if (!clean.company_name) return { error: 'Company name is required.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_safety_details')
    .update({ ...emptyToNull(clean), company_name: clean.company_name, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq('id', true)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Company details could not be saved — the row is missing or you do not have permission.' }

  revalidatePath('/safety')
  return { success: true }
}

export async function saveSiteSafetyDetails(siteId: string, values: Record<string, string>): Promise<Result> {
  const profile = await requireAuth()
  if (!isSupervisorPlus(profile.role)) return { error: 'Only supervisors and admins can edit site safety details.' }
  if (!siteId) return { error: 'No site selected.' }

  const now = new Date().toISOString()
  const row = {
    ...emptyToNull(pickSiteSafety(values)),
    last_reviewed_at: now,
    last_reviewed_by: profile.id,
    updated_at:       now,
    updated_by:       profile.id,
  }

  const supabase = await createClient()
  const { data: updated, error: updateError } = await supabase
    .from('site_safety_details')
    .update(row)
    .eq('site_id', siteId)
    .select('site_id')
  if (updateError) return { error: updateError.message }

  if (!updated || updated.length === 0) {
    // First save for this site
    const { data: inserted, error: insertError } = await supabase
      .from('site_safety_details')
      .insert({ site_id: siteId, ...row })
      .select('site_id')
    if (insertError) return { error: insertError.message }
    if (!inserted || inserted.length === 0) return { error: 'Site safety details could not be saved — you may not have permission.' }
  }

  revalidatePath('/safety')
  return { success: true }
}

export async function markSiteReviewed(siteId: string): Promise<Result> {
  const profile = await requireAuth()
  if (!isSupervisorPlus(profile.role)) return { error: 'Only supervisors and admins can review site safety details.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_safety_details')
    .update({ last_reviewed_at: new Date().toISOString(), last_reviewed_by: profile.id })
    .eq('site_id', siteId)
    .select('site_id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'This site has no safety details yet — fill them in and save instead.' }

  revalidatePath('/safety')
  return { success: true }
}
