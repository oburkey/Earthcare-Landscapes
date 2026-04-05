// Shared action state types used by upload actions and their client components.

export type UploadActionState = { error: string } | null

export type UploadAction = (
  prevState: UploadActionState,
  formData: FormData
) => Promise<UploadActionState>
