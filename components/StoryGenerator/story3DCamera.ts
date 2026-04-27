import { CAMERA_KEYFRAMES, CAMERA_LOOKAHEAD, CAMERA_SMOOTH_WIN, CAMERA_MAX_BEARING_RATE } from './storyConstants'

export interface CameraKeyframe {
  lat: number
  lng: number
  bearing: number
  zoom: number
  pitch: number
}

function subsample(latlngs: [number, number][], count: number): [number, number][] {
  if (latlngs.length <= count) return latlngs
  const result: [number, number][] = []
  const step = (latlngs.length - 1) / (count - 1)
  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.round(i * step), latlngs.length - 1)
    result.push(latlngs[idx])
  }
  return result
}

function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function circularMean(angles: number[]): number {
  let sinSum = 0, cosSum = 0
  for (const a of angles) {
    sinSum += Math.sin((a * Math.PI) / 180)
    cosSum += Math.cos((a * Math.PI) / 180)
  }
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360
}

function smoothBearings(bearings: number[], windowSize: number): number[] {
  const half = Math.floor(windowSize / 2)
  return bearings.map((_, i) => {
    const slice = bearings.slice(Math.max(0, i - half), Math.min(bearings.length, i + half + 1))
    return circularMean(slice)
  })
}

function clampBearingRate(bearings: number[], maxRate: number): number[] {
  const clamped = [bearings[0]]
  for (let i = 1; i < bearings.length; i++) {
    const prev = clamped[i - 1]
    let diff = bearings[i] - prev
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    const clampedDiff = Math.max(-maxRate, Math.min(maxRate, diff))
    clamped.push((prev + clampedDiff + 360) % 360)
  }
  return clamped
}

export function computeCameraPath(
  latlngs: [number, number][],
  baseZoom: number,
  altitude: number,
  pitch: number
): CameraKeyframe[] {
  const pts = subsample(latlngs, CAMERA_KEYFRAMES)
  const n = pts.length

  // Compute raw bearings using lookahead
  const rawBearings = pts.map((pt, i) => {
    const lookaheadIdx = Math.min(n - 1, Math.round(i + n * CAMERA_LOOKAHEAD))
    if (lookaheadIdx === i) return i > 0 ? bearingBetween(pts[i - 1][0], pts[i - 1][1], pt[0], pt[1]) : 0
    return bearingBetween(pt[0], pt[1], pts[lookaheadIdx][0], pts[lookaheadIdx][1])
  })

  // 3× smoothing passes
  let smoothed = rawBearings
  for (let pass = 0; pass < 3; pass++) {
    smoothed = smoothBearings(smoothed, CAMERA_SMOOTH_WIN)
  }

  const bearings = clampBearingRate(smoothed, CAMERA_MAX_BEARING_RATE)

  // Zoom based on altitude (log2 adjustment)
  const zoom = baseZoom + Math.log2(800 / altitude)

  return pts.map((pt, i) => ({
    lat: pt[0],
    lng: pt[1],
    bearing: bearings[i],
    zoom,
    pitch,
  }))
}

export function interpolateCamera(frames: CameraKeyframe[], progress: number): CameraKeyframe {
  if (frames.length === 0) return { lat: 0, lng: 0, bearing: 0, zoom: 12, pitch: 55 }
  if (frames.length === 1) return frames[0]

  const t = Math.max(0, Math.min(1, progress)) * (frames.length - 1)
  const i = Math.floor(t)
  const frac = t - i

  if (i >= frames.length - 1) return frames[frames.length - 1]

  const a = frames[i]
  const b = frames[i + 1]

  // Smoothstep bearing interpolation
  const ss = frac * frac * (3 - 2 * frac)
  let bearingDiff = b.bearing - a.bearing
  if (bearingDiff > 180) bearingDiff -= 360
  if (bearingDiff < -180) bearingDiff += 360

  return {
    lat: a.lat + frac * (b.lat - a.lat),
    lng: a.lng + frac * (b.lng - a.lng),
    bearing: (a.bearing + ss * bearingDiff + 360) % 360,
    zoom: a.zoom + frac * (b.zoom - a.zoom),
    pitch: a.pitch + frac * (b.pitch - a.pitch),
  }
}
