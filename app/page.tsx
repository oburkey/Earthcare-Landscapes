import { redirect } from 'next/navigation'

// The root URL just redirects — the middleware handles auth,
// so logged-in users go to /dashboard and others go to /login.
export default function RootPage() {
  redirect('/dashboard')
}
