'use client'
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { ActivityStoryData, StoryConfig, ASPECT_DIMENSIONS, ExportFormat } from '@/components/StoryGenerator/storyTypes'
import { StoryPreview, StoryPreviewRef } from '@/components/StoryGenerator/StoryPreview'
import { StudioTopbar } from '@/components/StudioTopbar'
import { StudioActivityBar } from '@/components/StudioActivityBar'
import { StudioConfigPanel } from '@/components/StudioConfigPanel'
import { ExportProgress } from '@/components/ExportProgress'
import { Timeline } from '@/components/Timeline'

const DEFAULT_CONFIG: StoryConfig = {
  mode: '2d',
  aspectRatio: '9:16',
  durationSeconds: 8,

  showDistance: true,
  showTime: true,
  showElevation: true,
  showSpeed: false,
  showSportIcon: true,
  showSummits: true,
  showDayEndMarkers: true,
  showPOI: false,
  showTrailPhotos: false,

  backgroundType: 'map',
  gradientTheme: 'night',
  mapStyle: 'standard',
  showElevationProfile: true,
  showKmMarkers: true,

  mapStyle3D: 'satellite-3d',
  cameraPitch: 55,
  cameraAltitude: 400,
  terrainExaggeration: 1.5,
  showHillshade: true,

  cfViewportKm: 25,
  cfShowGhostTrail: true,
  cfDynamicSpeed: true,

  slideshowTransition: 'crossfade',

  enableSafeZones: false,
  showLogo: true,
}

interface StudioProps {
  data: ActivityStoryData
}

const ASPECT_RATIOS: StoryConfig['aspectRatio'][] = ['9:16', '1:1', '16:9']

export function Studio({ data }: StudioProps) {
  const [config, setConfig] = useState<StoryConfig>(DEFAULT_CONFIG)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4')
  const previewRef = useRef<StoryPreviewRef>(null)

  const handleConfigChange = useCallback((patch: Partial<StoryConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const handleExportDone = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = blob.type === 'video/mp4' ? 'trailstory.mp4' : 'trailstory.webm'
    a.click()
    URL.revokeObjectURL(url)
    setExportProgress(1)
  }, [])

  const handleExportStart = useCallback(() => {
    setExportProgress(0)
    previewRef.current?.exportVideo(exportFormat)
  }, [exportFormat])

  const dims = ASPECT_DIMENSIONS[config.aspectRatio]
  const isExporting = exportProgress !== null && exportProgress < 1

  // Compute preview container pixel dimensions to fit the available area
  // while maintaining the exact aspect ratio. CSS aspect-ratio with percentage
  // dimensions is unreliable in nested flex containers, so we measure and compute.
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const [previewArea, setPreviewArea] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = previewAreaRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width > 0 && height > 0) setPreviewArea({ w: width, h: height })
  }, [])

  useEffect(() => {
    const el = previewAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setPreviewArea({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ar = dims.width / dims.height
  let pw = previewArea.w
  let ph = pw / ar
  if (previewArea.h > 0 && ph > previewArea.h) { ph = previewArea.h; pw = ph * ar }
  pw = Math.floor(pw)
  ph = Math.floor(ph)

  const canExportWebM = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' &&
    (MediaRecorder.isTypeSupported?.('video/webm') || MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9'))
  const canExportMP4 = typeof window !== 'undefined' && typeof VideoEncoder !== 'undefined'
  const canExport = canExportWebM || canExportMP4

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg)] overflow-hidden">
      <StudioTopbar
        data={data}
        onExport={handleExportStart}
        isExporting={isExporting}
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
        canExportMP4={canExportMP4}
      />
      <StudioActivityBar data={data} />

      {!canExport && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs text-center">
          Export není na iOS Safari podporován. Použijte Chrome nebo Firefox.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Preview panel */}
        <div
          className="flex-1 flex flex-col p-6 gap-3 overflow-hidden min-w-0"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,91,31,0.04), transparent 70%)' }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex gap-1.5">
              {ASPECT_RATIOS.map(ar => (
                <button
                  key={ar}
                  onClick={() => handleConfigChange({ aspectRatio: ar })}
                  className={`px-3 py-1 rounded-md text-xs t-mono transition-colors ${
                    config.aspectRatio === ar
                      ? 'bg-white/10 text-white'
                      : 'text-[var(--muted)] hover:text-white'
                  }`}
                >
                  {ar}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="t-mono">PREVIEW · LIVE</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lime)' }} />
            </div>
          </div>

          {/* Preview canvas area */}
          <div ref={previewAreaRef} className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
            {pw > 0 && ph > 0 && (
              <div style={{ width: pw, height: ph, flexShrink: 0 }}>
                <StoryPreview
                  ref={previewRef}
                  config={config}
                  data={data}
                  isPlaying={isPlaying}
                  onPlayChange={setIsPlaying}
                  onExportProgress={setExportProgress}
                  onExportDone={handleExportDone}
                />
              </div>
            )}
          </div>

          {/* Timeline */}
          <Timeline
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(p => !p)}
            duration={config.durationSeconds}
          />
        </div>

        {/* Config panel */}
        <StudioConfigPanel
          config={config}
          data={data}
          onChange={handleConfigChange}
          disabled={isExporting}
        />
      </div>

      {exportProgress !== null && (
        <ExportProgress
          progress={exportProgress}
          format={exportFormat}
          onDismiss={exportProgress >= 1 ? () => setExportProgress(null) : undefined}
        />
      )}
    </div>
  )
}
