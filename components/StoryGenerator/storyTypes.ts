export interface StoryConfig {
  mode: '2d' | '3d' | 'camera-follow' | 'slideshow'
  aspectRatio: '9:16' | '1:1' | '16:9'
  durationSeconds: number

  showDistance: boolean
  showTime: boolean
  showElevation: boolean
  showSpeed: boolean
  showSportIcon: boolean
  showSummits: boolean
  showDayEndMarkers: boolean
  showPOI: boolean
  showTrailPhotos: boolean

  // 2D only
  backgroundType: 'gradient' | 'map' | 'photo'
  gradientTheme: 'night' | 'forest' | 'sunset'
  mapStyle: 'standard' | 'topo' | 'dark' | 'gray' | 'satellite'
  showElevationProfile: boolean
  showKmMarkers: boolean

  // 3D only
  mapStyle3D: 'satellite-3d' | 'outdoor-3d' | 'dark-3d'
  cameraPitch: number
  cameraAltitude: number
  terrainExaggeration: number
  showHillshade: boolean

  // Camera Follow only
  cfViewportKm: number
  cfShowGhostTrail: boolean
  cfDynamicSpeed: boolean

  // Slideshow only
  slideshowTransition: 'crossfade' | 'slide' | 'zoom'

  enableSafeZones: boolean
  showLogo: boolean
}

export interface PeakVisitData {
  placeId: string
  placeName: string
  lat: number
  lng: number
  elevation: number
}

export interface DayEndMarkerData {
  lat: number
  lng: number
  label: string
  iconType: 'camp' | 'end'
  cumulativeDistance: number
}

export interface POIMarkerData {
  id: string
  name: string
  lat: number
  lng: number
}

export interface StoryPhoto {
  id: string
  url: string
  lat: number | null
  lng: number | null
  takenAt: string | null
  caption?: string
}

export interface PhotoItem {
  id: string
  url: string
  caption?: string
}

export interface ActivityStoryData {
  activityId: string
  name: string
  sportType: string
  distance: number
  movingTime: number
  elevationGain: number
  activityStartDate?: string

  encodedPolyline: string | null
  preloadedLatLngs?: [number, number][]

  cachedElevationUrl: string | null
  preloadedElevation?: {
    altitude: number[]
    distance: number[]
  }

  photoUrl: string | null

  peakVisits?: PeakVisitData[]
  dayEndMarkers?: DayEndMarkerData[]
  poiMarkers?: POIMarkerData[]

  trailPhotos?: StoryPhoto[]
  allPhotos?: PhotoItem[]
}

export interface PhotoGroup {
  id: string
  photos: StoryPhoto[]
  position: number
  trailDistanceM: number
}

export interface MappedPhoto {
  photo: StoryPhoto
  position: number
  trailDistanceM: number
}

export interface PauseSegment {
  type: 'trail' | 'pause'
  startProgress: number
  endProgress: number
  group?: PhotoGroup
}

export interface PauseTimeline {
  segments: PauseSegment[]
  totalDuration: number
}

export interface PhotoPauseState {
  active: boolean
  group: PhotoGroup | null
  photoIndex: number
  phase: 'fade-in' | 'show' | 'crossfade' | 'fade-out'
  phaseProgress: number
  alpha: number
}

export interface EngineExportOptions {
  onProgress?: (progress: number) => void
}

export interface IStoryEngine {
  play(): void
  stop(): void
  export(options?: EngineExportOptions): Promise<Blob>
  destroy(): void
  setPhotoPauses?(groups: PhotoGroup[], loadedImages: Map<string, HTMLImageElement>): void
}

export type CanvasDimensions = {
  width: number
  height: number
}

export const ASPECT_DIMENSIONS: Record<StoryConfig['aspectRatio'], CanvasDimensions> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
}
