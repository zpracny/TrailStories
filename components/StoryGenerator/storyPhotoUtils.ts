import { StoryPhoto, PhotoGroup, MappedPhoto, PauseTimeline, PauseSegment } from './storyTypes'
import { haversineDistance, computeCumulativeDistances } from './trailProjection'
import {
  PHOTO_FADE_IN_MS, PHOTO_DISPLAY_MS, PHOTO_CROSSFADE_MS, PHOTO_FADE_OUT_MS,
  MAX_PHOTO_GROUPS, PHOTO_GROUP_MERGE_THRESHOLD,
} from './storyConstants'

export function mapPhotosToRoute(
  photos: StoryPhoto[],
  latlngs: [number, number][]
): MappedPhoto[] {
  const cumulDists = computeCumulativeDistances(latlngs)
  const totalDist = cumulDists[cumulDists.length - 1]

  return photos
    .map((photo): MappedPhoto | null => {
      // GPS matching
      if (photo.lat !== null && photo.lng !== null) {
        let bestIdx = 0
        let bestDist = Infinity
        for (let i = 0; i < latlngs.length; i++) {
          const d = haversineDistance(photo.lat!, photo.lng!, latlngs[i][0], latlngs[i][1])
          if (d < bestDist) { bestDist = d; bestIdx = i }
        }
        return {
          photo,
          position: cumulDists[bestIdx] / totalDist,
          trailDistanceM: cumulDists[bestIdx],
        }
      }
      return null
    })
    .filter((m): m is MappedPhoto => m !== null)
    .sort((a, b) => a.position - b.position)
}

export function groupNearbyPhotos(mapped: MappedPhoto[]): PhotoGroup[] {
  if (mapped.length === 0) return []

  const groups: PhotoGroup[] = []
  let currentGroup: MappedPhoto[] = [mapped[0]]

  for (let i = 1; i < mapped.length; i++) {
    const prev = mapped[i - 1]
    const curr = mapped[i]
    if (curr.position - prev.position < PHOTO_GROUP_MERGE_THRESHOLD) {
      currentGroup.push(curr)
    } else {
      const anchor = currentGroup[Math.floor(currentGroup.length / 2)]
      groups.push({
        id: `group-${groups.length}`,
        photos: currentGroup.map(m => m.photo),
        position: anchor.position,
        trailDistanceM: anchor.trailDistanceM,
      })
      currentGroup = [curr]
    }
  }
  if (currentGroup.length > 0) {
    const anchor = currentGroup[Math.floor(currentGroup.length / 2)]
    groups.push({
      id: `group-${groups.length}`,
      photos: currentGroup.map(m => m.photo),
      position: anchor.position,
      trailDistanceM: anchor.trailDistanceM,
    })
  }
  return groups
}

export function limitPhotoGroups(groups: PhotoGroup[], max = MAX_PHOTO_GROUPS): PhotoGroup[] {
  if (groups.length <= max) return groups
  const step = groups.length / max
  return Array.from({ length: max }, (_, i) => groups[Math.round(i * step)])
}

function pauseDurationMs(group: PhotoGroup): number {
  const photoCount = group.photos.length
  return PHOTO_FADE_IN_MS + PHOTO_DISPLAY_MS + PHOTO_CROSSFADE_MS * Math.max(0, photoCount - 1) + PHOTO_FADE_OUT_MS
}

export function buildPhotoPauseTimeline(groups: PhotoGroup[], trailDurationMs: number): PauseTimeline {
  if (groups.length === 0) {
    return {
      segments: [{ type: 'trail', startProgress: 0, endProgress: 1 }],
      totalDuration: trailDurationMs,
    }
  }

  const segments: PauseSegment[] = []
  let prevPos = 0
  let totalMs = 0

  for (const group of groups) {
    segments.push({
      type: 'trail',
      startProgress: prevPos,
      endProgress: group.position,
    })
    totalMs += (group.position - prevPos) * trailDurationMs

    segments.push({
      type: 'pause',
      startProgress: group.position,
      endProgress: group.position,
      group,
    })
    totalMs += pauseDurationMs(group)

    prevPos = group.position
  }

  segments.push({ type: 'trail', startProgress: prevPos, endProgress: 1 })
  totalMs += (1 - prevPos) * trailDurationMs

  return { segments, totalDuration: totalMs }
}

export async function preloadStoryPhotos(groups: PhotoGroup[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  await Promise.allSettled(
    groups.flatMap(g => g.photos).map(
      photo =>
        new Promise<void>(resolve => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => { map.set(photo.id, img); resolve() }
          img.onerror = () => resolve()
          img.src = photo.url
        })
    )
  )
  return map
}

export function drawPhotoPauseOverlay(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  photoIndex: number,
  group: PhotoGroup,
  loadedImages: Map<string, HTMLImageElement>,
  w: number,
  h: number
): void {
  if (alpha <= 0 || !group) return

  ctx.save()
  ctx.globalAlpha = alpha

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, w, h)

  const photo = group.photos[photoIndex]
  if (!photo) { ctx.restore(); return }

  const img = loadedImages.get(photo.id)
  if (img) {
    const maxW = w * 0.65
    const maxH = h * 0.55
    const scale = Math.min(maxW / img.width, maxH / img.height)
    const imgW = img.width * scale
    const imgH = img.height * scale
    const imgX = (w - imgW) / 2
    const imgY = h * 0.18

    // Polaroid frame
    ctx.fillStyle = '#ffffff'
    const pad = 12
    ctx.fillRect(imgX - pad, imgY - pad, imgW + pad * 2, imgH + pad * 2 + 32)

    // Clip to image rect
    ctx.save()
    ctx.beginPath()
    ctx.rect(imgX, imgY, imgW, imgH)
    ctx.clip()
    ctx.drawImage(img, imgX, imgY, imgW, imgH)
    ctx.restore()

    // Caption/info text
    const infoY = imgY + imgH + pad + 8 + 18
    ctx.fillStyle = '#000000'
    ctx.font = `${Math.round(h * 0.014)}px Barlow, system-ui, sans-serif`
    ctx.textAlign = 'center'
    const distKm = (group.trailDistanceM / 1000).toFixed(1)
    const countText = group.photos.length > 1 ? ` · ${photoIndex + 1} / ${group.photos.length}` : ''
    ctx.fillText(`${distKm} km${countText}`, w / 2, infoY)

    // Gallery dots
    if (group.photos.length > 1) {
      const dotR = Math.round(h * 0.004)
      const dotSpacing = dotR * 3
      const totalDotsW = group.photos.length * dotSpacing
      const dotsX = w / 2 - totalDotsW / 2
      const dotsY = infoY + dotR * 3
      for (let i = 0; i < group.photos.length; i++) {
        ctx.beginPath()
        ctx.arc(dotsX + i * dotSpacing, dotsY, dotR, 0, Math.PI * 2)
        ctx.fillStyle = i === photoIndex ? '#f97316' : 'rgba(0,0,0,0.3)'
        ctx.fill()
      }
    }
  }

  ctx.restore()
}
