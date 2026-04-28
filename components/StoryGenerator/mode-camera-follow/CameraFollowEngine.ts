import maplibregl from 'maplibre-gl'
import { StoryConfig, ActivityStoryData, PhotoGroup, IStoryEngine, ASPECT_DIMENSIONS, EngineExportOptions } from '../storyTypes'
import {
  TRAIL_COLOR_START, TRAIL_COLOR_END,
  STATS_FONT, SAFE_ZONE_TOP, SAFE_ZONE_BOTTOM,
  EXPORT_FPS, formatActivityDate,
} from '../storyConstants'
import { decodePolyline, simplifyTrail, computeCumulativeDistances, getPositionAtProgress } from '../trailProjection'
import { getCameraFollowStyle } from '../story3DStyles'
import { drawPhotoPauseOverlay } from '../storyPhotoUtils'

function calcZoomForKm(km: number, lat: number): number {
  const metersPerPixel = (km * 1000) / 512
  const metersPerPixelAtZoom0 = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 256
  return Math.log2(metersPerPixelAtZoom0 / metersPerPixel)
}

export class CameraFollowEngine implements IStoryEngine {
  private container: HTMLElement
  private config: StoryConfig
  private data: ActivityStoryData
  private map: maplibregl.Map | null = null
  private hudCanvas: HTMLCanvasElement
  private hudCtx: CanvasRenderingContext2D

  private latlngs: [number, number][] = []
  private cumulDists: number[] = []
  private elevation: { altitude: number[]; distance: number[] } | null = null

  private progress = 0
  private duration = 15000
  private animFrame: number | null = null
  private lastTime: number | null = null
  private isPlaying = false

  private logoImg: HTMLImageElement | null = null

  private photoGroups: PhotoGroup[] = []
  private loadedImages: Map<string, HTMLImageElement> = new Map()
  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement, config: StoryConfig, data: ActivityStoryData) {
    this.container = container
    this.config = config
    this.data = data
    this.duration = config.durationSeconds * 1000

    this.hudCanvas = document.createElement('canvas')
    this.hudCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%'
    this.hudCtx = this.hudCanvas.getContext('2d')!
    container.style.position = 'relative'
    container.appendChild(this.hudCanvas)

    this.init()
  }

  private async init() {
    if (this.data.preloadedLatLngs && this.data.preloadedLatLngs.length > 0) {
      this.latlngs = this.data.preloadedLatLngs
    } else if (this.data.encodedPolyline) {
      this.latlngs = decodePolyline(this.data.encodedPolyline)
    }
    this.latlngs = simplifyTrail(this.latlngs, 0.00005)
    this.cumulDists = computeCumulativeDistances(this.latlngs)

    if (this.data.preloadedElevation) {
      this.elevation = this.data.preloadedElevation
    } else if (this.data.cachedElevationUrl) {
      try {
        const res = await fetch(this.data.cachedElevationUrl)
        this.elevation = await res.json()
      } catch { /* no elevation */ }
    }

    if (this.latlngs.length === 0) return

    // Load logo image
    this.logoImg = await new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null as unknown as HTMLImageElement)
      img.src = '/logo.png'
    })

    const startPos = this.latlngs[0]
    const zoom = calcZoomForKm(this.config.cfViewportKm, startPos[0])
    const cfStyle = (this.config as unknown as Record<string, string>)['cfMapStyle'] || 'standard'
    const style = getCameraFollowStyle(cfStyle) as maplibregl.StyleSpecification

    this.map = new maplibregl.Map({
      container: this.container,
      style,
      center: [startPos[1], startPos[0]],
      zoom,
      bearing: 0,
      pitch: 0,
      attributionControl: false,
      interactive: false,
    })

    this.map.once('load', () => {
      this.addTrailLayers()
      this.map!.resize()
      this.resizeHud()
      this.renderHud(0)
    })

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize()
      this.resizeHud()
    })
    this.resizeObserver.observe(this.container)
  }

  private addTrailLayers() {
    if (!this.map) return

    const fullLine: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: this.latlngs.map(([lat, lng]) => [lng, lat]) },
    }

    if (this.config.cfShowGhostTrail) {
      this.map.addSource('ghost-trail', { type: 'geojson', data: fullLine })
      this.map.addLayer({
        id: 'ghost-trail-layer',
        type: 'line',
        source: 'ghost-trail',
        paint: { 'line-color': '#ffffff', 'line-opacity': 0.15, 'line-width': 2 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    this.map.addSource('active-trail', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[this.latlngs[0][1], this.latlngs[0][0]]] } },
    })
    this.map.addLayer({
      id: 'active-trail-layer',
      type: 'line',
      source: 'active-trail',
      paint: { 'line-color': TRAIL_COLOR_END, 'line-width': 4, 'line-opacity': 0.9 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
  }

  private resizeHud = () => {
    const rect = this.container.getBoundingClientRect()
    this.hudCanvas.width = rect.width || 400
    this.hudCanvas.height = rect.height || 400
    this.renderHud(this.progress)
  }

  private renderHud(progress: number) {
    const ctx = this.hudCtx
    const w = this.hudCanvas.width
    const h = this.hudCanvas.height
    ctx.clearRect(0, 0, w, h)

    // Top fade
    const topFade = ctx.createLinearGradient(0, 0, 0, h * 0.2)
    topFade.addColorStop(0, 'rgba(0,0,0,0.5)')
    topFade.addColorStop(1, 'transparent')
    ctx.fillStyle = topFade
    ctx.fillRect(0, 0, w, h * 0.2)

    // Bottom fade
    const botFade = ctx.createLinearGradient(0, h * 0.7, 0, h)
    botFade.addColorStop(0, 'transparent')
    botFade.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.fillStyle = botFade
    ctx.fillRect(0, h * 0.7, w, h * 0.3)

    // Activity name
    const safeTop = this.config.enableSafeZones ? (SAFE_ZONE_TOP / 1920) * h : h * 0.03
    const nameFontSize = Math.round(h * 0.026)
    ctx.font = `700 ${nameFontSize}px ${STATS_FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(formatActivityDate(this.data.activityStartDate), w * 0.05, safeTop + h * 0.015)

    // Logo top-right
    if (this.config.showLogo && this.logoImg) {
      const logoH = Math.round(h * 0.036)
      const logoW = Math.round(logoH * (this.logoImg.naturalWidth / this.logoImg.naturalHeight))
      ctx.globalAlpha = 0.85
      ctx.drawImage(this.logoImg, w - w * 0.06 - logoW, safeTop + h * 0.008, logoW, logoH)
      ctx.globalAlpha = 1
    }

    // Moving dot (drawn via MapLibre marker concept — we draw on HUD)
    const pos = getPositionAtProgress(this.latlngs, this.cumulDists, progress)
    if (this.map) {
      const screenPos = this.map.project([pos[1], pos[0]])
      const dotX = (screenPos.x / this.map.getCanvas().width) * w
      const dotY = (screenPos.y / this.map.getCanvas().height) * h
      const r = w * 0.02
      // Pulse
      const pulse = 1 + 0.25 * Math.sin(progress * Math.PI * 30)
      ctx.beginPath()
      ctx.arc(dotX, dotY, r * 1.6 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(249,115,22,0.25)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(dotX, dotY, r, 0, Math.PI * 2)
      ctx.fillStyle = TRAIL_COLOR_END
      ctx.fill()
    }

    // Elevation mini profile
    if (this.elevation && this.elevation.altitude.length > 1) {
      const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
      const profH = h * 0.05
      const profY = h - safeBottom - profH - h * 0.12
      const profW = w * 0.88
      const profX = w * 0.06
      const alts = this.elevation.altitude
      const minAlt = Math.min(...alts)
      const maxAlt = Math.max(...alts)
      const altRange = maxAlt - minAlt || 1

      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.roundRect(profX - 6, profY - 4, profW + 12, profH + 8, 4)
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(profX, profY + profH)
      for (let i = 0; i < alts.length; i++) {
        const x = profX + (i / (alts.length - 1)) * profW
        const y = profY + profH - ((alts[i] - minAlt) / altRange) * profH
        ctx.lineTo(x, y)
      }
      ctx.lineTo(profX + profW, profY + profH)
      ctx.closePath()
      ctx.fillStyle = 'rgba(249,115,22,0.4)'
      ctx.fill()
    }

    // Stats
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const statsY = h - safeBottom - h * 0.055
    const stats: { label: string; value: string }[] = []
    const progressDist = progress * (this.data.distance || 0)
    if (this.config.showDistance) stats.push({ label: 'km', value: (progressDist / 1000).toFixed(1) })
    if (this.config.showElevation) stats.push({ label: 'm↑', value: String(Math.round(this.data.elevationGain * progress)) })
    if (this.config.showTime) {
      const t = Math.round(this.data.movingTime * progress)
      const hh = Math.floor(t / 3600)
      const mm = Math.floor((t % 3600) / 60)
      stats.push({ label: 'čas', value: `${hh}:${String(mm).padStart(2, '0')}` })
    }

    if (stats.length > 0) {
      const fontSize = Math.round(h * 0.028)
      const labelSize = Math.round(h * 0.015)
      const colW = w / (stats.length + 1)
      ctx.textAlign = 'center'
      stats.forEach((s, i) => {
        const sx = colW * (i + 1)
        ctx.font = `700 ${fontSize}px ${STATS_FONT}`
        ctx.fillStyle = '#ffffff'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(s.value, sx, statsY)
        ctx.font = `400 ${labelSize}px ${STATS_FONT}`
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText(s.label, sx, statsY + labelSize + 3)
      })
    }

    // Progress bar
    const barH = Math.round(h * 0.004)
    const barY = h - safeBottom - barH
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(0, barY, w, barH)
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, TRAIL_COLOR_START)
    grad.addColorStop(1, TRAIL_COLOR_END)
    ctx.fillStyle = grad
    ctx.fillRect(0, barY, w * progress, barH)

    // Photo overlay
    if (this.config.showTrailPhotos && this.photoGroups.length > 0) {
      for (const group of this.photoGroups) {
        if (progress < group.position) continue
        const elapsed = (progress - group.position) * this.duration
        const pauseTotal = 3000
        if (elapsed > pauseTotal) continue
        const alpha = elapsed < 500 ? elapsed / 500 : elapsed < 2500 ? 1 : Math.max(0, 1 - (elapsed - 2500) / 500)
        if (alpha > 0) drawPhotoPauseOverlay(ctx, alpha, 0, group, this.loadedImages, w, h)
      }
    }
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

  private interpolatedLatLng(progress: number): [number, number] {
    const n = this.latlngs.length
    const totalIdx = Math.max(0, Math.min(n - 1, progress * (n - 1)))
    const lo = Math.floor(totalIdx)
    const frac = totalIdx - lo
    if (frac === 0 || lo >= n - 1) return this.latlngs[Math.min(lo, n - 1)]
    const a = this.latlngs[lo], b = this.latlngs[lo + 1]
    return [a[0] + frac * (b[0] - a[0]), a[1] + frac * (b[1] - a[1])]
  }

  private updateFrame(progress: number) {
    if (!this.map) return

    const [lat, lng] = this.interpolatedLatLng(progress)
    const zoom = calcZoomForKm(this.config.cfViewportKm, lat)
    this.map.jumpTo({ center: [lng, lat], zoom, bearing: 0, pitch: 0 })

    // Update active trail with interpolated endpoint
    const n = this.latlngs.length
    const totalIdx = progress * (n - 1)
    const endIdx = Math.floor(totalIdx)
    const frac = totalIdx - endIdx
    const coords = this.latlngs.slice(0, endIdx + 1).map(([la, lo2]) => [lo2, la] as [number, number])
    if (frac > 0 && endIdx + 1 < n) {
      const [iLat, iLng] = this.interpolatedLatLng(progress)
      coords.push([iLng, iLat])
    }
    if (coords.length >= 2 && this.map.getSource('active-trail')) {
      const src = this.map.getSource('active-trail') as maplibregl.GeoJSONSource
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })
    }

    this.renderHud(progress)
  }

  async export(options?: EngineExportOptions): Promise<Blob> {
    const dims = ASPECT_DIMENSIONS[this.config.aspectRatio]
    const totalFrames = Math.round((this.duration / 1000) * EXPORT_FPS)

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = dims.width
    exportCanvas.height = dims.height
    const exportCtx = exportCanvas.getContext('2d')!

    const prevFlex = this.container.style.flex
    const prevW = this.container.style.width
    const prevH = this.container.style.height
    this.container.style.flex = 'none'
    this.container.style.width = `${dims.width}px`
    this.container.style.height = `${dims.height}px`
    this.map!.resize()
    this.resizeHud()

    const waitForRender = (): Promise<void> => new Promise(resolve => {
      this.map!.once('render', () => resolve())
      this.map!.triggerRepaint()
    })

    await waitForRender()

    const { encodeVideo } = await import('../videoExport')
    let result: Blob
    try {
      result = await encodeVideo(
        exportCanvas,
        totalFrames,
        options?.format ?? 'webm',
        async (_frame, progress) => {
          this.updateFrame(progress)
          if (this.map) {
            await waitForRender()
            exportCtx.drawImage(this.map.getCanvas(), 0, 0, dims.width, dims.height)
            exportCtx.drawImage(this.hudCanvas, 0, 0, dims.width, dims.height)
          }
        },
        options?.onProgress,
      )
    } finally {
      this.container.style.flex = prevFlex
      this.container.style.width = prevW
      this.container.style.height = prevH
      this.map?.resize()
      this.resizeHud()
    }
    return result
  }

  destroy() {
    this.isPlaying = false
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame)
    this.resizeObserver?.disconnect()
    if (this.map) { this.map.remove(); this.map = null }
    if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas)
  }
}
