import { BBox } from './trailProjection'
import { TILE_URLS } from './storyConstants'

export interface TileCoord {
  z: number
  x: number
  y: number
}

const tileCache = new Map<string, HTMLImageElement>()

function lng2tile(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z))
}

function lat2tile(lat: number, z: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z)
  )
}

function tile2lng(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export function getTilesForBounds(bounds: BBox, zoom: number): TileCoord[] {
  const minX = lng2tile(bounds.minLng, zoom)
  const maxX = lng2tile(bounds.maxLng, zoom)
  const minY = lat2tile(bounds.maxLat, zoom)
  const maxY = lat2tile(bounds.minLat, zoom)

  const tiles: TileCoord[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      tiles.push({ z: zoom, x, y })
    }
  }
  return tiles
}

export function chooseTileZoom(bounds: BBox, canvasW: number): number {
  const lngSpan = bounds.maxLng - bounds.minLng
  for (let z = 14; z >= 5; z--) {
    const tilesWide = (lngSpan / 360) * Math.pow(2, z)
    if (tilesWide * 256 <= canvasW * 2) return z
  }
  return 5
}

export function loadTile(z: number, x: number, y: number, style: string): Promise<HTMLImageElement> {
  const urlTemplate = TILE_URLS[style] || TILE_URLS.standard
  const url = urlTemplate.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
    .replace('{s}', 'a')
  const key = url

  if (tileCache.has(key)) return Promise.resolve(tileCache.get(key)!)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      tileCache.set(key, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
}

export function renderTiles(
  ctx: CanvasRenderingContext2D,
  tiles: TileCoord[],
  loadedTiles: Map<string, HTMLImageElement>,
  bounds: BBox,
  canvasW: number,
  canvasH: number,
  zoom: number
): void {
  const lngSpan = bounds.maxLng - bounds.minLng
  const latSpan = bounds.maxLat - bounds.minLat

  for (const { z, x, y } of tiles) {
    const key = `${z}/${x}/${y}`
    const img = loadedTiles.get(key)
    if (!img) continue

    const tileLng0 = tile2lng(x, z)
    const tileLng1 = tile2lng(x + 1, z)
    const tileLat0 = tile2lat(y, z)
    const tileLat1 = tile2lat(y + 1, z)

    const px = ((tileLng0 - bounds.minLng) / lngSpan) * canvasW
    const py = ((bounds.maxLat - tileLat0) / latSpan) * canvasH
    const pw = ((tileLng1 - tileLng0) / lngSpan) * canvasW
    const ph = ((tileLat0 - tileLat1) / latSpan) * canvasH

    ctx.drawImage(img, px, py, pw, ph)
  }
}

export async function loadAllTiles(
  tiles: TileCoord[],
  style: string
): Promise<Map<string, HTMLImageElement>> {
  const results = new Map<string, HTMLImageElement>()
  await Promise.allSettled(
    tiles.map(async ({ z, x, y }) => {
      try {
        const img = await loadTile(z, x, y, style)
        results.set(`${z}/${x}/${y}`, img)
      } catch {
        // tile failed to load — skip silently
      }
    })
  )
  return results
}
