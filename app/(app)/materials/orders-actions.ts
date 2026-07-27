'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { ATTACHMENT_TYPES, type AttachmentType, type OrderStatus } from './order-constants'
import { CATEGORY_TO_STOCK_FIELD, STOCK_FIELDS, type StockField } from './stock-constants'
import type { ActionState, MutationState } from '@/types/actions'

function canManageOrders(role: string): boolean {
  return role === 'leading_hand' || role === 'supervisor' || role === 'admin'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logDbError(context: string, error: any, extra?: Record<string, unknown>) {
  console.error(`[materials/orders-actions] ${context}:`, {
    message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
    ...extra,
  })
}

export type OrderItemPayload = {
  category: string
  plant_type: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  notes: string
  // Explicit site_stock column override for suggestion-added linked-material
  // line items (see markOrderDelivered). Null for ordinary category-driven
  // items, which resolve their stock column from CATEGORY_TO_STOCK_FIELD instead.
  stock_field: string | null
  // Species name for items added via the bulk plant-add parser — used only to
  // grow the plant_species dictionary after the order is created (see
  // createOrder below). Not a column on material_order_items; null for
  // manually-entered items.
  species_name: string | null
}

export async function createOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can create orders.' }

  try {
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

    if (orderError || !order) {
      if (orderError) logDbError('createOrder insert material_orders', orderError)
      return { error: orderError?.message ?? 'Failed to create order.' }
    }

    const { error: itemsError } = await supabase
      .from('material_order_items')
      .insert(items.map((item, i) => ({
        order_id:    order.id,
        category:    item.category,
        plant_type:  item.plant_type || null,
        description: item.description?.trim() || '',
        quantity:    item.quantity || 0,
        unit:        item.unit?.trim() || '',
        unit_price:  item.unit_price ?? null,
        notes:       item.notes?.trim() || null,
        stock_field: item.stock_field ?? null,
        order_index: i,
      })))

    if (itemsError) { logDbError('createOrder insert material_order_items', itemsError); return { error: itemsError.message } }

    // Grow the plant_species dictionary from any bulk-add items (species_name
    // set client-side, not a material_order_items column). Uses the admin
    // client since plant_species RLS is admin-write-only, but this write is
    // triggered by a leading_hand+ action — same pattern as the pre-start
    // vehicle-hours update and the site_stock delivery write. Existing
    // species are never overwritten (ignoreDuplicates); failures here are
    // non-fatal to order creation.
    const speciesNames = [...new Set(
      items.map((i) => i.species_name?.trim()).filter((n): n is string => !!n)
    )]
    if (speciesNames.length > 0) {
      const adminSupabase = createAdminClient()
      const { error: speciesError } = await adminSupabase
        .from('plant_species')
        .upsert(
          items
            .filter((i) => i.species_name?.trim())
            .map((i) => ({ name: i.species_name!.trim(), default_pot_size: i.category })),
          { onConflict: 'name', ignoreDuplicates: true }
        )
      if (speciesError) logDbError('createOrder upsert plant_species', speciesError, { speciesNames })
    }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/orders-actions] createOrder unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while creating the order.' }
  }
}

export async function deleteOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete orders.' }

  try {
    const orderId = formData.get('order_id') as string
    if (!orderId) return { error: 'Order ID is missing.' }

    const supabase = await createClient()

    const { data: attachments, error: attachmentsFetchError } = await supabase
      .from('material_order_attachments')
      .select('storage_path')
      .eq('order_id', orderId)
    if (attachmentsFetchError) logDbError('deleteOrder fetch material_order_attachments', attachmentsFetchError)

    await Promise.all(
      (attachments ?? []).map((a) => deleteFromR2(a.storage_path).catch(() => null))
    )

    const { error } = await supabase.from('material_orders').delete().eq('id', orderId)
    if (error) { logDbError('deleteOrder delete material_orders', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/orders-actions] deleteOrder unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting the order.' }
  }
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

  try {
    const orderId = formData.get('order_id') as string
    if (!orderId) return { error: 'Order ID is missing.' }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('material_orders')
      .update({ status: to })
      .eq('id', orderId)
      .eq('status', from)
      .select('id')

    if (error) { logDbError(`transitionStatus ${from}->${to}`, error); return { error: error.message } }
    if (!data || data.length === 0) return { error: 'Order is no longer in the expected state — refresh and try again.' }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error(`[materials/orders-actions] transitionStatus ${from}->${to} unexpected error:`, err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while updating the order.' }
  }
}

// Marks an order delivered, recording the actual delivery date + invoice
// amount, and optionally adds delivered quantities to site_stock. Each line
// item's stock column is its explicit stock_field override if set (used by
// linked-material items added from the Orders tab suggestion panel),
// otherwise the primary category (pot size / material type) mapped via
// CATEGORY_TO_STOCK_FIELD — 'Other' has no mapping and is skipped.
export async function markOrderDelivered(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can update orders.' }

  try {
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

    if (error) { logDbError('markOrderDelivered update material_orders', error); return { error: error.message } }
    if (!data || data.length === 0) return { error: 'Order is no longer in the expected state — refresh and try again.' }

    if (updateStock) {
      const { data: items, error: itemsFetchError } = await supabase
        .from('material_order_items')
        .select('category, quantity, stock_field')
        .eq('order_id', orderId)
      if (itemsFetchError) logDbError('markOrderDelivered fetch material_order_items', itemsFetchError, { orderId })

      const stockDelta: Partial<Record<StockField, number>> = {}
      for (const item of items ?? []) {
        const override = item.stock_field as string | null
        const field = override && (STOCK_FIELDS as readonly string[]).includes(override)
          ? (override as StockField)
          : CATEGORY_TO_STOCK_FIELD[item.category]
        if (!field) continue
        const qty = Number(item.quantity) || 0
        if (qty <= 0) continue
        stockDelta[field] = (stockDelta[field] ?? 0) + qty
      }

      const deltaFields = Object.keys(stockDelta) as StockField[]
      if (deltaFields.length === 0) {
        // Requested but nothing mapped to a stock column (e.g. every line
        // item was 'Other') — not an error, just informational.
        console.info('[materials/orders-actions] markOrderDelivered: update_stock requested but no line items mapped to a stock column', { orderId })
      } else {
        // site_stock read/write use the admin client so the write is
        // guaranteed to land once canManageOrders() above has already
        // authorized the caller (leading_hand+) — canManageOrders already
        // matches site_stock's own RLS, so this isn't bypassing a stricter
        // policy, just insurance against any DB-level failure (same
        // reasoning as the pre-start vehicle-hours update in safety/actions.ts).
        const adminSupabase = createAdminClient()
        const { data: existing, error: stockFetchError } = await adminSupabase
          .from('site_stock')
          .select(STOCK_FIELDS.join(', '))
          .eq('site_id', order.site_id)
          .maybeSingle()

        if (stockFetchError) {
          // Abort rather than fall back to a zero baseline — treating a
          // failed read as "site has no existing stock" would upsert only
          // this delivery's delta and silently wipe whatever stock was
          // already recorded.
          logDbError('markOrderDelivered fetch site_stock — aborting stock update', stockFetchError, { siteId: order.site_id, deltaFields, stockDelta })
          revalidatePath('/materials')
          return { success: 'Order marked delivered, but stock could not be updated automatically — update the Stock tab manually.' }
        }

        const existingRow = (existing ?? {}) as Partial<Record<StockField, number>>
        const update: Record<string, unknown> = { site_id: order.site_id, last_updated_by: profile.id }
        for (const field of deltaFields) {
          update[field] = Number(existingRow[field] ?? 0) + (stockDelta[field] ?? 0)
        }

        const { error: stockUpsertError } = await adminSupabase.from('site_stock').upsert(update, { onConflict: 'site_id' })
        if (stockUpsertError) {
          logDbError('markOrderDelivered upsert site_stock', stockUpsertError, { siteId: order.site_id, update })
          revalidatePath('/materials')
          return { success: 'Order marked delivered, but stock could not be updated automatically — update the Stock tab manually.' }
        }

        revalidatePath('/materials')
      }
    }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/orders-actions] markOrderDelivered unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while marking the order delivered.' }
  }
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function uploadOrderAttachment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can upload attachments.' }

  try {
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
      console.error('[materials/orders-actions] uploadOrderAttachment R2 upload error:', e)
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
      logDbError('uploadOrderAttachment insert material_order_attachments', dbError)
      await deleteFromR2(key).catch(() => null)
      return { error: dbError.message }
    }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/orders-actions] uploadOrderAttachment unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while uploading the attachment.' }
  }
}

export async function deleteOrderAttachment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageOrders(profile.role)) return { error: 'Only leading hands and above can delete attachments.' }

  try {
    const attachmentId = formData.get('attachment_id') as string
    if (!attachmentId) return { error: 'Attachment ID is missing.' }

    const supabase = await createClient()

    const { data: attachment, error: fetchError } = await supabase
      .from('material_order_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single()
    if (fetchError) logDbError('deleteOrderAttachment fetch material_order_attachments', fetchError)

    if (attachment?.storage_path) {
      await deleteFromR2(attachment.storage_path).catch(() => null)
    }

    const { error } = await supabase.from('material_order_attachments').delete().eq('id', attachmentId)
    if (error) { logDbError('deleteOrderAttachment delete material_order_attachments', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/orders-actions] deleteOrderAttachment unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting the attachment.' }
  }
}
