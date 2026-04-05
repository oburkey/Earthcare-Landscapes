// Shared action state types used by upload actions and their client components.

export type UploadActionState = { error: string } | null

// Single-arg form: prevState is pre-bound via .bind(null, null) in the server component.
export type UploadAction = (formData: FormData) => Promise<UploadActionState>
