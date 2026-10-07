'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { MutationState } from '@/types/actions'
import { fetchWeeklyEmailData, fetchMonthlyEmailData } from '@/lib/emails/data'
import { renderWeeklyEmailHtml } from '@/lib/emails/weeklyTemplate'
import { renderMonthlyEmailHtml } from '@/lib/emails/monthlyTemplate'
import { renderIssuesEmailHtml } from '@/lib/emails/issuesTemplate'
import { getQuantIssues } from '@/lib/quantIssues'
import { sendScheduleEmail } from '@/lib/emails/send'
import { formatDate, todayInPerth } from '@/lib/emails/dateUtils'

async function requireAdmin() {
  const profile = await requireAuth()
  if (profile.role !== 'admin') throw new Error('Admin access required')
  return profile
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type ListType = 'weekly' | 'monthly' | 'issues'

function isListType(v: FormDataEntryValue | null): v is ListType {
  return v === 'weekly' || v === 'monthly' || v === 'issues'
}

// Rows are unique per email (email_recipients.email is UNIQUE). Weekly/monthly
// share one sentinel column (email_type: 'weekly' | 'monthly' | 'both' | null)
// — adding the other list upgrades to 'both', removing one side of 'both'
// downgrades rather than deletes. 'issues' is a fully independent flag
// (wants_issues) so it can be toggled without disturbing weekly/monthly, and
// vice versa — a row is only deleted once nothing references it at all.
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
    .select('id, email_type, wants_issues')
    .eq('email', email)
    .maybeSingle()

  if (list === 'issues') {
    if (existing) {
      if (existing.wants_issues) return { error: 'That email is already on this list.' }
      const { error } = await supabase
        .from('email_recipients')
        .update({ wants_issues: true })
        .eq('id', existing.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase
        .from('email_recipients')
        .insert({ email, wants_issues: true, created_by: profile.id })
      if (error) {
        if (error.code === '23505') return { error: 'That email is already on this list.' }
        return { error: error.message }
      }
    }
  } else {
    if (existing) {
      if (existing.email_type === list || existing.email_type === 'both') {
        return { error: 'That email is already on this list.' }
      }
      const nextType = existing.email_type == null ? list : 'both'
      const { error } = await supabase
        .from('email_recipients')
        .update({ email_type: nextType })
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
    .select('email_type, wants_issues')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return { error: 'Recipient not found.' }

  // Only clear the list being removed from — a row that's also on another
  // list (e.g. weekly + issues) must survive with the other membership intact.
  let nextEmailType: 'weekly' | 'monthly' | 'both' | null = existing.email_type
  let nextWantsIssues = existing.wants_issues
  if (list === 'issues') {
    nextWantsIssues = false
  } else if (existing.email_type === 'both') {
    nextEmailType = list === 'weekly' ? 'monthly' : 'weekly'
  } else {
    nextEmailType = null
  }

  if (nextEmailType === null && !nextWantsIssues) {
    const { error } = await supabase.from('email_recipients').delete().eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('email_recipients')
      .update({ email_type: nextEmailType, wants_issues: nextWantsIssues })
      .eq('id', id)
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

export async function previewIssuesEmail(): Promise<{ html?: string; error?: string }> {
  try {
    await requireAdmin()
    const issues = await getQuantIssues()
    return { html: renderIssuesEmailHtml(issues) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to build preview.' }
  }
}

export async function sendTestIssuesEmail(): Promise<MutationState> {
  let profile
  try {
    profile = await requireAdmin()
  } catch {
    return { error: 'Admin access required.' }
  }
  if (!profile.email) return { error: 'Your account has no email address on file.' }

  const issues = await getQuantIssues()
  const html = renderIssuesEmailHtml(issues)
  const { error } = await sendScheduleEmail({
    to: [profile.email],
    subject: `[TEST] Quant sheet & invoicing issues — ${formatDate(todayInPerth())}`,
    html,
  })
  if (error) return { error }
  return { success: `Test email sent to ${profile.email}.` }
}
