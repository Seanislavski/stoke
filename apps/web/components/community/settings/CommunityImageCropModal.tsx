'use client'

import { useState, useRef, useEffect } from 'react'

const PREVIEW = 280  // crop frame display size (px)
const OUTPUT  = 400  // canvas output size (px)

export default function CommunityImageCropModal({
  file,
  onSave,
  onCancel,
}: {
  file: File
  onSave: (blob: Blob) => Promise<void>
  onCancel: () => void
}) {
  const [imgSrc, setImgSrc]         = useState('')
  const [loaded, setLoaded]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [offset, setOffset]         = useState({ x: 0, y: 0 })
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const imgRef   = useRef<HTMLImageElement>(null)
  const dragging = useRef(false)
  const lastPos  = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget
    const s  = Math.max(PREVIEW / nw, PREVIEW / nh)
    const dw = nw * s
    const dh = nh * s
    setDisplaySize({ w: dw, h: dh })
    setOffset({ x: (PREVIEW - dw) / 2, y: (PREVIEW - dh) / 2 })
    setLoaded(true)
  }

  function clamp(o: { x: number; y: number }, size: { w: number; h: number }) {
    return {
      x: Math.min(0, Math.max(PREVIEW - size.w, o.x)),
      y: Math.min(0, Math.max(PREVIEW - size.h, o.y)),
    }
  }

  function startDrag(x: number, y: number) {
    dragging.current = true
    lastPos.current  = { x, y }
  }

  function moveDrag(x: number, y: number) {
    if (!dragging.current) return
    const dx = x - lastPos.current.x
    const dy = y - lastPos.current.y
    lastPos.current = { x, y }
    setOffset(prev => clamp({ x: prev.x + dx, y: prev.y + dy }, displaySize))
  }

  function endDrag() { dragging.current = false }

  async function handleSave() {
    const img = imgRef.current
    if (!img || !loaded) return
    setSaving(true)

    const canvas = document.createElement('canvas')
    canvas.width  = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')!

    const scale = displaySize.w / img.naturalWidth
    const srcX  = -offset.x / scale
    const srcY  = -offset.y / scale
    const srcW  = PREVIEW   / scale
    const srcH  = PREVIEW   / scale

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT)

    canvas.toBlob(async (blob) => {
      if (blob) await onSave(blob)
      setSaving(false)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Crop photo</h2>
        <p className="text-xs text-stone-400 mb-4">Drag to reposition</p>

        {/* Crop frame */}
        <div
          className="relative mx-auto overflow-hidden rounded-xl bg-stone-100 select-none cursor-grab active:cursor-grabbing"
          style={{ width: PREVIEW, height: PREVIEW }}
          onMouseDown={e  => startDrag(e.clientX, e.clientY)}
          onMouseMove={e  => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e  => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY) }}
          onTouchEnd={endDrag}
        >
          {imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              onLoad={handleLoad}
              draggable={false}
              className="absolute pointer-events-none"
              style={{
                left:    offset.x,
                top:     offset.y,
                width:   displaySize.w || undefined,
                height:  displaySize.h || undefined,
                opacity: loaded ? 1 : 0,
              }}
            />
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={!loaded || saving}
            className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save photo'}
          </button>
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
