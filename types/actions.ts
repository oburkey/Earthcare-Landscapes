// Shared action state types used by server actions and their client components.

// For actions that return an error or redirect/revalidate on success
export type ActionState = { error: string } | null

// For in-place edit forms that show a success state without redirecting
export type EditState = { error?: string; success?: boolean } | null

// For CRUD pages that show a success/error message without redirecting (staff, contacts, vehicles)
export type MutationState = { error?: string; success?: string } | null

// Kept as an alias of ActionState for upload-specific actions
export type UploadActionState = ActionState

// Single-arg upload action (prevState pre-bound via inline server action wrapper in the page)
export type UploadAction = (formData: FormData) => Promise<UploadActionState>
