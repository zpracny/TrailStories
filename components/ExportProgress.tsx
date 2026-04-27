'use client'

interface ExportProgressProps {
  progress: number
  onDismiss?: () => void
}

export function ExportProgress({ progress, onDismiss }: ExportProgressProps) {
  const pct = Math.round(progress * 100)
  const done = pct >= 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-[var(--panel)] rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-6">
        {done ? (
          <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center text-3xl">
            ✓
          </div>
        ) : (
          <div className="relative w-14 h-14">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="22"
                fill="none"
                stroke="#f97316"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress)}`}
                style={{ transition: 'stroke-dashoffset 0.2s ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
              {pct}%
            </span>
          </div>
        )}

        <div className="text-center">
          <p className="text-white font-semibold">
            {done ? 'Export dokončen!' : 'Exportuji video…'}
          </p>
          <p className="text-white/40 text-sm mt-1">
            {done
              ? 'Video bylo staženo jako trailstory.webm'
              : 'Prosím nevypínej stránku. Může to trvat chvíli.'}
          </p>
        </div>

        {/* Progress bar */}
        {!done && (
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {done && onDismiss && (
          <button
            onClick={onDismiss}
            className="px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors"
          >
            Hotovo
          </button>
        )}
      </div>
    </div>
  )
}
