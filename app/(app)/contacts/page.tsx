import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ContactsView from './ContactsView'
import type { Contact } from '@/types/database'

export const metadata = { title: 'Contacts — Earthcare Landscapes' }

export default async function ContactsPage() {
  const profile = await requireAuth()
  requireRole(profile, 'leading_hand')

  const canManage = profile.role === 'supervisor' || profile.role === 'admin'

  const supabase = await createClient()

  const { data } = await supabase
    .from('contacts')
    .select('id, name, company, phone, email, category, notes, created_at, updated_at')
    .order('name', { ascending: true })

  const contacts: Contact[] = (data ?? []).map((c) => ({
    id:         c.id as string,
    name:       c.name as string,
    company:    (c.company ?? null) as string | null,
    phone:      (c.phone ?? null) as string | null,
    email:      (c.email ?? null) as string | null,
    category:   (c.category ?? null) as string | null,
    notes:      (c.notes ?? null) as string | null,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ContactsView contacts={contacts} canManage={canManage} />
      </div>
    </div>
  )
}
