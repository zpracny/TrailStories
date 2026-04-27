import { StoryPhoto, PhotoItem } from '@/components/StoryGenerator/storyTypes'
import { GPXParseResult } from './gpxParser'

function interpolateLatLng(
  timestamps: string[],
  latlngs: [number, number][],
  targetTime: Date
): [number, number] | null {
  if (timestamps.length === 0 || latlngs.length === 0) return null

  const targetMs = targetTime.getTime()
  const times = timestamps.map(t => new Date(t).getTime())

  // Before track start or after end
  if (targetMs <= times[0]) return latlngs[0]
  if (targetMs >= times[times.length - 1]) return latlngs[latlngs.length - 1]

  let lo = 0, hi = times.length - 1
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (times[mid] <= targetMs) lo = mid
    else hi = mid
  }

  const t = (targetMs - times[lo]) / (times[hi] - times[lo])
  return [
    latlngs[lo][0] + t * (latlngs[hi][0] - latlngs[lo][0]),
    latlngs[lo][1] + t * (latlngs[hi][1] - latlngs[lo][1]),
  ]
}

async function readExifTimestamp(file: File): Promise<Date | null> {
  try {
    const { default: exifr } = await import('exifr')
    const tags = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'DateTime'])
    const dt = tags?.DateTimeOriginal || tags?.CreateDate || tags?.DateTime
    if (dt instanceof Date) return dt
    if (typeof dt === 'string') return new Date(dt)
  } catch { /* EXIF not available */ }
  return null
}

export async function matchPhotosToGPX(
  files: File[],
  gpx: GPXParseResult
): Promise<{ trailPhotos: StoryPhoto[]; allPhotos: PhotoItem[] }> {
  const trailPhotos: StoryPhoto[] = []
  const allPhotos: PhotoItem[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const url = URL.createObjectURL(file)
    const id = `photo-${i}-${file.name}`

    allPhotos.push({ id, url })

    // Try EXIF timestamp
    const exifDate = await readExifTimestamp(file)
    let lat: number | null = null
    let lng: number | null = null
    let takenAt: string | null = null

    if (exifDate && gpx.timestamps.length > 0) {
      const pos = interpolateLatLng(gpx.timestamps, gpx.preloadedLatLngs, exifDate)
      if (pos) {
        lat = pos[0]
        lng = pos[1]
        takenAt = exifDate.toISOString()
      }
    }

    // Fallback: spread evenly along the route
    if (lat === null && gpx.preloadedLatLngs.length > 0) {
      const progress = i / Math.max(1, files.length - 1)
      const idx = Math.round(progress * (gpx.preloadedLatLngs.length - 1))
      lat = gpx.preloadedLatLngs[idx][0]
      lng = gpx.preloadedLatLngs[idx][1]
    }

    trailPhotos.push({ id, url, lat, lng, takenAt })
  }

  return { trailPhotos, allPhotos }
}
