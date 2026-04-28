'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { LandingUpload } from '@/components/LandingUpload'

// ─── Decorative trail data (for animated hero background & phone mockup) ───
const TRAIL_POINTS: [number, number][] = [
  [0.05, 0.78], [0.09, 0.74], [0.13, 0.69], [0.17, 0.66], [0.21, 0.62],
  [0.24, 0.58], [0.27, 0.54], [0.30, 0.51], [0.33, 0.46], [0.36, 0.42],
  [0.40, 0.39], [0.43, 0.36], [0.45, 0.32], [0.47, 0.28], [0.49, 0.24],
  [0.51, 0.21], [0.54, 0.19], [0.57, 0.20], [0.60, 0.23], [0.62, 0.27],
  [0.64, 0.31], [0.66, 0.36], [0.68, 0.41], [0.71, 0.45], [0.74, 0.48],
  [0.77, 0.51], [0.80, 0.55], [0.83, 0.58], [0.86, 0.62], [0.89, 0.65],
  [0.92, 0.69], [0.95, 0.72],
]

function trailPath(w: number, h: number, pts = TRAIL_POINTS, px = 0, py = 0): string {
  const ww = w - px * 2
  const hh = h - py * 2
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(px + x * ww).toFixed(1)} ${(py + y * hh).toFixed(1)}`).join(' ')
}

function pointAt(t: number, w: number, h: number, pts = TRAIL_POINTS, px = 0, py = 0): [number, number] {
  const p = Math.max(0, Math.min(1, t))
  const idx = p * (pts.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  const a = pts[i]
  const b = pts[Math.min(i + 1, pts.length - 1)]
  return [px + (a[0] + (b[0] - a[0]) * f) * (w - px * 2), py + (a[1] + (b[1] - a[1]) * f) * (h - py * 2)]
}

function useCounter(target: number, duration = 1400, deps: unknown[] = []) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

// ─── Hero animated background ───
function HeroBackground({ accent, mouseX, mouseY }: { accent: string; mouseX: number; mouseY: number }) {
  const W = 1600, H = 900
  const path = useMemo(() => trailPath(W, H, TRAIL_POINTS, 60, 80), [])
  const [t, setT] = useState(0)

  useEffect(() => {
    let raf: number
    const start = performance.now()
    const loop = (now: number) => {
      const elapsed = (now - start) / 1000
      const cycle = 9.5
      const ct = elapsed % cycle
      setT(ct < 8 ? ct / 8 : 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const [mx, my] = pointAt(t, W, H, TRAIL_POINTS, 60, 80)
  const px = (mouseX - 0.5) * 30
  const py = (mouseY - 0.5) * 20
  const trailLen = 2000

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute rounded-full blur-[140px] opacity-60"
        style={{ width: 900, height: 900, left: '50%', top: '30%',
          transform: `translate(-50%, -50%) translate(${px * 0.5}px, ${py * 0.5}px)`,
          background: `radial-gradient(circle, ${accent}40, transparent 60%)` }} />
      <div className="absolute rounded-full blur-[140px] opacity-30"
        style={{ width: 600, height: 600, right: '10%', top: '55%',
          background: 'radial-gradient(circle, rgba(232,50,156,0.3), transparent 60%)',
          transform: `translate(${-px * 0.3}px, ${-py * 0.3}px)` }} />
      <div className="absolute inset-0 topo-grid opacity-70"
        style={{ transform: `translate(${px * 0.2}px, ${py * 0.2}px)` }} />

      <svg className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
        style={{ transform: `translate(${px * 0.4}px, ${py * 0.4}px)` }}>
        <defs>
          <linearGradient id="trail-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0" />
            <stop offset="20%" stopColor={accent} stopOpacity="0.4" />
            <stop offset="60%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor="#ffd9b3" stopOpacity="1" />
          </linearGradient>
          <filter id="trail-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <path d={path} fill="none" stroke={accent} strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />
        {Array.from({ length: 12 }).map((_, i) => {
          const [x, y] = pointAt((i + 1) / 13, W, H, TRAIL_POINTS, 60, 80)
          return <circle key={i} cx={x} cy={y} r="3" fill={accent} fillOpacity="0.5" />
        })}
        <path d={path} fill="none" stroke="url(#trail-grad)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={trailLen} strokeDashoffset={trailLen * (1 - t)} filter="url(#trail-glow)" opacity="0.9" />
        <path d={path} fill="none" stroke="url(#trail-grad)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={trailLen} strokeDashoffset={trailLen * (1 - t)} />
        <circle cx={mx} cy={my} r="14" fill={accent} fillOpacity="0.18" />
        <circle cx={mx} cy={my} r="7" fill={accent} fillOpacity="0.4" />
        <circle cx={mx} cy={my} r="4" fill="#fff" />
      </svg>

      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 360"
        preserveAspectRatio="none" style={{ height: '55%', transform: `translate(${px * 0.6}px, ${py * 0.15}px)` }} aria-hidden>
        <path d="M0,360 L0,220 L80,200 L160,210 L240,170 L320,190 L400,150 L480,180 L560,140 L640,170 L720,130 L800,160 L880,120 L960,150 L1040,110 L1120,140 L1200,100 L1280,130 L1360,90 L1440,120 L1440,360 Z" fill="rgba(255,255,255,0.025)" />
        <path d="M0,360 L0,260 L120,240 L240,260 L360,200 L480,250 L600,180 L720,230 L840,170 L960,220 L1080,160 L1200,210 L1320,170 L1440,200 L1440,360 Z" fill="rgba(255,91,31,0.035)" />
        <path d="M0,360 L0,300 L160,290 L320,310 L480,260 L640,300 L800,250 L960,290 L1120,240 L1280,280 L1440,250 L1440,360 Z" fill="rgba(255,255,255,0.04)" />
      </svg>

      <div className="noise absolute inset-0 opacity-40 mix-blend-overlay" />
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(7,7,13,0.7) 100%)' }} />
    </div>
  )
}

// ─── Live stat counter ───
function StatTicker() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4000)
    return () => clearInterval(id)
  }, [])
  const stats = [
    { num: 12847, label: 'stories vytvořeno', suffix: '' },
    { num: 384, label: 'km poslední story', suffix: ' km' },
    { num: 1843, label: 'videí dnes', suffix: '' },
    { num: 24, label: 'průměrný čas exportu', suffix: ' s' },
  ]
  const s = stats[tick % stats.length]
  const v = useCounter(s.num, 1200, [tick])
  return (
    <div className="flex items-baseline gap-3">
      <span className="t-num text-[28px] text-white tabular-nums">
        {Math.round(v).toLocaleString('cs-CZ')}{s.suffix}
      </span>
      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{s.label}</span>
    </div>
  )
}

// ─── Phone mockup with animated preview ───
function LivePreviewCard({ accent, activeMode }: { accent: string; activeMode: string }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const loop = (now: number) => {
      setT(((now - start) / 1000 % 8) / 8)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const W = 360, H = 640
  const path = useMemo(() => trailPath(W, H, TRAIL_POINTS, 30, 80), [])
  const [mx, my] = pointAt(t, W, H, TRAIL_POINTS, 30, 80)
  const dist = (8.4 * t).toFixed(1)
  const elev = Math.round(304 * t)
  const sec = Math.round(242 * t)
  const tm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const trailLen = 1500

  const bg = activeMode === '3d'
    ? 'linear-gradient(180deg, #1a2540 0%, #2d3f6a 50%, #4a5d7a 100%)'
    : activeMode === 'cam'
    ? 'linear-gradient(180deg, #0f1828 0%, #1a2540 100%)'
    : activeMode === 'slide'
    ? '#0a0a14'
    : 'linear-gradient(180deg, #1a1430 0%, #2a1640 50%, #3a1450 100%)'

  const [s0x, s0y] = pointAt(0, W, H, TRAIL_POINTS, 30, 80)

  return (
    <div className="relative" style={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.6))' }}>
      <div className="relative mx-auto" style={{ width: 320, height: 580, animation: 'float 8s ease-in-out infinite' }}>
        <div className="absolute inset-0 rounded-[42px] border border-[var(--border-2)] bg-black shadow-2xl">
          <div className="absolute inset-[6px] rounded-[36px] overflow-hidden" style={{ background: bg }}>
            <div className="absolute top-0 left-0 right-0 p-5 z-10">
              <div className="text-white t-mono text-xs opacity-70">2025 · 02 · 07</div>
              <div className="text-white text-base font-semibold mt-1">Beskydy · Lysá hora</div>
            </div>
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="prev-trail" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#fff" />
                </linearGradient>
              </defs>
              <path d={path} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
              <path d={path} fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={trailLen} strokeDashoffset={trailLen * (1 - t)}
                style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
              <circle cx={mx} cy={my} r="14" fill={accent} opacity="0.2" />
              <circle cx={mx} cy={my} r="6" fill={accent} />
              <circle cx={mx} cy={my} r="3" fill="#fff" />
              <circle cx={s0x} cy={s0y} r="6" fill="var(--lime)" />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
              <svg viewBox="0 0 280 50" className="w-full h-12 mb-3">
                <defs>
                  <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,45 L20,40 L40,38 L60,32 L80,28 L100,20 L120,15 L140,8 L160,12 L180,18 L200,22 L220,28 L240,34 L260,38 L280,42 L280,50 L0,50 Z" fill="url(#elev-fill)" />
                <path d="M0,45 L20,40 L40,38 L60,32 L80,28 L100,20 L120,15 L140,8 L160,12 L180,18 L200,22 L220,28 L240,34 L260,38 L280,42" fill="none" stroke={accent} strokeWidth="1.5" />
                <circle cx={t * 280} cy={45 - t * 30} r="4" fill="#fff" />
              </svg>
              <div className="flex justify-between text-white">
                <PhoneStat val={dist} unit="km" label="DIST" />
                <PhoneStat val={elev} unit="m↑" label="ELEV" />
                <PhoneStat val={tm} unit="" label="TIME" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-white/40 t-mono">TRAILSTORIES</span>
                <span className="text-[10px] text-white/40 t-mono">{(t * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 rounded-b-2xl bg-black z-10" />
      </div>
      <div className="absolute -left-4 top-12 chip card-glass" style={{ borderColor: accent, color: accent, animation: 'float 6s ease-in-out infinite' }}>
        <span className="chip-dot" />
        9:16 · INSTAGRAM
      </div>
      <div className="absolute -right-6 bottom-24 chip card-glass" style={{ animation: 'float 7s ease-in-out infinite reverse' }}>
        <span className="chip-dot" style={{ color: 'var(--lime)' }} />
        60 FPS · LIVE
      </div>
      <div className="absolute -right-12 top-32 chip card-glass" style={{ animation: 'float 9s ease-in-out infinite' }}>
        WEBM · 1080p
      </div>
    </div>
  )
}

function PhoneStat({ val, unit, label }: { val: string | number; unit: string; label: string }) {
  return (
    <div>
      <div className="t-num text-[28px] leading-none tabular-nums">
        {val}<span className="text-sm text-white/50 ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-white/40 t-mono mt-1">{label}</div>
    </div>
  )
}

// ─── Sample story card for marquee ───
function SampleCard({ author, title, dist, elev, seed = 0 }: { author: string; title: string; dist: string; elev: string; seed?: number }) {
  const accent = 'var(--accent)'
  const pts = useMemo((): [number, number][] => {
    const arr: [number, number][] = []
    let x = 0.05, y = 0.5 + Math.sin(seed) * 0.2
    for (let i = 0; i < 16; i++) {
      arr.push([x, Math.max(0.15, Math.min(0.85, y))])
      x += 0.06
      y += Math.sin(i * 1.7 + seed) * 0.15
    }
    return arr
  }, [seed])
  const path = trailPath(280, 180, pts, 10, 20)
  const colors = ['var(--accent)', 'var(--magenta)', 'var(--lime)', 'var(--accent)', '#5dd6ff']
  const c = colors[seed % colors.length]
  return (
    <div className="shrink-0 w-[280px] card overflow-hidden">
      <div className="relative h-[180px] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${c === 'var(--accent)' ? 'rgba(255,91,31,0.08)' : c === 'var(--magenta)' ? 'rgba(232,50,156,0.08)' : c === 'var(--lime)' ? 'rgba(200,255,62,0.08)' : 'rgba(93,214,255,0.08)'}, transparent)` }}>
        <svg viewBox="0 0 280 180" className="absolute inset-0 w-full h-full">
          <path d={path} fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="2" />
          <path d={path} fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
        </svg>
        <div className="absolute top-2 left-2 chip text-[10px]" style={{ padding: '2px 7px' }}>{dist}</div>
      </div>
      <div className="px-3 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-[var(--muted)] t-mono mt-0.5">{author} · {elev}</div>
        </div>
        <button className="text-[var(--muted)] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main landing page ───
const ACCENT = '#ff5b1f'
const MODES = [
  { id: '2d', label: '2D Story' },
  { id: '3d', label: '3D Fly-over' },
  { id: 'cam', label: 'Kamera' },
  { id: 'slide', label: 'Slideshow' },
]
const SAMPLE_STORIES = [
  { author: '@martin_hk', title: 'Krkonoše Snežka', dist: '12.3 km', elev: '604 m↑', seed: 0 },
  { author: '@adela_runs', title: 'Beskydy Lysá', dist: '8.4 km', elev: '304 m↑', seed: 7 },
  { author: '@tomas_ride', title: 'Šumava bike', dist: '47.2 km', elev: '1 240 m↑', seed: 14 },
  { author: '@kuba_alps', title: 'Alpy day-2', dist: '23.1 km', elev: '1 870 m↑', seed: 21 },
  { author: '@petra_walk', title: 'Brdy okruh', dist: '6.7 km', elev: '180 m↑', seed: 28 },
  { author: '@filip_run', title: 'Pražské sady', dist: '10.0 km', elev: '112 m↑', seed: 35 },
]

export default function Home() {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [activeMode, setActiveMode] = useState('2d')

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  return (
    <div className="relative min-h-dvh" onMouseMove={onMouseMove}>
      <HeroBackground accent={ACCENT} mouseX={mouse.x} mouseY={mouse.y} />

      {/* NAV */}
      <nav className="relative z-10 max-w-[1280px] mx-auto px-8 pt-7 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="TrailStories" height={48} width={170} style={{ height: 48, width: 'auto' }} priority />
          <span className="chip text-[10px]" style={{ borderColor: ACCENT, color: ACCENT, padding: '2px 8px' }}>BETA</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#how" className="text-sm text-[var(--muted)] hover:text-white transition-colors">Jak to funguje</a>
          <button className="btn">Přihlásit</button>
        </div>
      </nav>

      {/* HERO */}
      <main className="relative z-10 max-w-[1280px] mx-auto px-8 pt-12 pb-20">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
          <div>
            <div className="flex items-center gap-3 mb-7">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: ACCENT, animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: ACCENT }} />
              </span>
              <span className="t-eyebrow">YOUR ADVENTURE · ANIMATED</span>
            </div>

            <h1 className="t-display mb-6" style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 1.02 }}>
              <span className="block text-white">TURN YOUR</span>
              <span className="block">
                <span className="shimmer-text">GPX</span>
                {' '}<span className="text-white">INTO</span>
              </span>
              <span className="block text-white">
                A <em style={{ fontFamily: 'var(--font-fraunces)', fontStyle: 'italic', fontWeight: 400 }}>story.</em>
              </span>
            </h1>

            <p className="text-[17px] text-[var(--muted)] max-w-[500px] mb-7 leading-relaxed">
              Nahraj GPX soubor, zvol styl a exportuj cinematic animaci své trasy
              přímo v prohlížeči. Žádný backend. Žádná registrace.
            </p>

            <div className="flex flex-wrap gap-2 mb-9">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id)}
                  className={`chip cursor-pointer ${activeMode === m.id ? 'chip-active' : ''}`}
                  style={activeMode === m.id ? { borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` } : {}}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-5">
              <a href="#upload">
                <button className="btn btn-primary" style={{ padding: '14px 24px', fontSize: 15 }}>
                  Vytvořit story
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </a>
              <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                <StatTicker />
              </div>
            </div>
          </div>

          <LivePreviewCard accent={ACCENT} activeMode={activeMode} />
        </div>
      </main>

      {/* UPLOAD + FEATURES */}
      <section id="upload" className="relative z-10 max-w-[1280px] mx-auto px-8 pb-12">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          <LandingUpload />

          <div className="card p-7">
            <div className="flex items-center gap-3 mb-5">
              <span className="t-eyebrow">FEATURES</span>
              <span className="text-xs text-[var(--subtle)]">/ BUILT-IN</span>
            </div>
            <div className="space-y-3">
              {[
                { ic: '1080p', title: 'Export 1080p WebM', desc: 'Připraveno k Insta Story / Reels', color: ACCENT, bg: `${ACCENT}18` },
                { ic: '4×', title: 'Čtyři vizuální styly', desc: '2D · 3D · Kamera · Slideshow', color: 'var(--magenta)', bg: 'rgba(232,50,156,0.15)' },
                { ic: '0$', title: 'Plně zdarma', desc: 'Žádný backend, vše v prohlížeči', color: 'var(--lime)', bg: 'rgba(200,255,62,0.12)' },
                { ic: 'WG', title: 'WebGL akcelerace', desc: 'Plynulý 60 fps preview', color: 'var(--muted)', bg: 'rgba(255,255,255,0.05)' },
              ].map((f) => (
                <div key={f.ic} className="flex items-start gap-4 py-2 border-b border-[var(--border)] last:border-0">
                  <div className="t-mono text-[11px] font-bold w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: f.bg, color: f.color }}>{f.ic}</div>
                  <div className="flex-1 pt-1">
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="relative z-10 py-10 border-y border-[var(--border)] overflow-hidden" style={{ background: 'rgba(12,12,20,0.4)' }}>
        <div className="flex items-center gap-12 mb-5 px-8 max-w-[1280px] mx-auto">
          <span className="t-eyebrow">RECENT STORIES</span>
          <span className="text-xs text-[var(--subtle)]">/ FROM THE COMMUNITY · UPDATING LIVE</span>
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-4 marquee-track" style={{ width: 'fit-content' }}>
            {[0, 1].flatMap(k =>
              SAMPLE_STORIES.map((s, i) => (
                <SampleCard key={`${k}-${i}`} {...s} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 max-w-[1280px] mx-auto px-8 py-20">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <span className="t-eyebrow">HOW IT WORKS</span>
            <h2 className="t-display mt-4 leading-[0.9]" style={{ fontSize: 64 }}>
              FROM .GPX<br />TO REELS<br />IN <span style={{ color: ACCENT }}>30 S</span>
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { n: '01', title: 'Nahraj GPX soubor', desc: 'Přetáhni nebo vyber. Funguje s exporty ze Strava, Garmin, Komoot, Wahoo.', color: ACCENT },
              { n: '02', title: 'Nastav styl & režim', desc: 'Vyber 2D / 3D / Kamera / Slideshow. Doplň fotky pro pauzy v animaci.', color: 'var(--magenta)' },
              { n: '03', title: 'Exportuj 1080p WebM', desc: 'Render běží v prohlížeči přes WebGL. Hotovo za ~24 sekund.', color: 'var(--lime)' },
            ].map(s => (
              <div key={s.n} className="card p-6 flex items-start gap-6 hover:border-[var(--border-2)] transition-colors">
                <span className="t-display text-[56px] leading-none shrink-0" style={{ color: s.color }}>{s.n}</span>
                <div className="flex-1 pt-2">
                  <div className="text-lg font-semibold">{s.title}</div>
                  <div className="text-sm text-[var(--muted)] mt-1.5">{s.desc}</div>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--subtle)] mt-3 shrink-0">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[var(--border)]">
        <div className="max-w-[1280px] mx-auto px-8 py-8 flex items-center justify-between text-xs text-[var(--muted)] t-mono">
          <span>© 2026 TRAILSTORIES · BUILT WITH ♥ IN PRAHA</span>
          <div className="hidden sm:flex items-center gap-5">
            <a href="https://github.com/zpracny/TrailStories" className="hover:text-white transition-colors">GITHUB</a>
            <a className="hover:text-white transition-colors cursor-pointer">PRIVACY</a>
            <span className="text-[var(--lime)]">STATUS · 100%</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
