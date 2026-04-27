'use client'

interface ExportProgressProps {
  progress: number
  onDismiss?: () => void
}

export function ExportProgress({ progress, onDismiss }: ExportProgressProps) {
  const pct = Math.round(progress * 100)
  const done = pct >= 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="card w-full max-w-md mx-4 p-8 relative">
        {done && onDismiss && (
          <button onClick={onDismiss} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="text-center">
          <span className="t-eyebrow">EXPORTING</span>
          <h3 className="t-display mt-2 mb-1 leading-none" style={{ fontSize: 40 }}>
            {done ? 'DONE!' : `${pct}%`}
          </h3>
          <p className="text-sm text-[var(--muted)]">
            {done
              ? 'Tvoje story je připravena ke stažení'
              : 'Renderuji 1080p WebM frame-by-frame'}
          </p>
        </div>

        <div className="my-6 relative h-2 rounded-full overflow-hidden bg-white/5">
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-200 rounded-full"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--magenta))',
              boxShadow: '0 0 12px rgba(255,91,31,0.5)',
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            ['1080p', 'QUALITY'],
            ['WebM', 'FORMAT'],
            ['VP9', 'CODEC'],
          ].map(([v, l]) => (
            <div key={l} className="text-center py-2 rounded-lg bg-white/[0.02] border border-[var(--border)]">
              <div className="t-mono text-[13px] font-semibold">{v}</div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5 t-mono">{l}</div>
            </div>
          ))}
        </div>

        {done && onDismiss ? (
          <button onClick={onDismiss} className="btn btn-primary w-full justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hotovo
          </button>
        ) : !done ? (
          <p className="text-center text-xs text-[var(--muted)] t-mono">
            Prosím nevypínej stránku…
          </p>
        ) : null}
      </div>
    </div>
  )
}
