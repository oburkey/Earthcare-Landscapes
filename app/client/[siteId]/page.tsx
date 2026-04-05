import { requireAuth } from '@/lib/auth'

interface Props {
  params: Promise<{ siteId: string }>
}

export default async function ClientSitePage({ params }: Props) {
  const { siteId } = await params
  await requireAuth()

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Your site progress</h1>
      <p className="mt-1 text-sm text-stone-500">Coming soon — site {siteId}.</p>
    </div>
  )
}
