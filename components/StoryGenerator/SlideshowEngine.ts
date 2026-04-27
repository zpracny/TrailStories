import { StoryConfig, ActivityStoryData, PhotoItem, IStoryEngine, ASPECT_DIMENSIONS, EngineExportOptions } from './storyTypes'
import { STATS_FONT, LOGO_TEXT, SAFE_ZONE_TOP, SAFE_ZONE_BOTTOM, EXPORT_FPS, EXPORT_BITRATE, EXPORT_FORMAT, EXPORT_FALLBACK } from './storyConstants'

type Transition = 'crossfade' | 'slide' | 'zoom'

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export class SlideshowEngine implements IStoryEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: StoryConfig
  private data: ActivityStoryData

  private photos: PhotoItem[] = []
  private loadedImages: Map<string, HTMLImageElement> = new Map()

  private progress = 0
  private duration = 10000
  private animFrame: number | null = null
  private lastTime: number | null = null
  private isPlaying = false

  constructor(canvas: HTMLCanvasElement, config: StoryConfig, data: ActivityStoryData) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.config = config
    this.data = data
    this.duration = config.durationSeconds * 1000
    this.photos = data.allPhotos || []
    this.init()
  }

  private async init() {
    if (this.photos.length === 0) {
      this.renderPlaceholder()
      return
    }

    await Promise.allSettled(
      this.photos.map(
        p =>
          new Promise<void>(resolve => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => { this.loadedImages.set(p.id, img); resolve() }
            img.onerror = () => resolve()
            img.src = p.url
          })
      )
    )
    this.render(0)
  }

  private renderPlaceholder() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.fillStyle = '#111118'
    ctx.fillRect(0, 0, w, h)
    ctx.font = `400 ${Math.round(h * 0.025)}px ${STATS_FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Žádné fotky k zobrazení', w / 2, h / 2)
  }

  private render(progress: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const n = this.photos.length
    if (n === 0) { this.renderPlaceholder(); return }

    const displayDuration = this.duration / n
    const crossfadeDuration = Math.min(400, displayDuration / 2)
    const crossfadeFraction = crossfadeDuration / this.duration

    const slideProgress = progress * n
    const currentIdx = Math.min(n - 1, Math.floor(slideProgress))
    const nextIdx = Math.min(n - 1, currentIdx + 1)
    const frac = slideProgress - currentIdx
    const transition = this.config.slideshowTransition

    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    const drawPhoto = (photo: PhotoItem, alpha: number, offsetX = 0, scale = 1) => {
      const img = this.loadedImages.get(photo.id)
      if (!img) return
      const imgScale = Math.max(w / img.width, h / img.height) * scale
      const iw = img.width * imgScale
      const ih = img.height * imgScale
      const ix = (w - iw) / 2 + offsetX
      const iy = (h - ih) / 2
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(img, ix, iy, iw, ih)
      ctx.restore()
    }

    const isCrossfading = frac > 1 - crossfadeFraction / (1 / n)
    const crossfadeAlpha = isCrossfading ? easeInOutCubic((frac - (1 - crossfadeFraction)) / crossfadeFraction) : 0

    if (transition === 'crossfade') {
      drawPhoto(this.photos[currentIdx], 1 - crossfadeAlpha)
      if (crossfadeAlpha > 0 && nextIdx !== currentIdx) {
        drawPhoto(this.photos[nextIdx], crossfadeAlpha)
      }
    } else if (transition === 'slide') {
      const offset = easeInOutCubic(crossfadeAlpha) * w
      drawPhoto(this.photos[currentIdx], 1, -offset)
      if (crossfadeAlpha > 0 && nextIdx !== currentIdx) {
        drawPhoto(this.photos[nextIdx], 1, w - offset)
      }
    } else if (transition === 'zoom') {
      const zoomScale = 1 - crossfadeAlpha * 0.1
      drawPhoto(this.photos[currentIdx], 1 - crossfadeAlpha, 0, zoomScale)
      if (crossfadeAlpha > 0 && nextIdx !== currentIdx) {
        drawPhoto(this.photos[nextIdx], crossfadeAlpha)
      }
    }

    // Edge fades
    const topFade = ctx.createLinearGradient(0, 0, 0, h * 0.2)
    topFade.addColorStop(0, 'rgba(0,0,0,0.5)')
    topFade.addColorStop(1, 'transparent')
    ctx.fillStyle = topFade
    ctx.fillRect(0, 0, w, h * 0.2)

    const botFade = ctx.createLinearGradient(0, h * 0.75, 0, h)
    botFade.addColorStop(0, 'transparent')
    botFade.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.fillStyle = botFade
    ctx.fillRect(0, h * 0.75, w, h * 0.25)

    // Activity name
    const safeTop = this.config.enableSafeZones ? (SAFE_ZONE_TOP / 1920) * h : h * 0.04
    const nameFontSize = Math.round(h * 0.028)
    ctx.font = `700 ${nameFontSize}px ${STATS_FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.name, w * 0.06, safeTop + h * 0.02)

    // Stats
    const safeBottom = this.config.enableSafeZones ? (SAFE_ZONE_BOTTOM / 1920) * h : 0
    const statsY = h - safeBottom - h * 0.06
    const statsData: { label: string; value: string }[] = [
      { label: 'km', value: (this.data.distance / 1000).toFixed(1) },
      { label: 'm↑', value: String(Math.round(this.data.elevationGain)) },
    ]
    const fontSize = Math.round(h * 0.03)
    const labelSize = Math.round(h * 0.016)
    const colW = w / (statsData.length + 1)
    statsData.forEach((s, i) => {
      const sx = colW * (i + 1)
      ctx.font = `700 ${fontSize}px ${STATS_FONT}`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(s.value, sx, statsY)
      ctx.font = `400 ${labelSize}px ${STATS_FONT}`
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText(s.label, sx, statsY + labelSize + 4)
    })

    // Progress bar
    const barH = Math.round(h * 0.004)
    const barY = h - safeBottom - barH
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(0, barY, w, barH)
    ctx.fillStyle = '#f97316'
    ctx.fillRect(0, barY, w * progress, barH)

    // Slide counter
    const counterFontSize = Math.round(h * 0.018)
    ctx.font = `400 ${counterFontSize}px ${STATS_FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${currentIdx + 1} / ${n}`, w - w * 0.05, safeTop + h * 0.02)

    // Logo
    if (this.config.showLogo) {
      const logoSize = Math.round(h * 0.018)
      ctx.font = `700 ${logoSize}px ${STATS_FONT}`
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(LOGO_TEXT, w - w * 0.04, h - safeBottom - h * 0.01)
    }
  }

  setPhotoPauses() { /* not used */ }

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
    if (this.progress < 1) this.animFrame = requestAnimationFrame(this.loop)
    else this.isPlaying = false
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
        this.render(p)
        exportCtx.drawImage(this.canvas, 0, 0, dims.width, dims.height)
        ;(stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
        options?.onProgress?.(p)
        frame++
        requestAnimationFrame(renderFrame)
      }
      requestAnimationFrame(renderFrame)
    })
  }

  destroy() {
    this.isPlaying = false
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame)
  }
}
