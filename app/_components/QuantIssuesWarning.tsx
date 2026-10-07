// Admin-only amber warning listing flagged quant-sheet/invoicing issues —
// shared by the lot detail page and the invoices page. Renders nothing when
// there's nothing to flag, so callers can render it unconditionally.

export default function QuantIssuesWarning({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-1.5">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
        {issues.length} issue{issues.length !== 1 ? 's' : ''} flagged
      </p>
      <ul className="space-y-1">
        {issues.map((issue, i) => (
          <li key={i} className="text-sm text-amber-700 dark:text-amber-400">• {issue}</li>
        ))}
      </ul>
    </div>
  )
}
