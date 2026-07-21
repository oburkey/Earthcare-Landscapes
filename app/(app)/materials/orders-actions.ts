'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import type { ActionState } from '@/types/actions'

export const ORDER_ITEM_CATEGORIES = [
  'Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses',
  'Hedging', 'Trees', 'Mulch', 'Edging', 'Turf', 'Drippers', 'Other',
] as const

export const ORDER_STATUSES = ['draft', 'ordered', 'on_hold', 'delivered'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const ATTACHMENT_TYPES = ['invoice', 'photo', 'document'] as const
export type AttachmentType = typeof ATTACHMENT_TYPES[number]

function canManageOrders(role: string): boolean {
  return role === 'leading_hand' || role === 'supervisor' || role === 'admin'
}

export type OrderItemPayload = {
  category: string
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  notes: string
}

export async function createOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can create orders.' }

  const siteId       = formData.get('site_id') as string
  const supplierId   = (formData.get('supplier_id') as string) || null
  const orderDate     = (formData.get('order_date') as string) || new Date().toISOString().split('T')[0]
  const deliveryDate  = (formData.get('delivery_date') as string) || null
  const notes         = (formData.get('notes') as string)?.trim() || null
  const status        = formData.get('status') === 'ordered' ? 'ordered' : 'draft'

  if (!siteId) return { error: 'Site is required.' }

  let items: OrderItemPayload[]
  try {
    items = JSON.parse((formData.get('items') as string) || '[]')
  } catch {
    return { error: 'Invalid line items.' }
  }
  items = items.filter((i) => i.category && (i.description?.trim() || i.quantity > 0))
  if (items.length === 0) return { error: 'Add at least one line item.' }

  const supabase = await createClient()

  const { data: order, error: orderError } = await supabase
    .from('material_orders')
    .insert({
      site_id:      siteId,
      supplier_id:  supplierId,
      order_date:   orderDate,
      delivery_date: deliveryDate,
      notes,
      status,
      created_by:   profile.id,
    })
    .select('id')
    .single()

  if (orderError || !order) return { error: orderError?.message ?? 'Failed to create order.' }

  const { error: itemsError } = await supabase
    .from('material_order_items')
    .insert(items.map((item, i) => ({
      order_id:    order.id,
      category:    item.category,
      description: item.description?.trim() || '',
      quantity:    item.quantity || 0,
      unit:        item.unit?.trim() || '',
      unit_price:  item.unit_price ?? null,
      notes:       item.notes?.trim() || null,
      order_index: i,
    })))

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/materials')
  return null
}

export async function deleteOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete orders.' }

  const orderId = formData.get('order_id') as string
  if (!orderId) return { error: 'Order ID is missing.' }

  const supabase = await createClient()

  const { data: attachments } = await supabase
    .from('material_order_attachments')
    .select('storage_path')
    .eq('order_id', orderId)

  await Promise.all(
    (attachments ?? []).map((a) => deleteFromR2(a.storage_path).catch(() => null))
  )

  const { error } = await supabase.from('material_orders').delete().eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath('/materials')
  return null
}

// ── Status flow ───────────────────────────────────────────────────────────────

export async function submitOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return transitionStatus(formData, 'draft', 'ordered')
}

export async function holdOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return transitionStatus(formData, 'ordered', 'on_hold')
}

export async function reactivateOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return transitionStatus(formData, 'on_hold', 'ordered')
}

async function transitionStatus(
  formData: FormData,
  from: OrderStatus,
  to: OrderStatus
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can update orders.' }

  const orderId = formData.get('order_id') as string
  if (!orderId) return { error: 'Order ID is missing.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('material_orders')
    .update({ status: to })
    .eq('id', orderId)
    .eq('status', from)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Order is no longer in the expected state — refresh and try again.' }

  revalidatePath('/materials')
  return null
}

// Marks an order delivered, recording the actual delivery date + invoice
// amount, and optionally adds unambiguous item quantities (Mulch/Edging/
// Turf/Drippers) to site_stock. Plant categories are NOT auto-added — order
// line items don't record pot size (140mm vs 200mm), so there's no reliable
// way to attribute plant quantities to a stock column automatically.
export async function markOrderDelivered(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can update orders.' }

  const orderId       = formData.get('order_id') as string
  const deliveredDate = (formData.get('delivered_date') as string) || new Date().toISOString().split('T')[0]
  const invoiceRaw    = (formData.get('invoice_amount') as string)?.trim()
  const invoiceAmount = invoiceRaw ? parseFloat(invoiceRaw) : null
  const updateStock   = formData.get('update_stock') === 'true'

  if (!orderId) return { error: 'Order ID is missing.' }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('material_orders')
    .select('id, site_id, status')
    .eq('id', orderId)
    .single()
  if (fetchError || !order) return { error: 'Order not found.' }
  if (order.status !== 'ordered' && order.status !== 'on_hold') {
    return { error: 'Order is no longer in the expected state — refresh and try again.' }
  }

  const { data, error } = await supabase
    .from('material_orders')
    .update({
      status:         'delivered',
      delivery_date:  deliveredDate,
      delivered_at:   new Date().toISOString(),
      invoice_amount: invoiceAmount,
    })
    .eq('id', orderId)
    .in('status', ['ordered', 'on_hold'])
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Order is no longer in the expected state — refresh and try again.' }

  if (updateStock) {
    const { data: items } = await supabase
      .from('material_order_items')
      .select('category, quantity, unit')
      .eq('order_id', orderId)

    const stockDelta = { mulch_tonnes: 0, edging_metres: 0, turf_rolls: 0, drippers_packs: 0 }
    for (const item of items ?? []) {
      const unit = (item.unit || '').toLowerCase()
      const qty  = Number(item.quantity) || 0
      if (item.category === 'Mulch'    && unit.includes('tonne'))               stockDelta.mulch_tonnes  += qty
      if (item.category === 'Edging'   && (unit.includes('metre') || unit.includes('meter'))) stockDelta.edging_metres += qty
      if (item.category === 'Turf'     && unit.includes('roll'))                stockDelta.turf_rolls    += qty
      if (item.category === 'Drippers' && unit.includes('pack'))                stockDelta.drippers_packs += qty
    }

    const hasDelta = Object.values(stockDelta).some((v) => v > 0)
    if (hasDelta) {
      const { data: existing } = await supabase
        .from('site_stock')
        .select('mulch_tonnes, edging_metres, turf_rolls, drippers_packs')
        .eq('site_id', order.site_id)
        .maybeSingle()

      await supabase.from('site_stock').upsert({
        site_id:          order.site_id,
        mulch_tonnes:     Number(existing?.mulch_tonnes ?? 0) + stockDelta.mulch_tonnes,
        edging_metres:    Number(existing?.edging_metres ?? 0) + stockDelta.edging_metres,
        turf_rolls:       Number(existing?.turf_rolls ?? 0) + stockDelta.turf_rolls,
        drippers_packs:   Number(existing?.drippers_packs ?? 0) + stockDelta.drippers_packs,
        last_updated_by:  profile.id,
      }, { onConflict: 'site_id' })

      revalidatePath('/materials')
    }
  }

  revalidatePath('/materials')
  return null
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function uploadOrderAttachment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can upload attachments.' }

  const orderId        = formData.get('order_id') as string
  const attachmentType = formData.get('attachment_type') as string
  const file            = formData.get('file') as File

  if (!orderId) return { error: 'Order ID is missing.' }
  if (!ATTACHMENT_TYPES.includes(attachmentType as AttachmentType)) return { error: 'Invalid attachment type.' }
  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 20 * 1024 * 1024) return { error: 'File too large (max 20 MB).' }

  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const key = `material-order-attachments/${orderId}/${crypto.randomUUID()}${ext}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, file.type || 'application/octet-stream')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('material_order_attachments').insert({
    order_id:        orderId,
    attachment_type: attachmentType,
    storage_path:    key,
    file_name:       file.name,
    uploaded_by:     profile.id,
  })

  if (dbError) {
    await deleteFromR2(key).catch(() => null)
    return { error: dbError.message }
  }

  revalidatePath('/materials')
  return null
}

export async function deleteOrderAttachment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can delete attachments.' }

  const attachmentId = formData.get('attachment_id') as string
  if (!attachmentId) return { error: 'Attachment ID is missing.' }

  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('material_order_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single()

  if (attachment?.storage_path) {
    await deleteFromR2(attachment.storage_path).catch(() => null)
  }

  const { error } = await supabase.from('material_order_attachments').delete().eq('id', attachmentId)
  if (error) return { error: error.message }

  revalidatePath('/materials')
  return null
}
