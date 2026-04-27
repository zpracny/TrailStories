'use client'
import { useState, useCallback, useRef } from 'react'
import { ActivityStoryData, StoryConfig, ASPECT_DIMENSIONS } from '@/components/StoryGenerator/storyTypes'
import { StoryPreview } from '@/components/StoryGenerator/StoryPreview'
import { StudioTopbar } from '@/components/StudioTopbar'
import { StudioActivityBar } from '@/components/StudioActivityBar'
import { StudioConfigPanel } from '@/components/StudioConfigPanel'
import { ExportProgress } from '@/components/ExportProgress'

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

  backgroundType: 'gradient',
  gradientTheme: 'night',
  mapStyle: 'standard',
  showElevationProfile: true,
  showKmMarkers: true,

  mapStyle3D: 'satellite-3d',
  cameraPitch: 55,
  cameraAltitude: 800,
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
  const exportBlobRef = useRef<Blob | null>(null)

  const handleConfigChange = useCallback((patch: Partial<StoryConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const handleExportDone = useCallback((blob: Blob) => {
    exportBlobRef.current = blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trailstory.webm'
    a.click()
    URL.revokeObjectURL(url)
    setExportProgress(1)
  }, [])

  const handleExportStart = useCallback(() => {
    setExportProgress(0)
  }, [])

  const dims = ASPECT_DIMENSIONS[config.aspectRatio]

  // Check iOS Safari MediaRecorder support
  const canExport = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' &&
    (MediaRecorder.isTypeSupported?.('video/webm') || MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9'))

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg)] overflow-hidden">
      <StudioTopbar data={data} onExport={handleExportStart} isExporting={exportProgress !== null && exportProgress < 1} />
      <StudioActivityBar data={data} />

      {!canExport && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs text-center">
          Export není na iOS Safari podporován. Použijte Chrome nebo Firefox.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Preview panel */}
        <div className="flex-1 flex flex-col items-center p-4 gap-2 overflow-hidden min-w-0">
          {/* Aspect ratio switcher */}
          <div className="flex gap-1.5 shrink-0">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar}
                onClick={() => handleConfigChange({ aspectRatio: ar })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  config.aspectRatio === ar
                    ? 'bg-white/15 text-white'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {ar}
              </button>
            ))}
          </div>

          {/*
            flex-1 + min-h-0 = tato plocha dostane veškerou zbývající výšku.
            items-center justify-center = preview centrovaný v ploše.
            Vnitřní div dostane height: 100% pro portrait nebo width: 100% pro landscape,
            aspect-ratio pak dopočítá druhou dimenzi.
          */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div
              style={
                dims.width >= dims.height
                  ? { width: '100%', maxHeight: '100%', aspectRatio: `${dims.width} / ${dims.height}` }
                  : { height: '100%', maxWidth: '100%', aspectRatio: `${dims.width} / ${dims.height}` }
              }
            >
              <StoryPreview
                config={config}
                data={data}
                onExportProgress={setExportProgress}
                onExportDone={handleExportDone}
              />
            </div>
          </div>
        </div>

        {/* Config panel */}
        <div className="w-64 shrink-0 border-l border-white/8 bg-[var(--panel)] overflow-hidden">
          <StudioConfigPanel
            config={config}
            data={data}
            onChange={handleConfigChange}
            disabled={exportProgress !== null && exportProgress < 1}
          />
        </div>
      </div>

      {/* Export overlay */}
      {exportProgress !== null && (
        <ExportProgress
          progress={exportProgress}
          onDismiss={exportProgress >= 1 ? () => setExportProgress(null) : undefined}
        />
      )}
    </div>
  )
}
