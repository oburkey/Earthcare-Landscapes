// Browser-only utility — uses Canvas API to resize and compress images.
// Only import this from Client Components ('use client').

const MAX_QUALITY = 0.85
const MIN_QUALITY = 0.1
const QUALITY_STEP = 0.05

/**
 * Resize an image to at most `maxWidthPx` wide and compress until the file
 * is under `maxBytes`. Always outputs JPEG.
 */
export async function compressImage(
  file: File,
  maxWidthPx: number,
  maxBytes: number
): Promise<File> {
  const img = await loadImage(file)

  const { width, height } = scaledDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxWidthPx
  )

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

  let quality = MAX_QUALITY
  let blob    = await toBlob(canvas, quality)

  while (blob.size > maxBytes && quality > MIN_QUALITY) {
    quality = Math.max(quality - QUALITY_STEP, MIN_QUALITY)
    blob    = await toBlob(canvas, quality)
  }

  // Keep original name but force .jpg extension
  const baseName = file.name.replace(/\.[^/.]+$/, '.jpg')
  return new File([blob], baseName, { type: 'image/jpeg' })
}

function scaledDimensions(
  w: number,
  h: number,
  maxW: number
): { width: number; height: number } {
  if (w <= maxW) return { width: w, height: h }
  return { width: maxW, height: Math.round(h * (maxW / w)) }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality
    )
  )
}
