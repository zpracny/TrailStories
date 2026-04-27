import { TERRAIN_DEM_URL } from './storyConstants'

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TOPO_TILES = 'https://tile.opentopomap.org/{z}/{x}/{y}.png'
const DARK_TILES = 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
const CF_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'

function baseStyle(tileUrl: string, attribution: string): object {
  return {
    version: 8,
    sources: {
      'raster-base': {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution,
      },
      // Separate sources for terrain and hillshade to avoid rendering artifacts
      'terrain-dem': {
        type: 'raster-dem',
        tiles: [TERRAIN_DEM_URL],
        tileSize: 256,
        encoding: 'terrarium',
      },
      'hillshade-dem': {
        type: 'raster-dem',
        tiles: [TERRAIN_DEM_URL],
        tileSize: 256,
        encoding: 'terrarium',
      },
    },
    terrain: {
      source: 'terrain-dem',
      exaggeration: 1.5,
    },
    layers: [
      {
        id: 'raster-base-layer',
        type: 'raster',
        source: 'raster-base',
        minzoom: 0,
        maxzoom: 22,
      },
      {
        id: 'hillshade-layer',
        type: 'hillshade',
        source: 'hillshade-dem',
        layout: { visibility: 'visible' },
        paint: {
          'hillshade-shadow-color': '#000000',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-exaggeration': 0.5,
        },
      },
    ],
  }
}

export function getMapStyle(style3D: string): object {
  switch (style3D) {
    case 'satellite-3d':
      return baseStyle(ESRI_SATELLITE, '© Esri')
    case 'outdoor-3d':
      return baseStyle(TOPO_TILES, '© OpenTopoMap')
    case 'dark-3d':
      return baseStyle(DARK_TILES, '© CartoDB')
    default:
      return baseStyle(OSM_TILES, '© OpenStreetMap')
  }
}

export function getCameraFollowStyle(cfStyle: string): object {
  switch (cfStyle) {
    case 'topo':
      return baseStyle(TOPO_TILES, '© OpenTopoMap')
    case 'dark':
      return baseStyle(DARK_TILES, '© CartoDB')
    case 'esri':
      return baseStyle(CF_ESRI, '© Esri')
    default:
      return baseStyle(OSM_TILES, '© OpenStreetMap')
  }
}
