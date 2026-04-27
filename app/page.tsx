import { LandingUpload } from '@/components/LandingUpload'

export default function Home() {
  return (
    <div className="relative flex flex-col min-h-dvh topo-grid overflow-hidden">
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-[120px]" />
      </div>

      {/* Mountain silhouette SVG */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-full text-white/[0.03] fill-current"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0,320 L0,200 L120,140 L240,180 L360,80 L480,140 L600,40 L720,120 L840,60 L960,100 L1080,20 L1200,80 L1320,50 L1440,90 L1440,320 Z" />
      </svg>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold text-white tracking-wide">
            TrailStories
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/30 text-orange-400/70 font-medium">
            Beta
          </span>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center flex-1 px-6 pb-16 pt-8 max-w-5xl mx-auto w-full gap-12">
        <div className="text-center max-w-2xl">
          <p className="text-orange-400/80 text-sm font-medium tracking-widest uppercase mb-4">
            Your adventure, animated
          </p>
          <h1 className="font-[family-name:var(--font-barlow-condensed)] text-5xl sm:text-7xl font-extrabold text-white leading-none mb-5">
            Turn your{' '}
            <span className="text-orange-500">GPX into</span>
            {' '}a story
          </h1>
          <p className="text-white/40 text-lg font-light max-w-md mx-auto">
            Nahraj GPX soubor, nastav styl a exportuj animované video přímo v prohlížeči.
          </p>

          {/* Mode pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {['2D Story', '3D Fly-over', 'Kamera', 'Slideshow'].map(m => (
              <span
                key={m}
                className="px-3 py-1 rounded-full border border-white/10 text-white/50 text-sm"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <LandingUpload />
      </main>
    </div>
  )
}
