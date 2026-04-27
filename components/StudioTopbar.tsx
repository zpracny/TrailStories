'use client'
import { ActivityStoryData } from '@/components/StoryGenerator/storyTypes'
import Link from 'next/link'

interface StudioTopbarProps {
  data: ActivityStoryData
  onExport: () => void
  isExporting: boolean
}

function fmtDist(m: number) { return (m / 1000).toFixed(1) + ' KM' }
function fmtElev(m: number) { return Math.round(m) + ' M↑' }
function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')} H` : `${m} MIN`
}

export function StudioTopbar({ data, onExport, isExporting }: StudioTopbarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-5 border-b border-[var(--border)] bg-[var(--panel)] shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="btn btn-ghost !px-2 !py-1.5 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Zpět
        </Link>

        <div className="w-px h-5 bg-[var(--border-2)]" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
          <span className="font-semibold text-sm truncate max-w-[200px]">{data.name}</span>
          <span className="text-[var(--muted)] text-xs t-mono shrink-0 hidden sm:inline">
            {fmtDist(data.distance)} · {fmtElev(data.elevationGain)} · {fmtTime(data.movingTime)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="btn btn-primary !py-1.5 !px-4 text-xs"
        >
          {isExporting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Exportuji…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 3v12M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exportovat 1080p
            </>
          )}
        </button>
      </div>
    </header>
  )
}
