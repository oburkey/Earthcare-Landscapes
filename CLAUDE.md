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

## Project Context
- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4
- Supabase (auth + PostgreSQL + RLS), Cloudflare R2 (file storage), Vercel (hosting)
- Role hierarchy: worker → leading_hand → supervisor → admin → client (separate)
- All data fetching via lib/data.ts with unstable_cache / React cache pattern
- Mutations must call revalidatePath() or revalidateTag() after changes
## UI Defaults
- All collapsible/expandable sections must default to CLOSED unless there is a strong reason to default open
- Never default a section to open without explicitly confirming this is the right behaviour