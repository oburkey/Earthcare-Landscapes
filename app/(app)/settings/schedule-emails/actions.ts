'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { MutationState } from '@/types/actions'
import { fetchWeeklyEmailData, fetchMonthlyEmailData } from '@/lib/emails/data'
import { renderWeeklyEmailHtml } from '@/lib/emails/weeklyTemplate'
import { renderMonthlyEmailHtml } from '@/lib/emails/monthlyTemplate'
import { sendScheduleEmail } from '@/lib/emails/send'
import { formatDate, todayInPerth } from '@/lib/emails/dateUtils'

async function requireAdmin() {
  const profile = await requireAuth()
  if (profile.role !== 'admin') throw new Error('Admin access required')
  return profile
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type ListType = 'weekly' | 'monthly'

function isListType(v: FormDataEntryValue | null): v is ListType {
  return v === 'weekly' || v === 'monthly'
}

// Rows are unique per email, so "on both lists" is represented as a single
// row with email_type = 'both' rather than two rows. Adding to the other
// list upgrades weekly/monthly -> both; removing from one side of a 'both'
// row downgrades it rather than deleting it.
export async function addEmailRecipient(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }

  const list = formData.get('list')
  if (!isListType(list)) return { error: 'Invalid list.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('email_recipients')
    .select('id, email_type')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.email_type === list || existing.email_type === 'both') {
      return { error: 'That email is already on this list.' }
    }
    const { error } = await supabase
      .from('email_recipients')
      .update({ email_type: 'both' })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('email_recipients')
      .insert({ email, email_type: list, created_by: profile.id })
    if (error) {
      if (error.code === '23505') return { error: 'That email is already on this list.' }
      return { error: error.message }
    }
  }

  revalidatePath('/settings/schedule-emails')
  return { success: 'Recipient added.' }
}

export async function removeEmailRecipient(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }

  const list = formData.get('list')
  if (!isListType(list)) return { error: 'Invalid list.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Recipient ID is missing.' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('email_recipients')
    .select('email_type')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return { error: 'Recipient not found.' }

  if (existing.email_type === 'both') {
    const remaining: ListType = list === 'weekly' ? 'monthly' : 'weekly'
    const { error } = await supabase
      .from('email_recipients')
      .update({ email_type: remaining })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('email_recipients').delete().eq('id', id)
    if (error) return { error: error.message }
  }

  revalidatePath('/settings/schedule-emails')
  return { success: 'Recipient removed.' }
}

export async function previewWeeklyEmail(): Promise<{ html?: string; error?: string }> {
  try {
    await requireAdmin()
    const data = await fetchWeeklyEmailData()
    return { html: renderWeeklyEmailHtml(data) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to build preview.' }
  }
}

export async function previewMonthlyEmail(): Promise<{ html?: string; error?: string }> {
  try {
    await requireAdmin()
    const data = await fetchMonthlyEmailData()
    return { html: renderMonthlyEmailHtml(data) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to build preview.' }
  }
}

export async function sendTestWeeklyEmail(): Promise<MutationState> {
  let profile
  try {
    profile = await requireAdmin()
  } catch {
    return { error: 'Admin access required.' }
  }
  if (!profile.email) return { error: 'Your account has no email address on file.' }

  const data = await fetchWeeklyEmailData()
  const html = renderWeeklyEmailHtml(data)
  const { error } = await sendScheduleEmail({
    to: [profile.email],
    subject: `[TEST] Weekly schedule report — ${formatDate(todayInPerth())}`,
    html,
  })
  if (error) return { error }
  return { success: `Test email sent to ${profile.email}.` }
}

export async function sendTestMonthlyEmail(): Promise<MutationState> {
  let profile
  try {
    profile = await requireAdmin()
  } catch {
    return { error: 'Admin access required.' }
  }
  if (!profile.email) return { error: 'Your account has no email address on file.' }

  const data = await fetchMonthlyEmailData()
  const html = renderMonthlyEmailHtml(data)
  const { error } = await sendScheduleEmail({
    to: [profile.email],
    subject: `[TEST] Monthly report — ${data.monthLabel}`,
    html,
  })
  if (error) return { error }
  return { success: `Test email sent to ${profile.email}.` }
}
