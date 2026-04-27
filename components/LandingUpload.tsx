'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { parseGPX, validateGPXFile } from '@/lib/gpxParser'
import { matchPhotosToGPX } from '@/lib/photoMatcher'
import { buildActivityStoryData } from '@/lib/activityBuilder'

type UploadState = 'idle' | 'parsing' | 'error'

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
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto">
      {/* GPX Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => gpxInputRef.current?.click()}
        className={`
          w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
          flex flex-col items-center justify-center gap-4 p-10
          ${isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : gpxFile
            ? 'border-orange-500/60 bg-orange-500/5'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
        `}
      >
        <input
          ref={gpxInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleGPXFile(f) }}
        />

        {gpxFile ? (
          <>
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-2xl">✓</div>
            <div className="text-center">
              <p className="text-white font-semibold">{gpxFile.name}</p>
              <p className="text-white/40 text-sm mt-1">Klikni pro výměnu</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white/80 font-medium">Přetáhni GPX sem</p>
              <p className="text-white/40 text-sm mt-1">.gpx · max 50 MB</p>
            </div>
            <button className="px-5 py-2 rounded-lg bg-white/8 border border-white/15 text-white/70 text-sm hover:bg-white/12 transition-colors">
              Vybrat soubor
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Photos section */}
      <div className="w-full">
        <button
          onClick={() => photoInputRef.current?.click()}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-orange-400 transition-colors"
        >
          <span className="text-orange-400/70">+</span>
          {photoFiles.length > 0
            ? `${photoFiles.length} ${photoFiles.length === 1 ? 'fotka' : 'fotek'} přidáno`
            : 'Přidat fotky (volitelné)'}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            setPhotoFiles(files)
          }}
        />
        {photoFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {photoFiles.slice(0, 5).map((f, i) => (
              <div key={i} className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">
                {f.name.length > 20 ? f.name.slice(0, 18) + '…' : f.name}
              </div>
            ))}
            {photoFiles.length > 5 && (
              <div className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">
                +{photoFiles.length - 5} dalších
              </div>
            )}
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!gpxFile || state === 'parsing'}
        className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === 'parsing' ? 'Zpracovávám…' : 'Vytvořit story →'}
      </button>

      {/* Feature strip */}
      <div className="w-full grid grid-cols-3 gap-4 pt-4 border-t border-white/8">
        {[
          { icon: '📹', title: 'Export 1080p', desc: 'WebM video připravené k sdílení' },
          { icon: '🗺', title: '4 vizuální styly', desc: '2D, 3D, kamera, slideshow' },
          { icon: '✨', title: 'Zdarma', desc: 'Žádná registrace, žádný backend' },
        ].map(f => (
          <div key={f.title} className="text-center">
            <div className="text-xl mb-1">{f.icon}</div>
            <p className="text-white/70 text-xs font-semibold">{f.title}</p>
            <p className="text-white/35 text-xs mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
