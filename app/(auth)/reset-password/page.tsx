'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PageState = 'loading' | 'ready' | 'error' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [linkError, setLinkError]   = useState<string | null>(null)
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [formError, setFormError]   = useState<string | null>(null)
  const [pending, setPending]       = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const code = new URLSearchParams(window.location.search).get('code')

    if (code) {
      // PKCE flow: exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setLinkError('This reset link is invalid or has expired.')
          setPageState('error')
        } else {
          // Remove the code from the URL so it can't be replayed
          window.history.replaceState({}, '', window.location.pathname)
          setPageState('ready')
        }
      })
      return
    }

    // Implicit / legacy flow: listen for PASSWORD_RECOVERY event from URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPageState('ready')
    })

    // Also check for an existing recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState('ready')
      } else {
        // Page was opened directly without a valid link
        setLinkError('Please use the link from your password reset email.')
        setPageState('error')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)

    if (password !== confirm) {
      setFormError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setFormError(error.message)
      setPending(false)
    } else {
      router.push('/dashboard')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-400">Verifying reset link…</p>
      </div>
    )
  }

  // ── Invalid link ─────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900">Link invalid or expired</h1>
          <p className="text-sm text-stone-500">{linkError}</p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Request a new link
          </Link>
          <p className="pt-1">
            <Link href="/login" className="text-sm text-stone-500 hover:text-stone-700">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Set new password</h1>
          <p className="mt-1 text-sm text-stone-500">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
            <p className="mt-1 text-xs text-stone-400">Minimum 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-stone-700">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
