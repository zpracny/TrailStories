export interface GPXParseResult {
  name: string
  sportType: string
  preloadedLatLngs: [number, number][]
  preloadedElevation: {
    altitude: number[]
    distance: number[]
  }
  distance: number
  movingTime: number
  elevationGain: number
  activityStartDate: string
  timestamps: string[]
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mapSportType(raw: string): string {
  const lower = raw.toLowerCase()
  if (/run|running/.test(lower)) return 'Run'
  if (/cycl|ride|biking/.test(lower)) return 'Ride'
  if (/hike|hiking|walk|walking|trek/.test(lower)) return 'Hike'
  if (/swim/.test(lower)) return 'Swim'
  if (/ski/.test(lower)) return 'Ski'
  return 'Activity'
}

function getTrkptElements(doc: Document): Element[] {
  // Try namespaced first, then plain
  let pts = Array.from(doc.getElementsByTagNameNS('http://www.topografix.com/GPX/1/1', 'trkpt'))
  if (pts.length === 0) pts = Array.from(doc.getElementsByTagName('trkpt'))
  return pts
}

function getChildText(el: Element, tagName: string): string {
  const child = el.getElementsByTagName(tagName)[0]
  return child?.textContent?.trim() || ''
}

export function parseGPX(file: File): Promise<GPXParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Chyba čtení souboru'))
    reader.onload = () => {
      try {
        const text = reader.result as string
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'application/xml')

        const parseError = doc.querySelector('parseerror')
        if (parseError) throw new Error('Neplatný GPX soubor')

        // Name
        const nameEl = doc.getElementsByTagName('name')[0]
        const name = nameEl?.textContent?.trim() || file.name.replace(/\.gpx$/i, '')

        // Sport type
        const typeEl = doc.getElementsByTagName('type')[0]
        const sportType = typeEl ? mapSportType(typeEl.textContent || '') : 'Activity'

        const trkpts = getTrkptElements(doc)
        if (trkpts.length < 2) throw new Error('GPX soubor musí obsahovat alespoň 2 trackpointy')

        const latLngs: [number, number][] = []
        const altitudes: number[] = []
        const distances: number[] = [0]
        const timestamps: string[] = []

        let totalDist = 0
        let elevGain = 0
        let prevAlt: number | null = null
        let firstTime: string | null = null
        let lastTime: string | null = null

        for (let i = 0; i < trkpts.length; i++) {
          const pt = trkpts[i]
          const lat = parseFloat(pt.getAttribute('lat') || '0')
          const lng = parseFloat(pt.getAttribute('lon') || '0')

          const eleText = getChildText(pt, 'ele')
          const alt = eleText !== '' ? parseFloat(eleText) : 0

          const timeText = getChildText(pt, 'time')
          if (timeText) {
            if (!firstTime) firstTime = timeText
            lastTime = timeText
            timestamps.push(timeText)
          }

          latLngs.push([lat, lng])
          altitudes.push(alt)

          if (i > 0) {
            const d = haversine(latLngs[i - 1][0], latLngs[i - 1][1], lat, lng)
            totalDist += d
            distances.push(totalDist)
          }

          // Elevation gain — only positive diff ≥ 1m
          if (prevAlt !== null) {
            const diff = alt - prevAlt
            if (diff >= 1) elevGain += diff
          }
          prevAlt = alt
        }

        // Moving time: total time minus pauses > 5 min
        let movingTime = 0
        if (timestamps.length >= 2) {
          const times = timestamps.map(t => new Date(t).getTime())
          for (let i = 1; i < times.length; i++) {
            const segMs = times[i] - times[i - 1]
            if (segMs < 5 * 60 * 1000) movingTime += segMs / 1000
          }
        }

        resolve({
          name,
          sportType,
          preloadedLatLngs: latLngs,
          preloadedElevation: { altitude: altitudes, distance: distances },
          distance: Math.round(totalDist),
          movingTime: Math.round(movingTime),
          elevationGain: Math.round(elevGain),
          activityStartDate: firstTime || new Date().toISOString(),
          timestamps,
        })
      } catch (e) {
        reject(e)
      }
    }
    reader.readAsText(file)
  })
}

export function validateGPXFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.gpx')) return 'Soubor musí mít příponu .gpx'
  if (file.size > 50 * 1024 * 1024) return 'Soubor je příliš velký (max 50 MB)'
  return null
}
