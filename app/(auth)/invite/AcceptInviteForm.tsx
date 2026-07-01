'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvite } from './actions'

interface Props {
  token: string
  email: string
}

export default function AcceptInviteForm({ token, email }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    formData.set('token', token)
    const result = await acceptInvite(formData)

    if (result?.error) {
      setError(result.error)
      setPending(false)
      return
    }

    // Stub user's password is now set — sign in client-side
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: formData.get('password') as string,
    })

    if (signInError) {
      setError('Account activated but sign-in failed. Please go to the login page.')
      setPending(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-stone-700">Email</label>
        <input
          value={email}
          disabled
          className="mt-1 block w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-stone-700">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            autoComplete="given-name"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-stone-700">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            autoComplete="family-name"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {pending ? 'Setting up account…' : 'Set up account'}
      </button>
    </form>
  )
}
