# TrailStories — Claude Code Spec

> Standalone aplikace pro generování animovaných video stories z GPX tras.
> Verze: 1.0 · Datum: 2026-04-27

---

## Kontext

TrailStories je extrakce Stories Generatoru z TrailMetrics do samostatné veřejné aplikace.
Uživatel nahraje GPX soubor (+ volitelně fotky), nakonfiguruje vizuální styl a exportuje WebM video.

**Tech stack:** Next.js (App Router) · React 18 · TypeScript · Tailwind CSS · Vercel free tier  
**Žádný backend, žádná DB, žádná autentizace** — čistě klientská aplikace.

---

## Struktura projektu

```
trailstories/
├── app/
│   ├── page.tsx                  ← Landing page (upload)
│   ├── studio/page.tsx           ← Studio (konfigurace + preview)
│   └── layout.tsx                ← Root layout, fonty, metadata
│
├── components/
│   ├── LandingUpload.tsx         ← GPX + foto upload zóna
│   ├── Studio.tsx                ← Hlavní studio layout
│   ├── StudioTopbar.tsx          ← Topbar s názvem souboru a Export tlačítkem
│   ├── StudioActivityBar.tsx     ← Pruh se stats z GPX
│   ├── StudioPreview.tsx         ← Canvas/MapLibre preview + controls
│   ├── StudioConfigPanel.tsx     ← Pravý konfigurační panel
│   └── ExportProgress.tsx        ← Overlay při exportu
│
├── lib/
│   ├── gpxParser.ts              ← NOVÉ: GPX → ActivityStoryData
│   ├── activityBuilder.ts        ← NOVÉ: sestavení ActivityStoryData z GPX
│   └── photoMatcher.ts           ← NOVÉ: párování fotek s trasou (timestamp/GPS)
│
├── components/StoryGenerator/    ← ZKOPÍROVÁNO Z TRAILMETRICS (beze změny)
│   ├── StoryPreview.tsx
│   ├── StoryCanvas.ts
│   ├── Story3DEngine.ts
│   ├── SlideshowEngine.ts
│   ├── mode-camera-follow/CameraFollowEngine.ts
│   ├── storyTypes.ts
│   ├── storyConstants.ts         ← upravit LOGO_TEXT (viz níže)
│   ├── storyPhotoUtils.ts
│   ├── story3DCamera.ts
│   ├── story3DStyles.ts
│   ├── trailProjection.ts
│   └── tileLoader.ts
│
└── public/
    └── favicon.svg
```

---

## 1. GPX Parser (`lib/gpxParser.ts`)

Parsuje `.gpx` soubor a vrací strukturovaná data pro `ActivityStoryData`.

```typescript
interface GPXParseResult {
  name: string                        // z <name> tagu nebo název souboru
  sportType: string                   // z <type> nebo 'Activity'
  preloadedLatLngs: [number, number][] // [lat, lng] ze všech <trkpt>
  preloadedElevation: {
    altitude: number[]                // ele hodnoty
    distance: number[]                // kumulativní vzdálenost v metrech
  }
  distance: number                    // celková vzdálenost v metrech (haversine)
  movingTime: number                  // sekund (time diff, ignorovat pauzy > 5 min)
  elevationGain: number               // součet kladných výškových rozdílů
  activityStartDate: string           // ISO 8601 z prvního <time> tagu
  timestamps: string[]                // ISO 8601 pro každý trkpt (pro foto matching)
}

function parseGPX(file: File): Promise<GPXParseResult>
```

**Implementační detaily:**
- Použít `DOMParser` (browser-native, žádný npm balíček)
- Namespace handling: `gpx:trkpt` i `trkpt` (různé GPX exportery)
- Pokud chybí `<ele>`, nastavit altitude na 0
- Pokud chybí `<time>`, movingTime = 0
- Haversine pro výpočet vzdálenosti
- Elevační gain: jen kladné diff ≥ 1 m (filtrovat GPS šum)
- `sportType` mapování: `running/run` → `Run`, `cycling/ride` → `Ride`, `hiking/hike/walk` → `Hike`, default → `Activity`

---

## 2. Activity Builder (`lib/activityBuilder.ts`)

```typescript
function buildActivityStoryData(
  gpx: GPXParseResult,
  photos: StoryPhoto[]   // prázdné pole pokud žádné fotky
): ActivityStoryData
```

Sestaví `ActivityStoryData` interface (definovaný v `StoryGenerator/storyTypes.ts`) z GPX výsledku.

- `activityId`: `crypto.randomUUID()`
- `encodedPolyline`: null (používáme `preloadedLatLngs`)
- `cachedElevationUrl`: null (používáme `preloadedElevation`)
- `peakVisits`: `[]` (v první verzi nepodporováno)
- `photoUrl`: první foto URL pokud existuje, jinak null
- `trailPhotos`: výstup z `photoMatcher.ts`
- `allPhotos`: všechny fotky (pro slideshow)

---

## 3. Photo Matcher (`lib/photoMatcher.ts`)

```typescript
function matchPhotosToGPX(
  files: File[],
  gpx: GPXParseResult
): Promise<StoryPhoto[]>
```

**Pipeline:**
1. Načíst každý soubor jako `<img>` pro URL
2. Pokusit se číst EXIF timestamp z JPEG (použít `exifr` balíček — `npm install exifr`)
3. Pokud EXIF timestamp existuje: párovat s `gpx.timestamps` → interpolovat lat/lng
4. Pokud ne: přiřadit rovnoměrně po trase (position = index / count)
5. Vrátit `StoryPhoto[]` se `url` (ObjectURL), `lat`, `lng`, `takenAt`

---

## 4. Landing Page (`app/page.tsx` + `components/LandingUpload.tsx`)

### Design

Tmavé pozadí `#080810`, topografická mřížka jako CSS background, siluety hor jako SVG.

**Barvy:**
```css
--bg: #080810
--panel: #0e0e18
--card: #111118
--border: #1e1e28
--orange: #f97316
--orange-glow: rgba(249,115,22,0.08)
--text: #f0f0f4
--muted: #6a6a7a
--subtle: #3a3a4a
```

**Typografie:** `Barlow Condensed` (700/800, headlines) + `Barlow` (300/400/500, body)  
Google Fonts import v `layout.tsx`.

### Layout landing page

```
┌─────────────────────────────────┐
│  Nav: logo TrailStories + Beta  │
├─────────────────────────────────┤
│  Eyebrow: "Your adventure,      │
│           animated"             │
│                                 │
│  H1 (Barlow Condensed 800):     │
│  "Turn your                     │
│   GPX into                      │
│   a story"  ← "GPX into" oranž │
│                                 │
│  Subtext (Barlow 300)           │
│                                 │
│  Mode pills: 2D · 3D · Kamera  │
│             · Slideshow         │
├─────────────────────────────────┤
│  Upload zóna (dashed border)    │
│  Ikona + "Přetáhni GPX sem"     │
│  ".gpx · max 50 MB"             │
│  [Vybrat soubor]                │
├─────────────────────────────────┤
│  "+ Přidat fotky" (volitelné)   │
├─────────────────────────────────┤
│  Feature strip (3 sloupce):     │
│  Export · Formáty · Zdarma      │
└─────────────────────────────────┘
```

### Upload flow

```
1. Uživatel přetáhne nebo vybere .gpx soubor
2. parseGPX(file) → GPXParseResult
3. Volitelně: přidat fotky → matchPhotosToGPX()
4. buildActivityStoryData() → ActivityStoryData
5. Uložit do sessionStorage jako JSON
6. router.push('/studio')
```

Validace: pouze `.gpx` přípona, max 50 MB, min 2 trackpointy.  
Chybové stavy: "Neplatný GPX soubor", "Soubor je příliš velký", zobrazit inline pod upload zónou.

---

## 5. Studio Page (`app/studio/page.tsx`)

Při načtení: číst `ActivityStoryData` ze `sessionStorage`. Pokud chybí → redirect na `/`.

### Layout

```
┌────────────────────────────────────────────────────┐
│ Topbar                                             │
│ ← Zpět | název.gpx  14.5 km · 840 m  [Fullscreen] │
│                                      [Exportovat]  │
├────────────────────────────────────────────────────┤
│ Activity bar                                       │
│ 14.5 km | 840 m | 4:32 h | Hike | 4 fotky        │
├───────────────────────┬────────────────────────────┤
│                       │ Config panel (252px)       │
│  Preview              │                            │
│  (canvas/maplibre)    │  Sekce — viz níže          │
│                       │                            │
│  [←] [▶] [⏸]        │                            │
│  [9:16] [1:1] [16:9] │                            │
│                       │                            │
└───────────────────────┴────────────────────────────┘
```

---

## 6. Config Panel (`components/StudioConfigPanel.tsx`)

### Sekce 1 — Režim

4 karty (2×2 grid) se SVG ikonami. Klik = přepnutí módu.

```
[🗺 2D Story]   [🏔 3D Fly-over]
[📍 Kamera]     [🖼 Slideshow]
```

Aktivní karta: `border: 1px solid rgba(249,115,22,0.45)` + `background: rgba(249,115,22,0.06)`.

### Sekce 2 — Styl mapy / Pozadí

**2D mód:**
- Segmented control: `Gradient | Mapa | Fotka`
- Pokud Gradient: druhý segmented control `Night | Forest | Sunset`
- Pokud Mapa: `Standard | Topo | Dark | Gray | Satellite`

**3D mód:**
- Segmented control: `Satellite | Outdoor | Dark`

**Camera Follow mód:**
- Segmented control: `OSM | Topo | Dark | Esri`

**Slideshow mód:**
- Segmented control: `Crossfade | Slide | Zoom` (přechody)

### Sekce 3 — Délka videa

Slider s live hodnotou. Range dle módu:
- 2D: 4–15 s
- ostatní: 3–30 s

### Sekce 4 — Kondicionální parametry (závisí na módu)

Zobrazit pouze pokud je aktivní příslušný mód. Vizuálně oddělená sekcí s jemným oranžovým rámečkem a labelem "3D parametry" / "Viewport".

**Pouze 3D mód:**
```
[Náklon (pitch)]     slider 30–75°  default 55°
[Výška (altitude)]   slider 200–3000 m  default 800 m
[Terén (exagg.)]     slider 0.5–3.0×  default 1.5×
```

**Pouze Camera Follow mód:**
```
[Zobrazená oblast]   slider 10–50 km  default 25 km
                     hint: "detail ←→ přehled"
```

### Sekce 5 — Vrstvy (pill tagy)

Aktivní tag: oranžová tečka + světlý text + oranžový border.

**2D mód:** `Elevační profil` · `Km markery` · `Foto pauzy`* · `Safe zones` · `Logo`  
**3D mód:** `Hillshade` · `Foto pauzy`* · `Safe zones` · `Logo`  
**Camera Follow:** `Ghost trail` · `Km markery` · `Foto pauzy`* · `Safe zones` · `Logo`  
**Slideshow:** `Safe zones` · `Logo`

*Zobrazit tag "Foto pauzy" jen pokud byly nahrány fotky.

### Sekce 6 — Statistiky v HUD (pill tagy)

`Vzdálenost` · `Čas` · `Převýšení` · `Rychlost` · `Sport ikona`

Slideshow mód: tuto sekci skrýt (slideshow nemá live HUD).

---

## 7. Preview (`components/StudioPreview.tsx`)

Wrapper nad existujícím `StoryGenerator/StoryPreview.tsx`.

- Při změně módu nebo konfigurace: `engine.destroy()` + reinit
- Aspect ratio: přepočítat rozměry canvasu / map containeru
- Play/Pause/Restart tlačítka volají `engine.play()`, `engine.stop()`
- Fullscreen: `element.requestFullscreen()`

---

## 8. Export (`components/ExportProgress.tsx`)

Při kliknutí na "Exportovat":
1. Overlay zakryje celé studio
2. Progress bar (0–100 %) z `engine.export(onProgress)`
3. Po dokončení: `URL.createObjectURL(blob)` → automatický download `trailstory.webm`
4. Overlay zmizí

Pokud `MediaRecorder` nepodporuje WebM (iOS Safari): zobrazit inline warning "Export není na iOS Safari podporován. Použijte Chrome nebo Firefox."

---

## 9. Změny v zkopírovaných souborech

### `storyConstants.ts`
```typescript
// ZMĚNIT:
LOGO_TEXT = 'TrailStories'   // bylo: 'TrailMetrics'
```

### `storyTypes.ts`
Beze změny.

### Všechny ostatní StoryGenerator soubory
**Beze změny.** Neupravovat engines.

---

## 10. NPM závislosti

```bash
npm install maplibre-gl @mapbox/polyline @turf/turf exifr
npm install lucide-react framer-motion
```

`exifr` — čtení EXIF dat z JPEG (timestamp pro photo matching).  
`@supabase/supabase-js` — **NEPOTŘEBA**.

---

## 11. Co NEMĚNIT

- ❌ Žádné změny v `components/StoryGenerator/` (kromě `storyConstants.ts`)
- ❌ Žádný backend, žádné API routes
- ❌ Žádná autentizace
- ❌ Žádný Supabase
- ❌ Žádné expedice / multi-GPX (v1)
- ❌ Žádné summity / peak_visits (v1)

---

## 12. SEO & Metadata (`app/layout.tsx`)

```typescript
export const metadata = {
  title: 'TrailStories — Animuj svou trasu',
  description: 'Nahraj GPX a vytvoř animované video story ze své aktivity. 4 vizuální módy, export 1080p.',
  openGraph: {
    title: 'TrailStories',
    description: 'GPX → animované story video',
    // og:image: statický preview obrázek
  }
}
```

---

## 13. Checklist implementace

```
[ ] Next.js projekt init (App Router, TypeScript, Tailwind)
[ ] Fonty: Barlow + Barlow Condensed (Google Fonts v layout.tsx)
[ ] Zkopírovat StoryGenerator/* z TrailMetrics
[ ] Upravit storyConstants.ts (LOGO_TEXT)
[ ] lib/gpxParser.ts
[ ] lib/activityBuilder.ts
[ ] lib/photoMatcher.ts
[ ] app/page.tsx — landing + LandingUpload.tsx
[ ] app/studio/page.tsx — Studio.tsx + subkomponenty
[ ] StudioConfigPanel.tsx — všechny sekce včetně kondicionálních
[ ] StudioPreview.tsx — wrapper nad StoryPreview
[ ] ExportProgress.tsx
[ ] Testovat: GPX upload, všechny 4 módy, export WebM
[ ] Deploy na Vercel
```

---

*Tento spec navazuje na `stories-standalone-spec.md` (technická dokumentace engines).*  
*Engines se nekopírují s úpravami — slouží jako black-box s rozhraním `play/stop/export/destroy`.*
