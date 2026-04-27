'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { StoryConfig, ActivityStoryData, IStoryEngine, ASPECT_DIMENSIONS } from './storyTypes'
import { StoryCanvas } from './StoryCanvas'
import { Story3DEngine } from './Story3DEngine'
import { SlideshowEngine } from './SlideshowEngine'
import { CameraFollowEngine } from './mode-camera-follow/CameraFollowEngine'
import {
  mapPhotosToRoute, groupNearbyPhotos, limitPhotoGroups, preloadStoryPhotos,
} from './storyPhotoUtils'
import { decodePolyline, simplifyTrail } from './trailProjection'

interface StoryPreviewProps {
  config: StoryConfig
  data: ActivityStoryData
  onExportProgress?: (progress: number) => void
  onExportDone?: (blob: Blob) => void
}

export function StoryPreview({ config, data, onExportProgress, onExportDone }: StoryPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<IStoryEngine | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const dims = ASPECT_DIMENSIONS[config.aspectRatio]
  const is2dOrSlideshow = config.mode === '2d' || config.mode === 'slideshow'

  const destroyEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy()
      engineRef.current = null
    }
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    destroyEngine()

    const initEngine = async () => {
      let photoGroups: Awaited<ReturnType<typeof preloadStoryPhotos>> | null = null
      let groups: ReturnType<typeof limitPhotoGroups> = []

      if (config.showTrailPhotos && data.trailPhotos && data.trailPhotos.length > 0) {
        let latlngs: [number, number][] = []
        if (data.preloadedLatLngs) latlngs = data.preloadedLatLngs
        else if (data.encodedPolyline) latlngs = decodePolyline(data.encodedPolyline)
        latlngs = simplifyTrail(latlngs, 0.00005)

        const mapped = mapPhotosToRoute(data.trailPhotos, latlngs)
        const raw = groupNearbyPhotos(mapped)
        groups = limitPhotoGroups(raw)
        photoGroups = await preloadStoryPhotos(groups)
      }

      if (config.mode === '2d' && canvasRef.current) {
        canvasRef.current.width = dims.width
        canvasRef.current.height = dims.height
        const engine = new StoryCanvas(canvasRef.current, config, data)
        if (groups.length > 0 && photoGroups) engine.setPhotoPauses(groups, photoGroups)
        engineRef.current = engine
      } else if (config.mode === '3d' && mapContainerRef.current) {
        const engine = new Story3DEngine(mapContainerRef.current, config, data)
        if (groups.length > 0 && photoGroups && engine.setPhotoPauses) engine.setPhotoPauses(groups, photoGroups)
        engineRef.current = engine
      } else if (config.mode === 'camera-follow' && mapContainerRef.current) {
        const engine = new CameraFollowEngine(mapContainerRef.current, config, data)
        if (groups.length > 0 && photoGroups && engine.setPhotoPauses) engine.setPhotoPauses(groups, photoGroups)
        engineRef.current = engine
      } else if (config.mode === 'slideshow' && canvasRef.current) {
        canvasRef.current.width = dims.width
        canvasRef.current.height = dims.height
        engineRef.current = new SlideshowEngine(canvasRef.current, config, data)
      }
    }

    initEngine()
    return destroyEngine
  }, [config, data, destroyEngine, dims.height, dims.width])

  const handlePlay = () => {
    if (!engineRef.current) return
    if (isPlaying) {
      engineRef.current.stop()
      setIsPlaying(false)
    } else {
      engineRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleExport = async () => {
    if (!engineRef.current || isExporting) return
    setIsExporting(true)
    try {
      const blob = await engineRef.current.export({ onProgress: onExportProgress })
      onExportDone?.(blob)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    // Fills 100% of the parent — parent controls aspect-ratio sizing
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-white/10 bg-black group">
      {is2dOrSlideshow ? (
        <canvas
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          className="w-full h-full"
        />
      ) : (
        <div ref={mapContainerRef} className="absolute inset-0" />
      )}

      {/* Play/Pause overlay — visible on hover */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 transition-opacity opacity-0 group-hover:opacity-100">
        <button
          onClick={handlePlay}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-black/80 transition-colors disabled:opacity-40"
        >
          {isPlaying ? '⏸ Pauza' : '▶ Přehrát'}
        </button>
      </div>
    </div>
  )
}
