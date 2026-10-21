// Server wrapper shared by /files and the site page's Files tab: loads the
// filter tree and the first page, then hands off to the client browser.

import { getCachedFilesFilterTree } from '@/lib/data'
import type { Profile } from '@/types/database'
import FilesBrowser from './FilesBrowser'
import { fetchFilesPage } from './queries'
import type { FilterTreeSite } from './types'

type RawTreeSite = {
  id: string
  name: string
  stages: { id: string; name: string; order: number | null; lots: { id: string; lot_number: string }[] | null }[] | null
}

function toTree(raw: RawTreeSite[]): FilterTreeSite[] {
  return raw.map((s) => ({
    id: s.id,
    name: s.name,
    stages: [...(s.stages ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st) => ({
        id: st.id,
        name: st.name,
        lots: [...(st.lots ?? [])]
          .sort((a, b) => a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true }))
          .map((l) => ({ id: l.id, lotNumber: l.lot_number })),
      })),
  }))
}

export default async function FilesView({ profile, siteId }: { profile: Profile; siteId?: string }) {
  const [rawTree, initial] = await Promise.all([
    getCachedFilesFilterTree(),
    fetchFilesPage({ siteId }, 0),
  ])

  return (
    <FilesBrowser
      tree={toTree(rawTree as RawTreeSite[])}
      initial={initial}
      lockedSiteId={siteId}
      currentUserId={profile.id}
      isAdmin={profile.role === 'admin'}
    />
  )
}
