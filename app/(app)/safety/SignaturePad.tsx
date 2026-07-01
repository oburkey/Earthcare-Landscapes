'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import SP from 'signature_pad'

export interface SignaturePadHandle {
  toDataURL: () => string | null  // null if empty
  clear: () => void
  isEmpty: () => boolean
}

interface Props {
  label: string
  className?: string
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>(({ label, className }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef    = useRef<SP | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width  = w * ratio
      canvas.height = h * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
    }

    const pad = new SP(canvas, { penColor: '#1c1917' })
    padRef.current = pad
    resize()

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      pad.off()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      if (!padRef.current || padRef.current.isEmpty()) return null
      return padRef.current.toDataURL('image/png')
    },
    clear: () => padRef.current?.clear(),
    isEmpty: () => padRef.current?.isEmpty() ?? true,
  }))

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="relative rounded-xl border-2 border-dashed border-border bg-surface h-32 overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
        />
        <p className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted pointer-events-none select-none opacity-40">
          Sign here
        </p>
      </div>
    </div>
  )
})

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
