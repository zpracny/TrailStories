import { ActivityStoryData } from '@/components/StoryGenerator/storyTypes'

interface StudioActivityBarProps {
  data: ActivityStoryData
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')} h` : `${m} min`
}

export function StudioActivityBar({ data }: StudioActivityBarProps) {
  const stats = [
    { label: 'Vzdálenost', value: (data.distance / 1000).toFixed(1) + ' km' },
    { label: 'Převýšení', value: Math.round(data.elevationGain) + ' m' },
    { label: 'Čas', value: fmtTime(data.movingTime) },
    { label: 'Sport', value: data.sportType },
    ...(data.allPhotos && data.allPhotos.length > 0
      ? [{ label: 'Fotky', value: String(data.allPhotos.length) }]
      : []),
  ]

  return (
    <div className="flex items-center gap-6 px-5 py-2.5 border-b border-white/8 bg-[var(--panel)] shrink-0 overflow-x-auto">
      {stats.map((s, i) => (
        <div key={i} className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-white font-semibold text-sm">{s.value}</span>
          <span className="text-white/35 text-xs">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
