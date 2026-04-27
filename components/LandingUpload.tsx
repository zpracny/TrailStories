'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { parseGPX, validateGPXFile } from '@/lib/gpxParser'
import { matchPhotosToGPX } from '@/lib/photoMatcher'
import { buildActivityStoryData } from '@/lib/activityBuilder'

type UploadState = 'idle' | 'parsing' | 'error'

const ACCENT = '#ff5b1f'

export function LandingUpload() {
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [gpxFile, setGpxFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const gpxInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleGPXFile = useCallback((file: File) => {
    const validationError = validateGPXFile(file)
    if (validationError) { setError(validationError); return }
    setGpxFile(file)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.name.toLowerCase().endsWith('.gpx'))
    if (file) handleGPXFile(file)
    else setError('Přetáhněte soubor s příponou .gpx')
  }, [handleGPXFile])

  const handleStart = async () => {
    if (!gpxFile) return
    setState('parsing')
    setError(null)
    try {
      const gpx = await parseGPX(gpxFile)
      const { trailPhotos, allPhotos } = photoFiles.length > 0
        ? await matchPhotosToGPX(photoFiles, gpx)
        : { trailPhotos: [], allPhotos: [] }
      const activityData = buildActivityStoryData(gpx, trailPhotos, allPhotos)
      sessionStorage.setItem('trailstories_data', JSON.stringify(activityData))
      router.push('/studio')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Chyba při zpracování GPX souboru')
    }
  }

  return (
    <div className="card p-7" style={{ borderColor: gpxFile ? ACCENT : undefined }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="t-eyebrow">STEP 01</span>
          <span className="text-xs text-[var(--subtle)]">/ NAHRÁT</span>
        </div>
        <span className="text-xs text-[var(--muted)] t-mono">.gpx · MAX 50 MB</span>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => gpxInputRef.current?.click()}
        className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all p-8"
        style={{
          borderColor: isDragging ? ACCENT : gpxFile ? ACCENT : 'var(--border-2)',
          background: isDragging ? `${ACCENT}10` : 'transparent',
        }}
      >
        <input
          ref={gpxInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleGPXFile(f) }}
        />

        {gpxFile ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${ACCENT}25`, color: ACCENT }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="font-semibold">{gpxFile.name}</div>
              <div className="text-xs t-mono text-[var(--muted)] mt-1">Klikni pro výměnu</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full border border-[var(--border-2)] flex items-center justify-center text-[var(--muted)]"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-medium">Přetáhni GPX sem</div>
              <div className="text-xs text-[var(--muted)] mt-1">nebo klikni a vyber soubor z disku</div>
            </div>
            <button className="btn" onClick={e => { e.stopPropagation(); gpxInputRef.current?.click() }}>
              Vybrat soubor
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-3 t-mono">{error}</p>
      )}

      <div className="flex items-center justify-between mt-5">
        <div>
          <button
            className="text-sm flex items-center gap-1.5 transition-colors"
            style={{ color: ACCENT }}
            onClick={() => photoInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {photoFiles.length > 0
              ? `${photoFiles.length} fotek přidáno`
              : <><span>Přidat fotky</span><span className="text-[var(--muted)]">(volitelné)</span></>
            }
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => setPhotoFiles(Array.from(e.target.files || []))}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ padding: '12px 22px' }}
          onClick={handleStart}
          disabled={!gpxFile || state === 'parsing'}
        >
          {state === 'parsing' ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Zpracovávám…
            </>
          ) : (
            'Vytvořit story →'
          )}
        </button>
      </div>
    </div>
  )
}
