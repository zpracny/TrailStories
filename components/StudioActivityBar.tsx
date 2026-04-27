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
    { label: 'Převýšení', value: Math.round(data.elevationGain) + ' m↑' },
    { label: 'Čas', value: fmtTime(data.movingTime) },
    { label: 'Sport', value: data.sportType },
    ...(data.allPhotos && data.allPhotos.length > 0
      ? [{ label: 'Trackpoints', value: String(data.allPhotos.length) }]
      : []),
  ]

  return (
    <div className="flex items-center gap-7 h-11 px-5 border-b border-[var(--border)] bg-[var(--panel)] shrink-0 overflow-x-auto no-scrollbar">
      {stats.map((s, i) => (
        <div key={i} className="flex items-baseline gap-1.5 shrink-0">
          <span className="t-mono text-[13px] font-semibold text-white">{s.value}</span>
          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
