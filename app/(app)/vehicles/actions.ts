'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

type ActionState = { error?: string; success?: string } | null

function parseFields(formData: FormData) {
  const str  = (key: string) => (formData.get(key) as string)?.trim() || null
  const date = (key: string) => (formData.get(key) as string)?.trim() || null
  const num  = (key: string): number | null => {
    const v = (formData.get(key) as string)?.trim()
    if (!v) return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }
  const int  = (key: string): number | null => {
    const v = (formData.get(key) as string)?.trim()
    if (!v) return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const make  = (formData.get('make') as string)?.trim()
  const model = (formData.get('model') as string)?.trim()

  return {
    make,
    model,
    year:                   int('year'),
    registration:           str('registration'),
    assigned_to:            str('assigned_to'),
    rego_expiry_date:       date('rego_expiry_date'),
    insurance_expiry_date:  date('insurance_expiry_date'),
    last_service_date:      date('last_service_date'),
    last_service_hours:     num('last_service_hours'),
    last_service_odometer:  int('last_service_odometer'),
    next_service_due_date:  date('next_service_due_date'),
    next_service_km:        int('next_service_km'),
    next_service_hours:     num('next_service_hours'),
    notes:                  str('notes'),
  }
}

function validate(fields: ReturnType<typeof parseFields>): string | null {
  if (!fields.make) return 'Make is required.'
  if (!fields.model) return 'Model is required.'
  if (fields.year !== null && (fields.year < 1900 || fields.year > 2100)) return 'Enter a valid year.'
  return null
}

export async function createVehicle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can manage vehicles.' }
  }

  const fields = parseFields(formData)
  const err = validate(fields)
  if (err) return { error: err }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').insert(fields)
  if (error) return { error: error.message }

  revalidatePath('/vehicles')
  return { success: 'Vehicle added.' }
}

export async function updateVehicle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can manage vehicles.' }
  }

  const vehicleId = formData.get('vehicle_id') as string
  const fields = parseFields(formData)
  const err = validate(fields)
  if (err) return { error: err }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update(fields)
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  revalidatePath('/vehicles')
  return { success: 'Saved.' }
}

export async function deleteVehicle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can manage vehicles.' }
  }

  const vehicleId = formData.get('vehicle_id') as string
  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
  if (error) return { error: error.message }

  revalidatePath('/vehicles')
  return { success: 'Vehicle removed.' }
}
