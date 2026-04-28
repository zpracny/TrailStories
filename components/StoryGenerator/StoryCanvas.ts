import { StoryConfig, ActivityStoryData, PhotoGroup, IStoryEngine, ASPECT_DIMENSIONS, EngineExportOptions } from './storyTypes'
import {
  GRADIENT_THEMES, TRAIL_COLOR_START, TRAIL_COLOR_END, SUMMIT_COLOR, DAY_END_COLOR, HEAD_COLOR,
  STATS_FONT, SAFE_ZONE_TOP, SAFE_ZONE_BOTTOM, formatActivityDate,
  MAX_SUMMIT_MARKERS, MAX_KM_MARKERS, MIN_KM_MARKER_PX, SUMMIT_MATCH_DIST_M,
  PHOTO_FADE_IN_MS, PHOTO_DISPLAY_MS, PHOTO_CROSSFADE_MS, PHOTO_FADE_OUT_MS,
  EXPORT_FPS, EXPORT_BITRATE, EXPORT_FORMAT, EXPORT_FALLBACK,
} from './storyConstants'
import {
  decodePolyline, getTrailBounds, projectToCanvas, simplifyTrail, haversineDistance,
  computeCumulativeDistances, BBox,
} from './trailProjection'
import { getTilesForBounds, chooseTileZoom, loadAllTiles, renderTiles, TileCoord } from './tileLoader'
import { drawPhotoPauseOverlay } from './storyPhotoUtils'

interface KmMarker { x: number; y: number; km: number; showProgress: number }
interface SummitMarker {
  x: number; y: number; name: string; elevation: number
  progress: number; phase: 'idle' | 'fade-in' | 'label' | 'fade-out'; phaseT: number
}
interface DayEndMarker { x: number; y: number; label: string }

export class StoryCanvas implements IStoryEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: StoryConfig
  private data: ActivityStoryData

  private latlngs: [number, number][] = []
  private cumulDists: number[] = []
  private bounds!: BBox
  private elevation: { altitude: number[]; distance: number[] } | null = null
  private tiles: TileCoord[] = []
  private loadedTiles: Map<string, HTMLImageElement> = new Map()
  private tileZoom = 10

  private bgImage: HTMLImageElement | null = null
  private kmMarkers: KmMarker[] = []
  private summitMarkers: SummitMarker[] = []
  private dayEndMarkers: DayEndMarker[] = []

  private cumulElevGain: number[] = []
  private logoImg: HTMLImageElement | null = null

  private photoGroups: PhotoGroup[] = []
  private loadedImages: Map<string, HTMLImageElement> = new Map()

  private progress = 0
  private animFrame: number | null = null
  private lastTime: number | null = null
  private isPlaying = false
  private duration = 8000

  constructor(canvas: HTMLCanvasElement, config: StoryConfig, data: ActivityStoryData) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.config = config
    this.data = data
    this.duration = config.durationSeconds * 1000
    this.init()
  }

  private async init() {
    // Decode polyline or use preloaded
    if (this.data.preloadedLatLngs && this.data.preloadedLatLngs.length > 0) {
      this.latlngs = this.data.preloadedLatLngs
    } else if (this.data.encodedPolyline) {
      this.latlngs = decodePolyline(this.data.encodedPolyline)
    }
    this.latlngs = simplifyTrail(this.latlngs, 0.00005)
    this.cumulDists = computeCumulativeDistances(this.latlngs)
    this.bounds = getTrailBounds(this.latlngs, 0.10)
    this.adjustBoundsForAspectRatio()

    // Load elevation
    if (this.data.preloadedElevation) {
      this.elevation = this.data.preloadedElevation
    } else if (this.data.cachedElevationUrl) {
      try {
        const res = await fetch(this.data.cachedElevationUrl)
        this.elevation = await res.json()
      } catch { /* no elevation */ }
    }

    // Precompute cumulative elevation gain
    if (this.elevation) {
      const alts = this.elevation.altitude
      const gains: number[] = [0]
      for (let i = 1; i < alts.length; i++) {
        const diff = alts[i] - alts[i - 1]
        gains.push(gains[i - 1] + (diff > 0 ? diff : 0))
      }
      this.cumulElevGain = gains
    }

    // Load logo image
    this.logoImg = await new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null as unknown as HTMLImageElement)
      img.src = '/logo.png'
    })

    // Load tiles for map background
    if (this.config.backgroundType === 'map') {
      this.tileZoom = chooseTileZoom(this.bounds, this.canvas.width)
      this.tiles = getTilesForBounds(this.bounds, this.tileZoom)
      this.loadedTiles = await loadAllTiles(this.tiles, this.config.mapStyle)
    }

    // Load photo background
    if (this.config.backgroundType === 'photo' && this.data.photoUrl) {
      this.bgImage = await new Promise(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null as unknown as HTMLImageElement)
        img.src = this.data.photoUrl!
      })
    }

    this.buildMarkers()
    this.render(0)
  }

  private adjustBoundsForAspectRatio() {
    const canvasAR = this.canvas.width / this.canvas.height
    const lngSpan = this.bounds.maxLng - this.bounds.minLng
    const latSpan = this.bounds.maxLat - this.bounds.minLat
    const geoAR = lngSpan / latSpan

    if (geoAR < canvasAR) {
      const newLng = latSpan * canvasAR
      const midLng = (this.bounds.minLng + this.bounds.maxLng) / 2
      this.bounds.minLng = midLng - newLng / 2
      this.bounds.maxLng = midLng + newLng / 2
    } else if (geoAR > canvasAR) {
      const newLat = lngSpan / canvasAR
      const midLat = (this.bounds.minLat + this.bounds.maxLat) / 2
      this.bounds.minLat = midLat - newLat / 2
      this.bounds.maxLat = midLat + newLat / 2
    }
  }

  private buildMarkers() {
    const w = this.canvas.width
    const h = this.canvas.height

    // KM markers
    const totalKm = (this.data.distance || this.cumulDists[this.cumulDists.length - 1]) / 1000
    const intervals = [0.5, 1, 5, 10]
    let interval = intervals.find(i => totalKm / i <= MAX_KM_MARKERS) || 10
    const kmPositions: { km: number; x: number; y: number }[] = []

    for (let km = interval; km < totalKm; km += interval) {
      const targetM = km * 1000
      let bestIdx = 0
      let bestDiff = Infinity
      for (let i = 0; i < this.cumulDists.length; i++) {
        const diff = Math.abs(this.cumulDists[i] - targetM)
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
      }
      const [lat, lng] = this.latlngs[bestIdx]
      const { x, y } = projectToCanvas(lat, lng, this.bounds, w, h)

      // Min distance check
      const tooClose = kmPositions.some(p => Math.hypot(p.x - x, p.y - y) < MIN_KM_MARKER_PX)
      if (!tooClose) {
        kmPositions.push({ km, x, y })
      }
    }
    this.kmMarkers = kmPositions.map(p => ({
      x: p.x, y: p.y, km: p.km,
      showProgress: (p.km * 1000) / (this.cumulDists[this.cumulDists.length - 1] || 1),
    }))

    // Summit markers
    if (this.config.showSummits && this.data.peakVisits) {
      const peaks = this.data.peakVisits.slice(0, MAX_SUMMIT_MARKERS)
      for (const peak of peaks) {
        // Find nearest trail point
        let bestIdx = 0, bestDist = Infinity
        for (let i = 0; i < this.latlngs.length; i++) {
          const d = haversineDistance(peak.lat, peak.lng, this.latlngs[i][0], this.latlngs[i][1])
          if (d < bestDist) { bestDist = d; bestIdx = i }
        }
        if (bestDist > SUMMIT_MATCH_DIST_M) continue

        const [lat, lng] = this.latlngs[bestIdx]
        const { x, y } = projectToCanvas(lat, lng, this.bounds, w, h)
        const showProgress = this.cumulDists[bestIdx] / (this.cumulDists[this.cumulDists.length - 1] || 1)
        this.summitMarkers.push({
          x, y, name: peak.placeName, elevation: peak.elevation,
          progress: showProgress, phase: 'idle', phaseT: 0,
        })
      }
    }

    // Day end markers
    if (this.config.showDayEndMarkers && this.data.dayEndMarkers) {
      for (const dm of this.data.dayEndMarkers) {
        const { x, y } = projectToCanvas(dm.lat, dm.lng, this.bounds, w, h)
        this.dayEndMarkers.push({ x, y, label: dm.label })
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
    this.render(0)
  }

  private loop = (ts: number) => {
    if (!this.isPlaying) return
    if (this.lastTime === null) this.lastTime = ts
    const elapsed = ts - this.lastTime
    this.progress = Math.min(1, elapsed / this.duration)
    this.render(this.progress)
    if (this.progress < 1) {
      this.animFrame = requestAnimationFrame(this.loop)
    } else {
      this.isPlaying = false
    }
  }

  private render(progress: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const config = this.config

    // 1. Background
    this.drawBackground(ctx, w, h)

    // 2. Vignette
    this.drawVignette(ctx, w, h)

    // 3. Ghost trail
    this.drawGhostTrail(ctx, w, h)

    // 4. Active trail (interpolated endpoint for smooth animation)
    this.drawActiveTrail(ctx, w, h, progress)

    // 5. Start point
    if (this.latlngs.length > 0) {
      const { x, y } = projectToCanvas(this.latlngs[0][0], this.latlngs[0][1], this.bounds, w, h)
      ctx.beginPath()
      ctx.arc(x, y, w * 0.012, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    // 6. Head point — interpolated position
    if (progress > 0 && this.latlngs.length >= 2) {
      const { x, y } = this.interpolatedCanvasPos(progress, w, h)
      const pulse = 1 + 0.3 * Math.sin(progress * Math.PI * 20)
      ctx.beginPath()
      ctx.arc(x, y, w * 0.018 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(249,115,22,0.3)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, w * 0.012, 0, Math.PI * 2)
      ctx.fillStyle = HEAD_COLOR
      ctx.fill()
    }

    // 7. KM markers
    if (config.showKmMarkers) this.drawKmMarkers(ctx, w, h, progress)

    // 8. Summit markers
    if (config.showSummits) this.drawSummitMarkers(ctx, w, h, progress)

    // 9. Day-end markers
    this.drawDayEndMarkers(ctx, w, h)

    // 10. Activity name + sport icon
    this.drawActivityInfo(ctx, w, h)

    // 11. Elevation profile
    if (config.showElevationProfile && this.elevation) {
      this.drawElevationProfile(ctx, w, h, progress)
    }

    // 12. Stats overlay
    this.drawStats(ctx, w, h, progress)

    // 13. Progress bar
    this.drawProgressBar(ctx, w, h, progress)

    // 14. Logo
    if (config.showLogo) this.drawLogo(ctx, w, h)

    // 15. Photo pause overlay
    this.drawPhotoOverlay(ctx, w, h, progress)
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.config.backgroundType === 'gradient') {
      const colors = GRADIENT_THEMES[this.config.gradientTheme] || GRADIENT_THEMES.night
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, colors[0])
      grad.addColorStop(0.5, colors[1])
      grad.addColorStop(1, colors[2])
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    } else if (this.config.backgroundType === 'map') {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
      renderTiles(ctx, this.tiles, this.loadedTiles, this.bounds, w, h, this.tileZoom)
    } else if (this.config.backgroundType === 'photo' && this.bgImage) {
      const scale = Math.max(w / this.bgImage.width, h / this.bgImage.height)
      const sw = this.bgImage.width * scale
      const sh = this.bgImage.height * scale
      ctx.drawImage(this.bgImage, (w - sw) / 2, (h - sh) / 2, sw, sh)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, 0, w, h)
    } else {
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, w, h)
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  private drawGhostTrail(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.latlngs.length < 2) return
    ctx.beginPath()
    const { x: x0, y: y0 } = projectToCanvas(this.latlngs[0][0], this.latlngs[0][1], this.bounds, w, h)
    ctx.moveTo(x0, y0)
    for (let i = 1; i < this.latlngs.length; i++) {
      const { x, y } = projectToCanvas(this.latlngs[i][0], this.latlngs[i][1], this.bounds, w, h)
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = w * 0.004
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
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

  private interpolatedCanvasPos(progress: number, w: number, h: number): { x: number; y: number } {
    const [lat, lng] = this.interpolatedLatLng(progress)
    return projectToCanvas(lat, lng, this.bounds, w, h)
  }

  private drawActiveTrail(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    if (progress <= 0 || this.latlngs.length < 2) return
    const n = this.latlngs.length
    const totalIdx = progress * (n - 1)
    const endIdx = Math.floor(totalIdx)
    const frac = totalIdx - endIdx

    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, TRAIL_COLOR_START)
    grad.addColorStop(1, TRAIL_COLOR_END)
    ctx.beginPath()
    const { x: x0, y: y0 } = projectToCanvas(this.latlngs[0][0], this.latlngs[0][1], this.bounds, w, h)
    ctx.moveTo(x0, y0)
    for (let i = 1; i <= endIdx && i < n; i++) {
      const { x, y } = projectToCanvas(this.latlngs[i][0], this.latlngs[i][1], this.bounds, w, h)
      ctx.lineTo(x, y)
    }
    // Smooth fractional endpoint
    if (frac > 0 && endIdx + 1 < n) {
      const { x, y } = this.interpolatedCanvasPos(progress, w, h)
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = grad
    ctx.lineWidth = w * 0.006
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  private drawKmMarkers(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    const r = w * 0.018
    const fontSize = Math.round(h * 0.016)
    ctx.font = `600 ${fontSize}px ${STATS_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const marker of this.kmMarkers) {
      if (progress < marker.showProgress) continue
      const alpha = Math.min(1, (progress - marker.showProgress) / 0.02)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(249,115,22,0.85)'
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`${marker.km}`, marker.x, marker.y)
      ctx.restore()
    }
  }

  private drawSummitMarkers(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    const r = w * 0.02
    const fontSize = Math.round(h * 0.016)

    for (const marker of this.summitMarkers) {
      if (progress < marker.progress) { marker.phase = 'idle'; continue }

      const elapsed = (progress - marker.progress) * this.duration
      let alpha = 1

      if (elapsed < PHOTO_FADE_IN_MS) {
        alpha = elapsed / PHOTO_FADE_IN_MS
        marker.phase = 'fade-in'
      } else if (elapsed < PHOTO_FADE_IN_MS + PHOTO_DISPLAY_MS) {
        alpha = 1
        marker.phase = 'label'
      } else {
        alpha = Math.max(0, 1 - (elapsed - PHOTO_FADE_IN_MS - PHOTO_DISPLAY_MS) / PHOTO_FADE_OUT_MS)
        marker.phase = 'fade-out'
        if (alpha <= 0) continue
      }

      ctx.save()
      ctx.globalAlpha = alpha

      // Summit circle
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2)
      ctx.fillStyle = SUMMIT_COLOR
      ctx.fill()

      // Label (in label phase)
      if (marker.phase === 'label' || (marker.phase === 'fade-out' && alpha > 0.3)) {
        ctx.font = `700 ${fontSize}px ${STATS_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const label = `${marker.name} ${marker.elevation}m`
        const textW = ctx.measureText(label).width + 16
        const labelX = Math.max(textW / 2 + 4, Math.min(w - textW / 2 - 4, marker.x))
        const labelY = marker.y - r - 8

        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.beginPath()
        ctx.roundRect(labelX - textW / 2, labelY - fontSize - 4, textW, fontSize + 8, 6)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.fillText(label, labelX, labelY)
      }

      ctx.restore()
    }
  }

  private drawDayEndMarkers(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = w * 0.022
    const fontSize = Math.round(h * 0.016)

    for (const marker of this.dayEndMarkers) {
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2)
      ctx.fillStyle = DAY_END_COLOR
      ctx.fill()

      ctx.font = `700 ${fontSize}px ${STATS_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(marker.label, marker.x, marker.y)
    }
  }

  private drawActivityInfo(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const safeTopOffset = this.config.enableSafeZones ? (SAFE_ZONE_TOP / 1920) * h : h * 0.04
    const x = w * 0.06
    const y = safeTopOffset + h * 0.04

    const nameFontSize = Math.round(h * 0.028)
    ctx.font = `700 ${nameFontSize}px ${STATS_FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(formatActivityDate(this.data.activityStartDate), x, y)
  }

  private drawElevationProfile(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    if (!this.elevation) return
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const profH = h * 0.08
    const profY = h - safeBottom - profH - h * 0.08
    const profW = w * 0.88
    const profX = w * 0.06

    const alts = this.elevation.altitude
    if (alts.length < 2) return

    const minAlt = Math.min(...alts)
    const maxAlt = Math.max(...alts)
    const altRange = maxAlt - minAlt || 1

    const endIdx = Math.round(progress * (alts.length - 1))

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.roundRect(profX - 8, profY - 8, profW + 16, profH + 16, 6)
    ctx.fill()

    // Profile shape
    ctx.beginPath()
    ctx.moveTo(profX, profY + profH)
    for (let i = 0; i < alts.length; i++) {
      const x = profX + (i / (alts.length - 1)) * profW
      const y = profY + profH - ((alts[i] - minAlt) / altRange) * profH
      if (i === 0) ctx.lineTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineTo(profX + profW, profY + profH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fill()

    // Active portion
    if (endIdx > 0) {
      const activeW = (endIdx / (alts.length - 1)) * profW
      ctx.beginPath()
      ctx.moveTo(profX, profY + profH)
      for (let i = 0; i <= endIdx; i++) {
        const x = profX + (i / (alts.length - 1)) * profW
        const y = profY + profH - ((alts[i] - minAlt) / altRange) * profH
        ctx.lineTo(x, y)
      }
      ctx.lineTo(profX + activeW, profY + profH)
      ctx.closePath()
      const grad = ctx.createLinearGradient(profX, 0, profX + profW, 0)
      grad.addColorStop(0, 'rgba(34,197,94,0.6)')
      grad.addColorStop(1, 'rgba(249,115,22,0.6)')
      ctx.fillStyle = grad
      ctx.fill()
    }
  }

  private drawStats(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const hasElevProfile = this.config.showElevationProfile && this.elevation
    const statsY = h - safeBottom - (hasElevProfile ? h * 0.18 : h * 0.06)

    const stats: { label: string; value: string }[] = []

    if (this.config.showDistance) {
      stats.push({ label: 'km', value: (progress * this.data.distance / 1000).toFixed(1) })
    }
    if (this.config.showElevation) {
      let elev: number
      if (this.cumulElevGain.length > 0) {
        const idx = Math.round(progress * (this.cumulElevGain.length - 1))
        elev = this.cumulElevGain[idx]
      } else {
        elev = this.data.elevationGain * progress
      }
      stats.push({ label: 'm↑', value: String(Math.round(elev)) })
    }
    if (this.config.showTime) {
      const t = Math.round(progress * this.data.movingTime)
      const h2 = Math.floor(t / 3600)
      const m = Math.floor((t % 3600) / 60)
      stats.push({ label: 'čas', value: `${h2}:${String(m).padStart(2, '0')}` })
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

  private drawProgressBar(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
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
  }

  private drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.logoImg) return
    const safeTop = this.config.enableSafeZones ? (SAFE_ZONE_TOP / 1920) * h : h * 0.04
    const logoH = Math.round(h * 0.036)
    const logoW = Math.round(logoH * (this.logoImg.naturalWidth / this.logoImg.naturalHeight))
    ctx.globalAlpha = 0.85
    ctx.drawImage(this.logoImg, w - w * 0.06 - logoW, safeTop + h * 0.015, logoW, logoH)
    ctx.globalAlpha = 1
  }

  private drawPhotoOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    if (!this.config.showTrailPhotos || this.photoGroups.length === 0) return

    for (const group of this.photoGroups) {
      const groupStart = group.position
      if (progress < groupStart) continue

      const elapsed = (progress - groupStart) * this.duration
      const pauseTotal = PHOTO_FADE_IN_MS + PHOTO_DISPLAY_MS + PHOTO_FADE_OUT_MS
      if (elapsed > pauseTotal) continue

      let alpha = 0
      let photoIndex = 0

      if (elapsed < PHOTO_FADE_IN_MS) {
        alpha = elapsed / PHOTO_FADE_IN_MS
      } else if (elapsed < PHOTO_FADE_IN_MS + PHOTO_DISPLAY_MS) {
        alpha = 1
        const displayElapsed = elapsed - PHOTO_FADE_IN_MS
        photoIndex = Math.min(
          group.photos.length - 1,
          Math.floor((displayElapsed / PHOTO_DISPLAY_MS) * group.photos.length)
        )
      } else {
        alpha = 1 - (elapsed - PHOTO_FADE_IN_MS - PHOTO_DISPLAY_MS) / PHOTO_FADE_OUT_MS
        photoIndex = group.photos.length - 1
      }

      if (alpha > 0) {
        drawPhotoPauseOverlay(ctx, alpha, photoIndex, group, this.loadedImages, w, h)
      }
    }
  }

  async export(options?: EngineExportOptions): Promise<Blob> {
    const dims = ASPECT_DIMENSIONS[this.config.aspectRatio]
    const totalFrames = Math.round((this.duration / 1000) * EXPORT_FPS)

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = dims.width
    exportCanvas.height = dims.height
    const exportCtx = exportCanvas.getContext('2d')!

    const { encodeVideo } = await import('./videoExport')
    return encodeVideo(
      exportCanvas,
      totalFrames,
      options?.format ?? 'webm',
      (_frame, progress) => {
        this.render(progress)
        exportCtx.drawImage(this.canvas, 0, 0, dims.width, dims.height)
      },
      options?.onProgress,
    )
  }

  destroy() {
    this.isPlaying = false
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame)
  }
}
