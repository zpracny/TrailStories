import maplibregl from 'maplibre-gl'
import { StoryConfig, ActivityStoryData, PhotoGroup, IStoryEngine, ASPECT_DIMENSIONS, EngineExportOptions } from './storyTypes'
import {
  TRAIL_COLOR_START, TRAIL_COLOR_END, SUMMIT_COLOR, DAY_END_COLOR,
  STATS_FONT, LOGO_TEXT, SAFE_ZONE_TOP, SAFE_ZONE_BOTTOM,
  EXPORT_FPS, EXPORT_BITRATE, EXPORT_FORMAT, EXPORT_FALLBACK,
} from './storyConstants'
import { decodePolyline, simplifyTrail, computeCumulativeDistances, getPositionAtProgress, haversineDistance } from './trailProjection'
import { computeCameraPath, interpolateCamera } from './story3DCamera'
import { getMapStyle } from './story3DStyles'
import { drawPhotoPauseOverlay } from './storyPhotoUtils'

export class Story3DEngine implements IStoryEngine {
  private container: HTMLElement
  private config: StoryConfig
  private data: ActivityStoryData
  private map: maplibregl.Map | null = null
  private hudCanvas: HTMLCanvasElement
  private hudCtx: CanvasRenderingContext2D

  private latlngs: [number, number][] = []
  private cumulDists: number[] = []
  private cameraFrames: ReturnType<typeof computeCameraPath> = []
  private progress = 0
  private duration = 15000
  private animFrame: number | null = null
  private lastTime: number | null = null
  private isPlaying = false

  private photoGroups: PhotoGroup[] = []
  private loadedImages: Map<string, HTMLImageElement> = new Map()
  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement, config: StoryConfig, data: ActivityStoryData) {
    this.container = container
    this.config = config
    this.data = data
    this.duration = config.durationSeconds * 1000

    // HUD canvas overlay
    this.hudCanvas = document.createElement('canvas')
    this.hudCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%'
    this.hudCtx = this.hudCanvas.getContext('2d')!
    container.style.position = 'relative'
    container.appendChild(this.hudCanvas)

    this.init()
  }

  private async init() {
    // Decode route
    if (this.data.preloadedLatLngs && this.data.preloadedLatLngs.length > 0) {
      this.latlngs = this.data.preloadedLatLngs
    } else if (this.data.encodedPolyline) {
      this.latlngs = decodePolyline(this.data.encodedPolyline)
    }
    this.latlngs = simplifyTrail(this.latlngs, 0.0001)
    this.cumulDists = computeCumulativeDistances(this.latlngs)

    if (this.latlngs.length === 0) return

    // Camera path
    this.cameraFrames = computeCameraPath(
      this.latlngs,
      12,
      this.config.cameraAltitude,
      this.config.cameraPitch
    )

    const style = getMapStyle(this.config.mapStyle3D) as maplibregl.StyleSpecification
    // Inject terrain exaggeration
    if ((style as { terrain?: { exaggeration: number } }).terrain) {
      (style as { terrain: { exaggeration: number } }).terrain.exaggeration = this.config.terrainExaggeration
    }

    const firstFrame = this.cameraFrames[0]
    this.map = new maplibregl.Map({
      container: this.container,
      style,
      center: [firstFrame.lng, firstFrame.lat],
      zoom: firstFrame.zoom,
      bearing: firstFrame.bearing,
      pitch: firstFrame.pitch,
      attributionControl: false,
      interactive: false,
    })

    this.map.once('load', () => {
      this.addTrailLayers()
      this.map!.resize()
      this.resizeHud()
      this.renderHud(0)
    })

    // ResizeObserver zajistí správnou velikost po každé změně layoutu
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize()
      this.resizeHud()
    })
    this.resizeObserver.observe(this.container)
  }

  private addTrailLayers() {
    if (!this.map) return

    const geojsonLine: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: this.latlngs.map(([lat, lng]) => [lng, lat]),
      },
    }

    this.map.addSource('trail', { type: 'geojson', data: geojsonLine })
    this.map.addSource('active-trail', { type: 'geojson', data: geojsonLine, lineMetrics: true })

    // Ghost trail
    this.map.addLayer({
      id: 'ghost-trail-layer',
      type: 'line',
      source: 'trail',
      paint: {
        'line-color': '#ffffff',
        'line-opacity': 0.2,
        'line-width': 3,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })

    // Active trail outline
    this.map.addLayer({
      id: 'active-trail-outline',
      type: 'line',
      source: 'active-trail',
      paint: {
        'line-color': '#000000',
        'line-opacity': 0.4,
        'line-width': 7,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })

    // Active trail
    this.map.addLayer({
      id: 'active-trail-layer',
      type: 'line',
      source: 'active-trail',
      paint: {
        'line-color': TRAIL_COLOR_END,
        'line-width': 5,
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, TRAIL_COLOR_START,
          1, TRAIL_COLOR_END,
        ],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })

    // Peaks
    if (this.config.showSummits && this.data.peakVisits && this.data.peakVisits.length > 0) {
      const peaksGeoJson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: this.data.peakVisits.map(p => ({
          type: 'Feature',
          properties: { name: p.placeName, elevation: p.elevation },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
      }
      this.map.addSource('peaks', { type: 'geojson', data: peaksGeoJson })
      this.map.addLayer({
        id: 'peaks-circles',
        type: 'circle',
        source: 'peaks',
        paint: {
          'circle-color': SUMMIT_COLOR,
          'circle-radius': 8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
    }
  }

  private interpolatedCoord(progress: number): [number, number] {
    const n = this.latlngs.length
    const totalIdx = Math.max(0, Math.min(n - 1, progress * (n - 1)))
    const lo = Math.floor(totalIdx)
    const frac = totalIdx - lo
    if (frac === 0 || lo >= n - 1) return this.latlngs[Math.min(lo, n - 1)]
    const a = this.latlngs[lo], b = this.latlngs[lo + 1]
    return [a[0] + frac * (b[0] - a[0]), a[1] + frac * (b[1] - a[1])]
  }

  private updateActiveTrail(progress: number) {
    if (!this.map || !this.map.getSource('active-trail')) return
    const n = this.latlngs.length
    const totalIdx = progress * (n - 1)
    const endIdx = Math.floor(totalIdx)
    const frac = totalIdx - endIdx

    const coords = this.latlngs.slice(0, endIdx + 1).map(([lat, lng]) => [lng, lat] as [number, number])
    // Add interpolated fractional endpoint
    if (frac > 0 && endIdx + 1 < n) {
      const [lat, lng] = this.interpolatedCoord(progress)
      coords.push([lng, lat])
    }
    if (coords.length < 2) return

    const src = this.map.getSource('active-trail') as maplibregl.GeoJSONSource
    src.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    })
  }

  private resizeHud = () => {
    const rect = this.container.getBoundingClientRect()
    this.hudCanvas.width = rect.width || 400
    this.hudCanvas.height = rect.height || 711
    this.renderHud(this.progress)
  }

  private renderHud(progress: number) {
    const ctx = this.hudCtx
    const w = this.hudCanvas.width
    const h = this.hudCanvas.height
    ctx.clearRect(0, 0, w, h)

    // Edge fades
    const topFade = ctx.createLinearGradient(0, 0, 0, h * 0.25)
    topFade.addColorStop(0, 'rgba(0,0,0,0.6)')
    topFade.addColorStop(1, 'transparent')
    ctx.fillStyle = topFade
    ctx.fillRect(0, 0, w, h * 0.25)

    const botFade = ctx.createLinearGradient(0, h * 0.7, 0, h)
    botFade.addColorStop(0, 'transparent')
    botFade.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = botFade
    ctx.fillRect(0, h * 0.7, w, h * 0.3)

    // Activity name
    const safeTop = this.config.enableSafeZones ? (SAFE_ZONE_TOP / 1920) * h : h * 0.04
    const nameFontSize = Math.round(h * 0.028)
    ctx.font = `700 ${nameFontSize}px ${STATS_FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.name, w * 0.06, safeTop + h * 0.02)

    // Stats
    this.drawHudStats(ctx, w, h)

    // Progress bar
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const barH = Math.round(h * 0.004)
    const barY = h - safeBottom - barH
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(0, barY, w, barH)
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, TRAIL_COLOR_START)
    grad.addColorStop(1, TRAIL_COLOR_END)
    ctx.fillStyle = grad
    ctx.fillRect(0, barY, w * progress, barH)

    // Logo
    if (this.config.showLogo) {
      const logoSize = Math.round(h * 0.018)
      ctx.font = `700 ${logoSize}px ${STATS_FONT}`
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(LOGO_TEXT, w - w * 0.04, h - safeBottom - h * 0.01)
    }

    // Photo overlay
    if (this.config.showTrailPhotos && this.photoGroups.length > 0) {
      for (const group of this.photoGroups) {
        if (progress < group.position) continue
        const elapsed = (progress - group.position) * this.duration
        const pauseTotal = 500 + 2000 + 500
        if (elapsed > pauseTotal) continue
        const alpha = elapsed < 500 ? elapsed / 500 : elapsed < 2500 ? 1 : Math.max(0, 1 - (elapsed - 2500) / 500)
        if (alpha > 0) drawPhotoPauseOverlay(ctx, alpha, 0, group, this.loadedImages, w, h)
      }
    }
  }

  private drawHudStats(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const statsY = h - safeBottom - h * 0.06
    const stats: { label: string; value: string }[] = []

    if (this.config.showDistance) stats.push({ label: 'km', value: (this.data.distance / 1000).toFixed(1) })
    if (this.config.showElevation) stats.push({ label: 'm↑', value: String(Math.round(this.data.elevationGain)) })
    if (this.config.showTime) {
      const t = this.data.movingTime
      const hh = Math.floor(t / 3600)
      const mm = Math.floor((t % 3600) / 60)
      stats.push({ label: 'čas', value: `${hh}:${String(mm).padStart(2, '0')}` })
    }
    if (stats.length === 0) return

    const fontSize = Math.round(h * 0.03)
    const labelSize = Math.round(h * 0.016)
    const colW = w / (stats.length + 1)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'

    stats.forEach((s, i) => {
      const sx = colW * (i + 1)
      ctx.font = `700 ${fontSize}px ${STATS_FONT}`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(s.value, sx, statsY)
      ctx.font = `400 ${labelSize}px ${STATS_FONT}`
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText(s.label, sx, statsY + labelSize + 4)
    })
  }

  setPhotoPauses(groups: PhotoGroup[], loadedImages: Map<string, HTMLImageElement>) {
    this.photoGroups = groups
    this.loadedImages = loadedImages
  }

  play() {
    if (this.isPlaying) return
    this.isPlaying = true
    this.lastTime = null
    this.animFrame = requestAnimationFrame(this.loop)
  }

  stop() {
    this.isPlaying = false
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame)
    this.animFrame = null
    this.progress = 0
    this.renderHud(0)
  }

  private loop = (ts: number) => {
    if (!this.isPlaying) return
    if (this.lastTime === null) this.lastTime = ts
    const elapsed = ts - this.lastTime
    this.progress = Math.min(1, elapsed / this.duration)
    this.updateFrame(this.progress)
    if (this.progress < 1) this.animFrame = requestAnimationFrame(this.loop)
    else this.isPlaying = false
  }

  private updateFrame(progress: number) {
    if (!this.map) return

    const cam = interpolateCamera(this.cameraFrames, progress)
    this.map.jumpTo({
      center: [cam.lng, cam.lat],
      zoom: cam.zoom,
      bearing: cam.bearing,
      pitch: cam.pitch,
    })

    this.updateActiveTrail(progress)
    this.renderHud(progress)
  }

  async export(options?: EngineExportOptions): Promise<Blob> {
    const dims = ASPECT_DIMENSIONS[this.config.aspectRatio]
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = dims.width
    exportCanvas.height = dims.height
    const exportCtx = exportCanvas.getContext('2d')!

    const mimeType = MediaRecorder.isTypeSupported(EXPORT_FORMAT) ? EXPORT_FORMAT
      : MediaRecorder.isTypeSupported(EXPORT_FALLBACK) ? EXPORT_FALLBACK : 'video/webm'

    const stream = exportCanvas.captureStream(0)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: EXPORT_BITRATE })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    return new Promise(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      recorder.start()

      const totalFrames = Math.round((this.duration / 1000) * EXPORT_FPS)
      let frame = 0

      const renderFrame = () => {
        if (frame > totalFrames) { recorder.stop(); return }

        const p = frame / totalFrames
        this.updateFrame(p)

        // Wait for MapLibre render
        if (this.map) {
          this.map.once('render', () => {
            const mapCanvas = this.map!.getCanvas()
            exportCtx.drawImage(mapCanvas, 0, 0, dims.width, dims.height)
            exportCtx.drawImage(this.hudCanvas, 0, 0, dims.width, dims.height)
            ;(stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
            options?.onProgress?.(frame / totalFrames)
            frame++
            requestAnimationFrame(renderFrame)
          })
          this.map.triggerRepaint()
        } else {
          frame++
          requestAnimationFrame(renderFrame)
        }
      }
      requestAnimationFrame(renderFrame)
    })
  }

  destroy() {
    this.isPlaying = false
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame)
    this.resizeObserver?.disconnect()
    if (this.map) { this.map.remove(); this.map = null }
    if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas)
  }
}
