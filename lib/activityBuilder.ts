import { ActivityStoryData, StoryPhoto, PhotoItem } from '@/components/StoryGenerator/storyTypes'
import { GPXParseResult } from './gpxParser'

export function buildActivityStoryData(
  gpx: GPXParseResult,
  trailPhotos: StoryPhoto[],
  allPhotos: PhotoItem[]
): ActivityStoryData {
  return {
    activityId: crypto.randomUUID(),
    name: gpx.name,
    sportType: gpx.sportType,
    distance: gpx.distance,
    movingTime: gpx.movingTime,
    elevationGain: gpx.elevationGain,
    activityStartDate: gpx.activityStartDate,

    encodedPolyline: null,
    preloadedLatLngs: gpx.preloadedLatLngs,

    cachedElevationUrl: null,
    preloadedElevation: gpx.preloadedElevation,

    photoUrl: allPhotos.length > 0 ? allPhotos[0].url : null,

    peakVisits: [],
    dayEndMarkers: [],
    poiMarkers: [],

    trailPhotos,
    allPhotos,
  }
}
