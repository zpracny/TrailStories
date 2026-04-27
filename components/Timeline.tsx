'use client'
import { useState, useEffect, useRef } from 'react'

interface TimelineProps {
  isPlaying: boolean
  onTogglePlay: () => void
  duration: number
}

export function Timeline({ isPlaying, onTogglePlay, duration }: TimelineProps) {
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const updateProgress = (p: number) => {
    progressRef.current = p
    setProgress(p)
  }

  useEffect(() => {
    if (!isPlaying) return
    let raf: number
    const startTime = performance.now() - progressRef.current * duration * 1000
    const loop = (now: number) => {
      const elapsed = (now - startTime) / 1000
      const p = (elapsed % duration) / duration
      updateProgress(p)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, duration])

  const seek = (clientX: number) => {
    if (!trackRef.current) return
    const r = trackRef.current.getBoundingClientRect()
    updateProgress(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => seek(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const cur = progress * duration
  const fmt = (s: number) => `${Math.floor(s)}:${String(Math.round((s % 1) * 10) * 10).padStart(2, '0')}`

  return (
    <div className="card-glass shrink-0 p-3 flex items-center gap-4">
      <button
        onClick={onTogglePlay}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={{
          background: 'linear-gradient(180deg, var(--accent-2), var(--accent))',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="t-mono text-xs text-white/70">{fmt(cur)}</span>
          <span className="t-mono text-xs text-[var(--muted)]">{fmt(duration)}</span>
        </div>
        <div
          ref={trackRef}
          className="relative h-7 cursor-pointer flex items-center"
          onMouseDown={e => { setDragging(true); seek(e.clientX) }}
        >
          <div className="absolute left-0 right-0 h-1.5 rounded-full bg-white/10" />
          {[0.25, 0.5, 0.75].map((p, i) => (
            <div key={i} className="absolute w-0.5 h-3 bg-white/20 rounded"
              style={{ left: `${p * 100}%` }} />
          ))}
          <div className="absolute left-0 h-1.5 rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--magenta))',
              boxShadow: '0 0 10px rgba(255,91,31,0.5)',
            }} />
          <div className="absolute w-4 h-4 rounded-full bg-white border-2"
            style={{
              left: `${progress * 100}%`,
              transform: 'translateX(-50%)',
              borderColor: 'var(--accent)',
              boxShadow: '0 0 0 4px var(--accent-glow)',
            }} />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          className="btn btn-ghost !p-2"
          title="Restart"
          onClick={() => updateProgress(0)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
