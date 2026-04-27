import polyline from '@mapbox/polyline'
import * as turf from '@turf/turf'

export function decodePolyline(encoded: string): [number, number][] {
  return polyline.decode(encoded)
}

export interface BBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export function getTrailBounds(latlngs: [number, number][], paddingFraction = 0.08): BBox {
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  for (const [lat, lng] of latlngs) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  const dLat = (maxLat - minLat) * paddingFraction
  const dLng = (maxLng - minLng) * paddingFraction
  return {
    minLat: minLat - dLat,
    maxLat: maxLat + dLat,
    minLng: minLng - dLng,
    maxLng: maxLng + dLng,
  }
}

// Web Mercator projection: lat/lng → normalized [0,1] Mercator coords
function latToMercY(lat: number): number {
  const sinLat = Math.sin((lat * Math.PI) / 180)
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)
}

export function projectToCanvas(
  lat: number,
  lng: number,
  bounds: BBox,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  const mercMinY = latToMercY(bounds.maxLat)
  const mercMaxY = latToMercY(bounds.minLat)

  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * canvasW
  const y = ((latToMercY(lat) - mercMinY) / (mercMaxY - mercMinY)) * canvasH

  return { x, y }
}

export function simplifyTrail(latlngs: [number, number][], tolerance = 0.0001): [number, number][] {
  if (latlngs.length < 3) return latlngs
  const line = turf.lineString(latlngs.map(([lat, lng]) => [lng, lat]))
  const simplified = turf.simplify(line, { tolerance, highQuality: false })
  return simplified.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function computeCumulativeDistances(latlngs: [number, number][]): number[] {
  const dists: number[] = [0]
  for (let i = 1; i < latlngs.length; i++) {
    const d = haversineDistance(latlngs[i - 1][0], latlngs[i - 1][1], latlngs[i][0], latlngs[i][1])
    dists.push(dists[i - 1] + d)
  }
  return dists
}

export function getPositionAtProgress(
  latlngs: [number, number][],
  cumulDists: number[],
  progress: number
): [number, number] {
  const totalDist = cumulDists[cumulDists.length - 1]
  const targetDist = progress * totalDist
  let lo = 0
  let hi = latlngs.length - 1
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (cumulDists[mid] <= targetDist) lo = mid
    else hi = mid
  }
  const segLen = cumulDists[hi] - cumulDists[lo]
  if (segLen === 0) return latlngs[lo]
  const t = (targetDist - cumulDists[lo]) / segLen
  return [
    latlngs[lo][0] + t * (latlngs[hi][0] - latlngs[lo][0]),
    latlngs[lo][1] + t * (latlngs[hi][1] - latlngs[lo][1]),
  ]
}
