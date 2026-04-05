// Login page — the entry point for all users.
// Uses a Server Action to call Supabase auth, keeping credentials off the client.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in — Earthcare Landscapes' }

export default async function LoginPage() {
  // If already logged in, send straight to dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Earthcare Landscapes</h1>
          <p className="mt-1 text-sm text-stone-500">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
