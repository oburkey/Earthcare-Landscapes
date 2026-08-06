import { createClient } from '@/lib/supabase/server'
import ScheduleEmailsSettings from './ScheduleEmailsSettings'

export const metadata = { title: 'Schedule Emails — Earthcare Landscapes' }

export default async function ScheduleEmailsSettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('email_recipients')
    .select('id, email')
    .order('email', { ascending: true })

  return (
    <div className="min-h-screen bg-surface-raised">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-fg">Schedule Emails</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Weekly (Friday 7am) and monthly (1st of the month, 7am) schedule reports, sent via GitHub Actions.
          </p>
        </div>
        <ScheduleEmailsSettings recipients={data ?? []} />
      </div>
    </div>
  )
}
