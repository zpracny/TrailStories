export const LOGO_TEXT = 'TrailStories'

export function formatActivityDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

export const GRADIENT_THEMES: Record<string, string[]> = {
  night:  ['#0a0a0f', '#1a1a2e', '#16213e'],
  forest: ['#0d1f0d', '#1a3d1a', '#2d5a27'],
  sunset: ['#1a0a0a', '#3d1a0d', '#5a2d0a'],
}

export const TRAIL_COLOR_START = '#22c55e'
export const TRAIL_COLOR_END   = '#f97316'
export const SUMMIT_COLOR      = '#f97316'
export const DAY_END_COLOR     = '#6366f1'
export const HEAD_COLOR        = '#f97316'

export const STATS_FONT = 'Barlow, Inter, system-ui, sans-serif'

export const TILE_URLS: Record<string, string> = {
  standard:  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  topo:      'https://tile.opentopomap.org/{z}/{x}/{y}.png',
  dark:      'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
  gray:      'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}

export const TERRAIN_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

export const EXPORT_FPS      = 30
export const EXPORT_BITRATE  = 8_000_000
export const EXPORT_FORMAT   = 'video/webm;codecs=vp9'
export const EXPORT_FALLBACK = 'video/webm;codecs=vp8'

// Layout constants (for 1920px height = 9:16 base)
export const SAFE_ZONE_TOP    = 250
export const SAFE_ZONE_BOTTOM = 350

// Marker limits
export const MAX_SUMMIT_MARKERS   = 8
export const MAX_KM_MARKERS       = 15
export const MIN_KM_MARKER_PX     = 60
export const SUMMIT_MATCH_DIST_M  = 70

// Photo pause timing (ms)
export const PHOTO_FADE_IN_MS   = 500
export const PHOTO_DISPLAY_MS   = 2000
export const PHOTO_CROSSFADE_MS = 500
export const PHOTO_FADE_OUT_MS  = 500
export const MAX_PHOTO_GROUPS   = 10
export const PHOTO_GROUP_MERGE_THRESHOLD = 0.02

// 3D camera
export const CAMERA_KEYFRAMES    = 150
export const CAMERA_LOOKAHEAD    = 0.12
export const CAMERA_SMOOTH_WIN   = 15
export const CAMERA_MAX_BEARING_RATE = 8

export const MAPLIBRE_STYLES: Record<string, string> = {
  'satellite-3d': 'satellite',
  'outdoor-3d':   'outdoor',
  'dark-3d':      'dark',
}
