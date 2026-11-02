@AGENTS.md
## Behaviour Rules
- Do NOT attempt the same fix more than 2 times. On the 3rd failure, stop and explain the problem so we can approach it differently
- Do NOT delete any files, tables, columns, or data without explicit confirmation
- Do NOT refactor or restructure code unrelated to the current task
- Do NOT install new packages without asking first
- Do NOT overwrite working code to fix something else — isolate all changes
- If something is unclear, ASK before writing a bunch of code
- Always summarise what you changed after making edits
- Warn me before making a change that could break something else
- Keep code clean and modular — no spaghetti
- always verify file/data exists before attempting code fixes
- Always run `npx next build` before reporting a task as done — not just tsc and eslint, since some Next.js errors (e.g. invalid 'use server' exports) only show up in a full build
- For bugs, report the cause before fixing — don't guess

## Project Context
- Earthcare Landscapes business app; users are on desktop and iPads
- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4
- Supabase (auth + PostgreSQL + RLS), Cloudflare R2 (file storage), Vercel (hosting)
- Role hierarchy: worker → leading_hand → supervisor → admin → client (separate). Estimates and pricing are admin-only
- All dates/times use Australia/Perth — never UTC or Sydney
- Quant sheets: quote_type 'estimate' and 'final' only. 'budget' is retired (rows kept in DB, never shown or saved)
- Lot numbers may have leading zeros — always match ignoring them
- All data fetching via lib/data.ts with unstable_cache / React cache pattern
- Mutations must call revalidatePath() or revalidateTag() after changes
- Never export non-async values (constants, arrays, objects) from any file with a 'use server' directive — Next.js requires every export from such a file to be an async function; put shared constants in a separate plain module instead

## Database
- Never run SQL or migrations. Write them to supabase/, print the raw SQL, and wait for me to confirm it's run
- Whenever you write a migration file, also update supabase/schema.sql to match
- Updates/deletes must chain .select('id') and treat zero rows as an error (RLS fails silently otherwise)
- Server-validated bulk or system writes use createAdminClient(); normal user actions use the session client
- When a query filters rows, check RLS isn't silently hiding rows from some roles (a common cause of $0 or missing totals)

## Money Safety (pricing, quant sheets, invoicing)
- Any delete-and-reinsert save must preserve rows the current user can't see (e.g. admin-only Preliminaries). Hidden in the UI must never mean wiped on save
- Preliminaries must always be present on every estimate and final quant sheet
- Never silently fall back to a different figure (e.g. showing the Estimate as the Final). If a fallback is shown, label it clearly
- Contract price = lot contract_price, else stage default
- Contract-priced lots: Total = contract price only. Never add client extras on top of a contract price. (Shared rule: lib/lotTotals.ts)
- Invoice PDF snapshots always keep full pricing, regardless of any hide-pricing setting
- Totals are calculated in several places: invoices page, claim sheet PDFs, Approved panel, invoice snapshots, Excel export, analytics. Any change to a total calculation must be checked in all of them; the report must list each and confirm they agree
- Before finishing any pricing/invoicing change, state whether it could change an invoiced amount. If yes, show a before/after example

## Git
- Never `git add .` — stage only the files for the task
- Commit messages describe only what's in the commit
- Tell me about unrelated uncommitted files instead of including them

## UI Defaults
- All collapsible/expandable sections must default to CLOSED unless there is a strong reason to default open
- Never default a section to open without explicitly confirming this is the right behaviour