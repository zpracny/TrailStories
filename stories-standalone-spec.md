# TrailMetrics Stories Generator — Standalone Spec

> Kompletní dokumentace pro extrakci Stories funkcionality do samostatné aplikace.
> Poslední aktualizace: 2026-04-27

---

## Obsah

1. [Přehled](#1-přehled)
2. [4 Režimy](#2-4-režimy)
3. [Architektura a soubory](#3-architektura-a-soubory)
4. [Vstupní data](#4-vstupní-data)
5. [Datový tok](#5-datový-tok)
6. [Supabase závislosti](#6-supabase-závislosti)
7. [NPM závislosti](#7-npm-závislosti)
8. [Export pipeline](#8-export-pipeline)
9. [Photo pause systém](#9-photo-pause-systém)
10. [Render engines — detaily](#10-render-engines--detaily)
11. [UI — design systém](#11-ui--design-systém)
12. [Standalone checklist](#12-standalone-checklist)

---

## 1. Přehled

Stories Generator vytváří **animované video stories** z GPX tras sportovních aktivit. Uživatel vybere aktivitu nebo expedici, nastaví config a exportuje WebM video (1080×1920 pro 9:16, atd.).

**Klíčové vlastnosti:**
- 4 render režimy (2D canvas / 3D WebGL / Camera Follow / Slideshow)
- Fotky jako pauzy v animaci (GPS nebo timestamp matching)
- Summit markery, km markery, day-end markery
- Export do WebM (VP9, 30fps, 8 Mbps)
- Safe zones pro Instagram/Facebook stories
- Podpora single activity i multi-day expedic

---

## 2. Čtyři Režimy

### 2D Story (`mode: '2d'`)

**Co dělá:** Canvas 2D, animace kreslení trasy, všechny overlay markery, volitelné pozadí (gradient / rastrová mapa / fotka aktivity).

**Hlavní soubor:** `components/StoryGenerator/StoryCanvas.ts`

**Vrstvy (z-order):**
1. Background (gradient paleta / map tiles / fotka)
2. Vignette (edge fade)
3. Ghost trail (celá trasa, průhledná)
4. Active trail (gradient zelená → oranžová, animovaný kreslení)
5. Start point (bílý kruh)
6. Head point (pulsující oranžový bod)
7. Km markery (animate in při průjezdu)
8. Summit markery (3-fázová animace: fade-in → label → fade-out)
9. Day-end markery (indigo kruh s textem dne)
10. Activity name + sport ikona (vlevo nahoře)
11. Elevation profile (spodek, volitelný)
12. Stats overlay (distance / time / elevation / speed)
13. Progress bar (spodek)
14. Logo (volitelný)
15. Photo pause overlay (polaroid-styl, fade-in/out)

**Config volby specifické pro 2D:**
```
backgroundType: 'gradient' | 'map' | 'photo'
gradientTheme:  'night' | 'forest' | 'sunset'
mapStyle:       'standard' | 'topo' | 'dark' | 'gray' | 'satellite'
showElevationProfile: boolean
showKmMarkers: boolean
```

**Marker chování:**
- Km markery: adaptivní interval (0.5 / 1 / 5 / 10 km), max 15 markerů, min vzdálenost na plátně 60px
- Summit markery: haversine ≤70 m od bodu trasy, max 8 na animaci, přeskočí >500 m nad trasu
- Day-end markery: 1 per kalendářní den, na souřadnici posledního bodu dne

---

### 3D Fly-over (`mode: '3d'`)

**Co dělá:** MapLibre GL (WebGL) s 3D terénem, letící kamera po trase s plynulým bearingem, HUD overlay.

**Hlavní soubory:**
- `components/StoryGenerator/Story3DEngine.ts` — hlavní engine
- `components/StoryGenerator/story3DCamera.ts` — kamera systém
- `components/StoryGenerator/story3DStyles.ts` — MapLibre style definice

**MapLibre vrstvy:**
- `raster-base-layer` — podkladová mapa (Esri / OpenTopoMap / CartoDB)
- `terrain-dem` — AWS Terrain Tiles (Terrarium encoding, ~30m přesnost)
- `hillshade-layer` — volitelné stínování kopců
- `ghost-trail-layer` — celá trasa (nízká opacity)
- `active-trail-outline` + `active-trail-layer` — animovaná trasa (outline trick pro čitelnost)
- `peaks-circles` — summit body (oranžové kroužky)

**HUD canvas (2D overlay nad WebGL):**
- Edge fades / vignette
- Activity name + sport ikona
- Stats overlay
- Progress bar
- Logo
- Summit labels (pozice z `map.project()` → screen coords)
- Day-end labels (indigo pills)
- Photo pause overlay

**Kamera (`story3DCamera.ts`):**
```
computeCameraPath(latlngs) → ~150 keyframes

Algoritmus:
1. Subsample polyline na ~150 bodů (rovnoměrně po vzdálenosti)
2. Lookahead 12% pro výpočet bearing
3. 3× smoothing pass (circular moving average, okno 15)
4. clampBearingRate() — max 8°/keyframe (zabraňuje spinning)
5. Interpolace: linear center, smoothstep bearing
6. Zoom: baseZoom + log₂(800 / altitude)
```

**Config volby specifické pro 3D:**
```
mapStyle3D:          'satellite-3d' | 'outdoor-3d' | 'dark-3d'
cameraPitch:         30–75°   (default 55°)
cameraAltitude:      200–3000 m (default 800 m)
terrainExaggeration: 0.5–3.0× (default 1.5×)
showHillshade:       boolean
```

---

### Camera Follow (`mode: 'camera-follow'`)

**Co dělá:** MapLibre s fixed overhead viewportem (N nahoře), kamera sleduje pohybující se bod po trase, živé HUD statistiky.

**Hlavní soubor:** `components/StoryGenerator/mode-camera-follow/CameraFollowEngine.ts`

**Rendering:**
- MapLibre tiles (OSM / OpenTopoMap / CartoDB / Esri)
- HUD canvas overlay (stats, elevation mini-profil)
- Pohybující se bod s pulse efektem (oranžový)
- Ghost trail (celá trasa, jemná) + Active trail (oranžová — doposud ujetá část)
- Km markery (zobrazovací, ne animované)
- Summit callouts (slide-in zleva + fade-in, 3s zobrazení)
- Stats: distance, time, elevation (spodek)
- Elevation mini-profil (32px, spodek)

**Kamera:**
- Fixed bearing 0° (sever nahoře)
- Center = aktuální pozice na trase (interpolováno)
- Viewport: `cfViewportKm` (default 25 km, range 10–50 km)
- Zoom: `calcZoomForKm(viewportKm, latitude)` — přepočet přes Mercator

**Fotky:**
- Timestamp matching (primární) → GPS haversine (fallback)
- Soft pause: rychlost klesne na 10% po dobu zobrazení fotky
- Zobrazení: 3s, fade-in 500ms, fade-out 500ms

**Config volby specifické pro Camera Follow:**
```
cfViewportKm:       10–50 km (default 25 km)
cfShowGhostTrail:   boolean  (default true)
cfDynamicSpeed:     boolean  (default true — zpomalení na výstupech)
```

---

### Slideshow (`mode: 'slideshow'`)

**Co dělá:** Fullscreen prezentace fotek aktivity s animovanými přechody, stats overlay.

**Hlavní soubor:** `components/StoryGenerator/SlideshowEngine.ts`

**Vrstvy:**
1. Černé pozadí
2. Aktuální fotka (fullscreen cover crop)
3. Přechodová vrstva (overlay pro přechod)
4. Edge fades
5. Activity name + sport ikona
6. Stats overlay (finální hodnoty)
7. Progress bar
8. Logo
9. Slide counter (`2 / 7`)

**Přechody:**
- `crossfade` (default): alpha blend
- `slide`: horizontální posun (easeInOutCubic)
- `zoom`: zoom-out aktuální + fade-in nová

**Timing:**
```
displayDuration  = durationSeconds / photoCount
crossfadeDuration = min(400ms, displayDuration / 2)
```

**Config volby specifické pro Slideshow:**
```
slideshowTransition: 'crossfade' | 'slide' | 'zoom'
```

---

## 3. Architektura a soubory

### Stromová struktura

```
components/StoryGenerator/
├── StoryGeneratorModal.tsx      ← Modal wrapper (ESC, overlay click, scroll lock)
├── StoryPreview.tsx             ← React wrapper: engine init, play/stop/export UI
├── StoryConfigPanel.tsx         ← Config UI (mode switcher, toggles, slidery)
│
├── storyTypes.ts                ← TypeScript interfaces
├── storyConstants.ts            ← Barvy, gradienty, layout, tile URLs, animace timing
├── storyPhotoUtils.ts           ← Photo pause pipeline (mapování, grouping, timeline)
│
├── StoryCanvas.ts               ← 2D engine (~1400 řádků)
├── Story3DEngine.ts             ← 3D engine (MapLibre + HUD)
├── SlideshowEngine.ts           ← Slideshow engine
├── mode-camera-follow/
│   └── CameraFollowEngine.ts   ← Camera Follow engine (MapLibre + HUD)
│
├── story3DCamera.ts             ← Camera keyframe systém (3D)
├── story3DStyles.ts             ← MapLibre style JSON definice
│
├── trailProjection.ts           ← Web Mercator projekce, polyline decode, simplifikace
└── tileLoader.ts                ← Map tile loading (jen 2D)

utils/
├── expeditionStoryUtils.ts      ← buildExpeditionStoryData() — agregace N aktivit
├── routeStoryUtils.ts           ← buildRouteStoryData() — POI markery na route
└── sportTranslations.ts         ← getSportIcon(), getSportLabel()
```

### Jak se engines inicializují (StoryPreview.tsx)

```
useEffect:
  if mode === '2d'            → new StoryCanvas(canvas, config, data)
  if mode === '3d'            → new Story3DEngine(container, config, data)
  if mode === 'camera-follow' → new CameraFollowEngine(container, config, data)
  if mode === 'slideshow'     → new SlideshowEngine(canvas, config, data)

engine.play()   → spustí animaci
engine.stop()   → zastaví
engine.export() → vrátí Promise<Blob> (WebM)
engine.destroy() → cleanup (MapLibre.remove(), cancelAnimationFrame, atd.)
```

---

## 4. Vstupní data

### StoryConfig (sdílený pro všechny režimy)

```typescript
interface StoryConfig {
  // Sdílené
  mode: '2d' | '3d' | 'camera-follow' | 'slideshow'
  aspectRatio: '9:16' | '1:1' | '16:9'     // default: '9:16'
  durationSeconds: number                   // 4–15 (2D), 3–30 (ostatní)

  // Statistiky — co zobrazit
  showDistance: boolean        // default: true
  showTime: boolean            // default: true
  showElevation: boolean       // default: true
  showSpeed: boolean           // default: false
  showSportIcon: boolean       // default: true
  showSummits: boolean         // default: true
  showDayEndMarkers: boolean   // default: true (jen expedice)
  showPOI: boolean             // default: false
  showTrailPhotos: boolean     // default: false

  // Jen 2D
  backgroundType: 'gradient' | 'map' | 'photo'
  gradientTheme: 'night' | 'forest' | 'sunset'
  mapStyle: 'standard' | 'topo' | 'dark' | 'gray' | 'satellite'
  showElevationProfile: boolean
  showKmMarkers: boolean

  // Jen 3D
  mapStyle3D: 'satellite-3d' | 'outdoor-3d' | 'dark-3d'
  cameraPitch: number            // 30–75°
  cameraAltitude: number         // 200–3000 m
  terrainExaggeration: number    // 0.5–3.0×
  showHillshade: boolean

  // Jen Camera Follow
  cfViewportKm: number           // 10–50 km
  cfShowGhostTrail: boolean
  cfDynamicSpeed: boolean

  // Jen Slideshow
  slideshowTransition: 'crossfade' | 'slide' | 'zoom'

  // Safe zones (pro IG/FB)
  enableSafeZones: boolean       // top 250px, bottom 350px (na 1920px výšce)
}
```

### ActivityStoryData (hlavní vstup pro engines)

```typescript
interface ActivityStoryData {
  // Metadata
  activityId: string
  name: string
  sportType: string              // 'Ride' | 'Hike' | 'Run' | 'Walk' | ...
  distance: number               // metry
  movingTime: number             // sekundy
  elevationGain: number          // metry
  activityStartDate?: string     // ISO 8601 (pro datum v day-end markerech)

  // Trasa
  encodedPolyline: string        // Strava/Mapbox formát (@mapbox/polyline)
  preloadedLatLngs?: [number, number][]    // alternativa k encodedPolyline (expedice)

  // Výška
  cachedElevationUrl: string | null        // URL na JSON {altitude[], distance[]}
  preloadedElevation?: {                   // alternativa (expedice)
    altitude: number[]
    distance: number[]
  }

  // Fotka pozadí (jen 2D + Slideshow)
  photoUrl: string | null

  // Markery
  peakVisits?: PeakVisitData[]       // summity
  dayEndMarkers?: DayEndMarkerData[] // konec každého dne (expedice)
  poiMarkers?: POIMarkerData[]       // custom POI

  // Fotky
  trailPhotos?: StoryPhoto[]         // GPS-tagged (→ photo pauses)
  allPhotos?: PhotoItem[]            // všechny (→ slideshow)
}

// Pomocné typy markerů
interface PeakVisitData {
  placeId: string
  placeName: string
  lat: number
  lng: number
  elevation: number
}

interface DayEndMarkerData {
  lat: number
  lng: number
  label: string              // např. "Den 1" nebo datum
  iconType: 'camp' | 'end'
  cumulativeDistance: number
}

interface StoryPhoto {
  id: string
  url: string
  lat: number | null
  lng: number | null
  takenAt: string | null     // ISO 8601
  caption?: string
}
```

---

## 5. Datový tok

### Single Activity

```
Strava Activity (uložena v DB)
  │
  ├── summary_polyline          → ActivityStoryData.encodedPolyline
  ├── elevation_streams_url     → ActivityStoryData.cachedElevationUrl
  │     └── fetch(url) → { altitude[], distance[] }
  ├── total_elevation_gain      → ActivityStoryData.elevationGain
  ├── distance                  → ActivityStoryData.distance
  ├── moving_time               → ActivityStoryData.movingTime
  ├── sport_type                → ActivityStoryData.sportType
  │
  ├── peak_visits (tabulka)     → ActivityStoryData.peakVisits
  │     WHERE activity_id = X AND is_hidden = false
  │
  ├── activity_photos (tabulka) → ActivityStoryData.trailPhotos
  │     WHERE activity_id = X AND lat IS NOT NULL
  │
  └── activity_photos (tabulka) → ActivityStoryData.allPhotos
        WHERE activity_id = X
        ↓
  StoryGeneratorModal (open)
  ↓
  StoryPreview (engine init)
  ↓
  Engine (render + export)
```

### Expedition (vícedenní)

```
expeditionStoryUtils.buildExpeditionStoryData(expedition, activities, userId)
  │
  ├── loadAndConcatenateStreams(activities)
  │     └── Promise.all(activities.map(a => fetch(a.cachedElevationUrl)))
  │         → preloadedLatLngs (spojeno), preloadedElevation (spojeno)
  │
  ├── buildDayEndMarkers(activities)
  │     → DayEndMarkerData[] (1/den, na konci každé aktivity)
  │
  ├── loadExpeditionPeaks(userId, activityIds)
  │     → supabase.from('peak_visits')
  │         .select('place_id, place_name, lat, lng, elevation, activity_id')
  │         .in('activity_id', activityIds)
  │         .eq('is_hidden', false)
  │     → deduplikace (placeId) → PeakVisitData[]
  │
  ├── loadExpeditionPhotos(activityIds)
  │     → supabase.from('activity_photos')
  │         .select('id, url, lat, lng, taken_at, activity_id, caption')
  │         .in('activity_id', activityIds)
  │         .not('lat', 'is', null)
  │     → StoryPhoto[]
  │
  └── loadExpeditionAllPhotos(activityIds)
        → supabase.from('activity_photos')
            .select('id, url, activity_id, caption')
            .in('activity_id', activityIds)
        → PhotoItem[]
        ↓
  ActivityStoryData (kompletní)
  ↓
  StoryGeneratorModal
```

### Elevation JSON (cachedElevationUrl)

URL odkazuje na Supabase Storage — veřejný soubor:

```json
{
  "altitude": [123.4, 124.1, 125.0, ...],
  "distance": [0, 5.2, 10.8, ...]
}
```

Načítání v engines:
```typescript
if (preloadedElevation) {
  // použij přímo
} else if (cachedElevationUrl) {
  const res = await fetch(cachedElevationUrl)
  const streams = await res.json()
  // streams.altitude, streams.distance
}
```

---

## 6. Supabase závislosti

### Tabulky

| Tabulka | Použití | Klíčové sloupce |
|---------|---------|-----------------|
| `peak_visits` | Summit markery | `place_id, place_name, lat, lng, elevation, activity_id, user_id, is_hidden` |
| `activity_photos` | Photo pauses + Slideshow | `id, url, lat, lng, taken_at, activity_id, caption` |
| `activities` | Metadata aktivity | `id, name, sport_type, distance, moving_time, total_elevation_gain, summary_polyline, cached_elevation_url` |

### Storage Buckety

| Bucket | Účel | Public |
|--------|------|--------|
| `streams` | `{userId}/{activityId}_elevation.json` — elevation streams JSON | Ano |
| `photos` | `strava_photos/{userId}/{activityId}.jpg` — cover fotky aktivit | Ano |

### Queries (kopírovat do standalone)

```typescript
// Peaks pro aktivitu
const { data: peaks } = await supabase
  .from('peak_visits')
  .select('place_id, place_name, lat, lng, elevation, activity_id')
  .eq('activity_id', activityId)
  .eq('is_hidden', false)

// GPS-tagged fotky (pro photo pauses)
const { data: photos } = await supabase
  .from('activity_photos')
  .select('id, url, lat, lng, taken_at, caption')
  .eq('activity_id', activityId)
  .not('lat', 'is', null)
  .not('lng', 'is', null)
  .order('taken_at', { ascending: true })

// Všechny fotky (pro slideshow)
const { data: allPhotos } = await supabase
  .from('activity_photos')
  .select('id, url, caption')
  .eq('activity_id', activityId)
  .order('taken_at', { ascending: true })
```

---

## 7. NPM závislosti

### Klíčové (nelze nahradit)

| Balíček | Verze | Účel |
|---------|-------|------|
| `maplibre-gl` | ^5.16.0 | 3D + Camera Follow WebGL rendering |
| `@mapbox/polyline` | ^1.2.1 | Decode Strava/Mapbox encoded polyline |
| `@turf/turf` | ^7.3.2 | Simplifikace trasy (redukce bodů před renderem) |

### Volitelné (lze nahradit)

| Balíček | Verze | Účel | Alternativa |
|---------|-------|------|-------------|
| `@supabase/supabase-js` | ^2.93.2 | Načtení peaks a fotek z DB | Vlastní API |
| `lucide-react` | ^0.577.0 | Sport ikony v HUD | Inline SVG |
| `framer-motion` | ^12.23.26 | Modal animace | CSS transitions |

### Tile sources (zdarma, žádný API klíč)

| Styl | URL pattern |
|------|-------------|
| Standard (OSM) | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Topo | `https://tile.opentopomap.org/{z}/{x}/{y}.png` |
| Dark | `https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png` |
| Satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/...` |
| Terrain DEM (3D) | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` |

---

## 8. Export pipeline

### Rozlišení

| Aspect ratio | Rozlišení |
|---|---|
| 9:16 (Story) | 1080 × 1920 px |
| 1:1 (Square) | 1080 × 1080 px |
| 16:9 (Landscape) | 1920 × 1080 px |

### Parametry exportu

```typescript
const EXPORT_FPS = 30
const EXPORT_BITRATE = 8_000_000  // 8 Mbps
const EXPORT_FORMAT = 'video/webm;codecs=vp9'
// Fallback: 'video/webm;codecs=vp8' → 'video/webm'
```

### Jak funguje MediaRecorder (2D + Slideshow)

```typescript
// 1. Vytvoř offscreen canvas v export rozlišení
const exportCanvas = document.createElement('canvas')
exportCanvas.width = exportWidth
exportCanvas.height = exportHeight

// 2. Zachytávej stream
const stream = exportCanvas.captureStream(0)  // 0 = manual timing
const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })

// 3. Render loop
const chunks: BlobPart[] = []
recorder.ondataavailable = e => chunks.push(e.data)
recorder.start()

// Render každý frame, pak requestFrame()
// stream.getVideoTracks()[0].requestFrame()

// 4. Po dokončení
recorder.stop()
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' })
  resolve(blob)
}
```

### Jak funguje export pro 3D + Camera Follow

```typescript
// MapLibre WebGL canvas + HUD 2D canvas se composite na offscreen canvas
// Sync přes map.once('render', () => { ... })

// 1. Render MapLibre (čekat na event)
// 2. drawImage(mapCanvas, ...) na exportCanvas
// 3. drawImage(hudCanvas, ...) na exportCanvas
// 4. requestFrame()
// 5. Opakovat pro každý frame
```

---

## 9. Photo pause systém

**Soubor:** `components/StoryGenerator/storyPhotoUtils.ts`

### Pipeline

```
trailPhotos: StoryPhoto[]
       ↓
mapPhotosToRoute(photos, latLngs)
  ├── GPS haversine: najdi nejbližší bod trasy
  │   → position: 0.0–1.0 (progress na trase)
  └── Timestamp fallback: interpoluj timestamp vůči trase

groupNearbyPhotos(mappedPhotos)
  → fotky < 2% progress od sebe = galerie (PhotoGroup)

limitPhotoGroups(groups, max=10)
  → rovnoměrně odstraní přebytečné skupiny

buildPhotoPauseTimeline(groups, totalDuration)
  → PauseTimeline: trail segment → pauza → trail segment → ...

preloadStoryPhotos(groups)
  → Promise.all( new Image().src = url ) → loadedImages Map

engine.setPhotoPauses(groups, loadedImages)
  → engine si uloží pauzy, použije při renderu
```

### Timing foto pauzy

```
Fade-in:            500ms
Zobrazení:         2000ms
Crossfade (galerie): 500ms / fotku
Fade-out:           500ms

Celková délka videa s fotkami:
  = trail animace + (počet skupin × ~3s)
```

### Render overlay (sdílený)

```typescript
drawPhotoPauseOverlay(ctx, pauseState, loadedImages, groups, w, h, layout)

// Rozložení:
// ┌─────────────────────────────────┐
// │ Overlay: rgba(0,0,0, 0.35)      │
// ├─────────────────────────────────┤
// │  ┌───────────────────────────┐  │
// │  │   FOTKA (object-cover)    │  │
// │  │   max 65% šířky canvasu   │  │
// │  └───────────────────────────┘  │
// │   Info: "2.4 km · 1 / 3"       │
// │   Gallery dots (•••)            │
// └─────────────────────────────────┘
```

---

## 10. Render engines — detaily

### trailProjection.ts

Sdílená utilita pro 2D canvas (3D a Camera Follow projekci dělá MapLibre).

```typescript
// Decode Strava polyline
decodePolyline(encoded: string): [number, number][]

// Web Mercator: lat/lng → canvas coords
projectToCanvas(latlng, bounds, canvasW, canvasH): { x, y }

// Simplifikace trasy (Ramer-Douglas-Peucker via @turf)
simplifyTrail(latlngs, tolerance): [number, number][]

// Bounding box s paddingem
getTrailBounds(latlngs, paddingFraction): BBox
```

### tileLoader.ts (jen 2D)

```typescript
// Načte a cachuje OSM tile jako HTMLImageElement
loadTile(z, x, y, styleUrl): Promise<HTMLImageElement>

// Vypočte potřebné tiles pro viewport
getTilesForBounds(bounds, zoom): TileCoord[]

// Vykreslí tile grid na canvas
renderTiles(ctx, tiles, bounds, canvasW, canvasH)
```

### storyConstants.ts — klíčové hodnoty

```typescript
// Gradienty pozadí (2D)
GRADIENT_THEMES = {
  night:  ['#0a0a0f', '#1a1a2e', '#16213e'],
  forest: ['#0d1f0d', '#1a3d1a', '#2d5a27'],
  sunset: ['#1a0a0a', '#3d1a0d', '#5a2d0a'],
}

// Barva aktivní trasy
TRAIL_COLOR_START = '#22c55e'   // zelená
TRAIL_COLOR_END   = '#f97316'   // oranžová

// Barva summit markerů
SUMMIT_COLOR = '#f97316'

// Barva day-end markerů
DAY_END_COLOR = '#6366f1'       // indigo

// Stats font
STATS_FONT = 'Inter, system-ui, sans-serif'

// Logo (volitelný watermark)
LOGO_TEXT = 'TrailMetrics'
```

---

## 11. UI — design systém

### Barvy modalu

```css
--bg:       #0E0E10   /* outer overlay */
--panel:    #1E1E24   /* modal pozadí */
--card:     #26262E   /* karty, inputy */
--border:   #32323C   /* linky, separátory */
--orange:   #F97316   /* primary action, accenty */
--glow:     rgba(249,115,22, 0.15)  /* orange glow */
--text:     #F0F0F4   /* hlavní text */
--muted:    #8A8A96   /* sekundární text */
```

### Komponenty

**StoryGeneratorModal.tsx**
- Framer Motion `AnimatePresence` + `motion.div` pro slide-up
- Scroll lock (`document.body.style.overflow = 'hidden'`)
- Close: ESC key + overlay click + X button
- Dvě hlavní sekce: Preview vlevo, Config vpravo (desktop) / tabs (mobile)

**StoryConfigPanel.tsx**
- Mode switcher: 4 chips (`2D / 3D / Kamera / Slideshow`)
- Aspect ratio: 3 karty s ikonami (9:16 / 1:1 / 16:9)
- Toggles: Tailwind `peer` trick (hidden checkbox → label styling)
- Slidery: `<input type="range">` s živým preview hodnotou
- Conditional sections: zobrazovat pouze relevantní volby pro zvolený mode

**StoryPreview.tsx**
- `<canvas>` pro 2D + Slideshow
- `<div ref={mapContainer}>` pro 3D + Camera Follow
- Overlay tlačítka: Play/Pause, Export
- Export progress bar (procentuální z frames)
- Při exportu: zakáže config panel

### Rozložení modalu (desktop)

```
┌────────────────────────────────────────────────────────┐
│ Header: "Sdílet jako Story"                     [✕]    │
├───────────────────────────┬────────────────────────────┤
│ Preview                   │ Config (scrollable)        │
│ (aspect ratio maintained) │ ─────────────────────────  │
│                           │ Режim chips               │
│  [canvas / maplibre]      │ Poměr stran cards         │
│                           │ ─────────────────────────  │
│  ▶ Play    ⬇ Export       │ Pozadí, styl mapy         │
│                           │ Délka videa slider        │
│                           │ ─────────────────────────  │
│                           │ Statistiky toggles        │
│                           │ Vrstvy toggles            │
└───────────────────────────┴────────────────────────────┘
```

---

## 12. Standalone checklist

### Soubory ke zkopírování

```
# Core engines
components/StoryGenerator/
├── StoryGeneratorModal.tsx
├── StoryPreview.tsx
├── StoryConfigPanel.tsx
├── StoryCanvas.ts
├── Story3DEngine.ts
├── SlideshowEngine.ts
├── mode-camera-follow/CameraFollowEngine.ts
├── storyTypes.ts
├── storyConstants.ts
├── storyPhotoUtils.ts
├── story3DCamera.ts
├── story3DStyles.ts
├── trailProjection.ts
└── tileLoader.ts

# Data utilities
utils/expeditionStoryUtils.ts
utils/routeStoryUtils.ts
utils/sportTranslations.ts
```

### NPM install

```bash
npm install maplibre-gl @mapbox/polyline @turf/turf
npm install @supabase/supabase-js  # pokud používáš Supabase
npm install lucide-react framer-motion  # volitelné
```

### Minimální vstup (standalone bez DB)

Pokud nechceš Supabase, stačí sestavit `ActivityStoryData` ručně:

```typescript
const data: ActivityStoryData = {
  activityId: '123',
  name: 'Výstup na Sněžku',
  sportType: 'Hike',
  distance: 14500,           // metry
  movingTime: 5400,          // sekundy
  elevationGain: 840,        // metry

  // Trasa — Strava encoded polyline
  encodedPolyline: 'yzyaH...',

  // NEBO přímé souřadnice:
  preloadedLatLngs: [[50.736, 15.741], [50.737, 15.742], ...],

  // NEBO URL na elevation JSON:
  cachedElevationUrl: 'https://.../elevation.json',

  photoUrl: null,            // URL cover fotky (volitelné)
  peakVisits: [],            // volitelné
  trailPhotos: [],           // volitelné
  allPhotos: [],             // volitelné (slideshow)
}
```

### Inicializace (React)

```tsx
import { StoryGeneratorModal } from './StoryGenerator/StoryGeneratorModal'

// V komponentě:
const [showStory, setShowStory] = useState(false)
const [storyData, setStoryData] = useState<ActivityStoryData | null>(null)

// Otevření:
<button onClick={() => { setStoryData(buildData(activity)); setShowStory(true) }}>
  Sdílet jako Story
</button>

// Modal:
{showStory && storyData && (
  <StoryGeneratorModal
    data={storyData}
    onClose={() => setShowStory(false)}
  />
)}
```

### Co NENÍ potřeba pro standalone

- ❌ Strava OAuth (data lze načíst libovolně)
- ❌ Next.js App Router (funguje v jakémkoliv React projektu)
- ❌ Supabase (peaks a fotky lze předat přímo v `ActivityStoryData`)
- ❌ Edge Functions / cron joby
- ❌ Google Gemini / AI chat

### Co je potřeba vždy

- ✅ React 18+ (hooks, useRef, useEffect)
- ✅ Canvas API (OffscreenCanvas nebo `<canvas>`)
- ✅ MediaRecorder API (export) — Chrome/Edge/Firefox, iOS Safari NE
- ✅ WebGL (3D + Camera Follow) — standardní browser podpora
- ✅ `maplibre-gl` (3D + Camera Follow)
- ✅ Internetové připojení (tile loading při renderování)

### Known limitations

| Omezení | Popis |
|---------|-------|
| iOS Safari | MediaRecorder nepodporuje WebM — export nefunguje |
| Offline | Tile loading vyžaduje internet; lze přidat tile cache přes Service Worker |
| Paměť | 3D render při long expeditions (1000+ km) může být náročný; simplifikace trasy povinná |
| Exifové souřadnice | `storyPhotoUtils.ts` neparsuje EXIF — souřadnice musí být v DB/předány přímo |

---

*Generováno z TrailMetrics codebase, 2026-04-27*
