'use client'
import { ActivityStoryData } from '@/components/StoryGenerator/storyTypes'
import Link from 'next/link'

interface StudioTopbarProps {
  data: ActivityStoryData
  onExport: () => void
  isExporting: boolean
}

function fmtDist(m: number) { return (m / 1000).toFixed(1) + ' km' }
function fmtElev(m: number) { return Math.round(m) + ' m↑' }

export function StudioTopbar({ data, onExport, isExporting }: StudioTopbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[var(--panel)] shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Zpět
        </Link>

        <div className="w-px h-4 bg-white/10" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-medium text-sm truncate max-w-[180px]">{data.name}</span>
          <span className="text-white/30 text-sm shrink-0">{fmtDist(data.distance)}</span>
          <span className="text-white/30 text-sm shrink-0">·</span>
          <span className="text-white/30 text-sm shrink-0">{fmtElev(data.elevationGain)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors disabled:opacity-40"
        >
          {isExporting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Exportuji…
            </>
          ) : (
            <>⬇ Exportovat</>
          )}
        </button>
      </div>
    </div>
  )
}
