'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import type { ActionState } from '@/types/actions'

const CAN_CREATE = ['leading_hand', 'supervisor', 'admin']

export async function createCalendarEvent(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!CAN_CREATE.includes(profile.role)) return { error: 'Not permitted.' }

  const title = (fd.get('title') as string)?.trim()
  if (!title) return { error: 'Title is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('calendar_events').insert({
    title,
    description: (fd.get('description') as string)?.trim() || null,
    event_date: fd.get('event_date') as string,
    end_date: (fd.get('end_date') as string) || null,
    start_time: (fd.get('start_time') as string) || null,
    end_time: (fd.get('end_time') as string) || null,
    created_by: profile.id,
  })
  if (error) return { error: error.message }
  revalidateTag('calendar-events')
  return null
}

export async function updateCalendarEvent(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  const id = fd.get('id') as string

  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('calendar_events')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!ev) return { error: 'Event not found.' }
  if (ev.created_by !== profile.id && profile.role !== 'admin') return { error: 'Not permitted.' }

  const title = (fd.get('title') as string)?.trim()
  if (!title) return { error: 'Title is required.' }

  const { error } = await supabase
    .from('calendar_events')
    .update({
      title,
      description: (fd.get('description') as string)?.trim() || null,
      event_date: fd.get('event_date') as string,
      end_date: (fd.get('end_date') as string) || null,
      start_time: (fd.get('start_time') as string) || null,
      end_time: (fd.get('end_time') as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateTag('calendar-events')
  return null
}

export async function deleteCalendarEvent(id: string): Promise<ActionState> {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: ev } = await supabase
    .from('calendar_events')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!ev) return { error: 'Event not found.' }
  if (ev.created_by !== profile.id && profile.role !== 'admin') return { error: 'Not permitted.' }

  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateTag('calendar-events')
  return null
}
