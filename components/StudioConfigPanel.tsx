'use client'
import { useState } from 'react'
import { StoryConfig, ActivityStoryData } from '@/components/StoryGenerator/storyTypes'

interface StudioConfigPanelProps {
  config: StoryConfig
  data: ActivityStoryData
  onChange: (patch: Partial<StoryConfig>) => void
  disabled?: boolean
}

// ─── Section accordion ───
function PanelSection({
  title, id, active, setActive, badge, children,
}: {
  title: string; id: string; active: string | null; setActive: (v: string | null) => void
  badge?: string; children: React.ReactNode
}) {
  const open = active === id
  return (
    <div className="border-b border-[var(--border)] shrink-0">
      <button
        onClick={() => setActive(open ? null : id)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge && <span className="t-mono text-[10px] text-[var(--muted)]">{badge}</span>}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="text-[var(--muted)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Segmented control ───
function SegRow({ value, options, onChange, className = '' }: {
  value: string; options: [string, string][]
  onChange: (v: string) => void; className?: string
}) {
  return (
    <div className={`flex rounded-lg border border-[var(--border-2)] bg-white/[0.02] p-0.5 ${className}`}>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="flex-1 text-xs py-1.5 rounded-md transition-all font-medium"
          style={value === v
            ? { background: 'rgba(255,91,31,0.2)', color: 'var(--accent-2)' }
            : { color: 'var(--muted)' }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

// ─── Toggle pill ───
function ToggleRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs text-left transition-all"
      style={{
        borderColor: checked ? 'var(--accent)' : 'var(--border-2)',
        background: checked ? 'rgba(255,91,31,0.1)' : 'rgba(255,255,255,0.02)',
        color: checked ? '#fff' : 'var(--muted)',
      }}
    >
      <span className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center shrink-0 border"
        style={{ borderColor: checked ? 'var(--accent)' : 'var(--border-2)', background: checked ? 'var(--accent)' : 'transparent' }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}

// ─── Range slider row ───
function RangeRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="t-mono text-xs font-semibold">{value}{unit ?? ''}</span>
      </div>
      <input
        type="range" className="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// ─── Mode thumbnails ───
function ModeThumb2D() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a1430, #2a1640)' }}>
      <svg viewBox="0 0 100 125" className="absolute inset-0 w-full h-full">
        <path d="M10,100 Q30,80 40,60 T70,30 L85,15" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="1.5" />
        <path d="M10,100 Q30,80 40,60 T70,30 L85,15" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="100" strokeDashoffset="40" />
        <circle cx="60" cy="40" r="2.5" fill="var(--accent)" />
      </svg>
    </div>
  )
}
function ModeThumb3D() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a2540, #4a5d7a)' }}>
      <svg viewBox="0 0 100 125" className="absolute inset-0 w-full h-full">
        <path d="M0,100 L20,80 L40,90 L60,70 L80,85 L100,75 L100,125 L0,125 Z" fill="rgba(255,255,255,0.12)" />
        <path d="M0,115 L25,95 L50,105 L75,90 L100,100 L100,125 L0,125 Z" fill="rgba(255,255,255,0.06)" />
        <path d="M5,108 Q25,95 45,90 T80,75" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      </svg>
    </div>
  )
}
function ModeThumbCam() {
  return (
    <div className="absolute inset-0 bg-[#0f1828]">
      <div className="absolute inset-0 topo-grid opacity-50" />
      <svg viewBox="0 0 100 125" className="absolute inset-0 w-full h-full">
        <path d="M20,100 Q40,80 50,60 T80,40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        <path d="M20,100 Q40,80 50,60" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <circle cx="50" cy="60" r="3.5" fill="var(--accent)" />
        <circle cx="50" cy="60" r="10" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeOpacity="0.4" />
      </svg>
    </div>
  )
}
function ModeThumbSlide() {
  return (
    <div className="absolute inset-0 bg-[#0a0a14] flex items-center justify-center gap-1 p-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex-1 h-3/4 rounded-sm"
          style={{
            background: i === 1 ? 'linear-gradient(135deg, rgba(255,91,31,0.4), var(--magenta))' : 'rgba(255,255,255,0.06)',
            transform: i === 1 ? 'scale(1.1)' : 'scale(0.95)',
          }} />
      ))}
    </div>
  )
}

// ─── Mode grid ───
function ModeGrid({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  const modes = [
    { id: '2d', label: '2D Story', thumb: <ModeThumb2D /> },
    { id: '3d', label: '3D Fly-over', thumb: <ModeThumb3D /> },
    { id: 'camera-follow', label: 'Kamera', thumb: <ModeThumbCam /> },
    { id: 'slideshow', label: 'Slideshow', thumb: <ModeThumbSlide /> },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className="relative rounded-xl border overflow-hidden transition-all"
          style={{
            borderColor: mode === m.id ? 'var(--accent)' : 'var(--border)',
            background: mode === m.id ? 'rgba(255,91,31,0.1)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <div className="aspect-[4/5] relative">{m.thumb}</div>
          <div className="px-3 py-2 text-left">
            <div className="text-xs font-semibold">{m.label}</div>
          </div>
          {mode === m.id && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Background/map style section ───
function BackgroundSection({ config, onChange }: { config: StoryConfig; onChange: (p: Partial<StoryConfig>) => void }) {
  if (config.mode === '2d') {
    return (
      <div className="space-y-3">
        <SegRow value={config.backgroundType} onChange={v => onChange({ backgroundType: v as StoryConfig['backgroundType'] })}
          options={[['gradient', 'Gradient'], ['map', 'Mapa'], ['photo', 'Fotka']]} />
        {config.backgroundType === 'gradient' && (
          <div className="grid grid-cols-3 gap-2">
            {([
              ['night', 'Night', 'linear-gradient(180deg, #0a0a20, #2a1a55)'],
              ['forest', 'Forest', 'linear-gradient(180deg, #051810, #1a3825)'],
              ['sunset', 'Sunset', 'linear-gradient(180deg, #2a0d28, #c8453a)'],
            ] as [string, string, string][]).map(([id, l, g]) => (
              <button key={id} onClick={() => onChange({ gradientTheme: id as StoryConfig['gradientTheme'] })}
                className="rounded-lg overflow-hidden border-2 transition-all"
                style={{ borderColor: config.gradientTheme === id ? 'var(--accent)' : 'var(--border)' }}>
                <div className="h-12" style={{ background: g }} />
                <div className="text-[11px] py-1.5 text-center">{l}</div>
              </button>
            ))}
          </div>
        )}
        {config.backgroundType === 'map' && (
          <SegRow value={config.mapStyle} onChange={v => onChange({ mapStyle: v as StoryConfig['mapStyle'] })}
            options={[['standard', 'Std'], ['topo', 'Topo'], ['dark', 'Dark'], ['satellite', 'Sat']]} />
        )}
      </div>
    )
  }
  if (config.mode === '3d') {
    return (
      <SegRow value={config.mapStyle3D} onChange={v => onChange({ mapStyle3D: v as StoryConfig['mapStyle3D'] })}
        options={[['satellite-3d', 'Sat'], ['outdoor-3d', 'Outdoor'], ['dark-3d', 'Dark']]} />
    )
  }
  if (config.mode === 'camera-follow') {
    return (
      <SegRow value={config.mapStyle} onChange={v => onChange({ mapStyle: v as StoryConfig['mapStyle'] })}
        options={[['standard', 'OSM'], ['topo', 'Topo'], ['dark', 'Dark'], ['esri', 'Esri']]} />
    )
  }
  if (config.mode === 'slideshow') {
    return (
      <SegRow value={config.slideshowTransition} onChange={v => onChange({ slideshowTransition: v as StoryConfig['slideshowTransition'] })}
        options={[['crossfade', 'Crossfade'], ['slide', 'Slide'], ['zoom', 'Zoom']]} />
    )
  }
  return null
}

// ─── Main panel ───
export function StudioConfigPanel({ config, data, onChange, disabled }: StudioConfigPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>('mode')
  const hasPhotos = (data.allPhotos?.length || 0) > 0

  return (
    <aside
      className="w-[320px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col overflow-hidden"
      style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : {}}
    >
      <div className="flex flex-col overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--dim) transparent' }}>

        <PanelSection title="Režim" id="mode" active={activeSection} setActive={setActiveSection} badge="4">
          <ModeGrid mode={config.mode} setMode={m => onChange({ mode: m as StoryConfig['mode'] })} />
        </PanelSection>

        <PanelSection
          title={config.mode === 'slideshow' ? 'Přechody' : config.mode === '2d' ? 'Pozadí' : 'Styl mapy'}
          id="background" active={activeSection} setActive={setActiveSection}
        >
          <BackgroundSection config={config} onChange={onChange} />
        </PanelSection>

        <PanelSection title="Časování" id="timing" active={activeSection} setActive={setActiveSection}>
          <div className="space-y-4">
            <RangeRow label="Délka videa" value={config.durationSeconds}
              min={config.mode === '2d' ? 4 : 3} max={config.mode === '2d' ? 15 : 30}
              step={1} unit=" s" onChange={v => onChange({ durationSeconds: v })} />
            {config.mode === '3d' && (
              <>
                <RangeRow label="Náklon kamery" value={config.cameraPitch} min={30} max={75} step={5} unit="°" onChange={v => onChange({ cameraPitch: v })} />
                <RangeRow label="Výška kamery" value={config.cameraAltitude} min={200} max={3000} step={100} unit=" m" onChange={v => onChange({ cameraAltitude: v })} />
                <RangeRow label="Terén" value={config.terrainExaggeration} min={0.5} max={3} step={0.1} unit="×" onChange={v => onChange({ terrainExaggeration: v })} />
              </>
            )}
            {config.mode === 'camera-follow' && (
              <RangeRow label="Viewport" value={config.cfViewportKm} min={10} max={50} step={5} unit=" km" onChange={v => onChange({ cfViewportKm: v })} />
            )}
          </div>
        </PanelSection>

        <PanelSection title="Vrstvy" id="layers" active={activeSection} setActive={setActiveSection}>
          <div className="grid grid-cols-2 gap-1.5">
            {config.mode === '2d' && (
              <>
                <ToggleRow label="Elevační profil" checked={config.showElevationProfile} onChange={v => onChange({ showElevationProfile: v })} />
                <ToggleRow label="Km markery" checked={config.showKmMarkers} onChange={v => onChange({ showKmMarkers: v })} />
              </>
            )}
            {config.mode === '3d' && (
              <ToggleRow label="Hillshade" checked={config.showHillshade} onChange={v => onChange({ showHillshade: v })} />
            )}
            {config.mode === 'camera-follow' && (
              <>
                <ToggleRow label="Ghost trail" checked={config.cfShowGhostTrail} onChange={v => onChange({ cfShowGhostTrail: v })} />
                <ToggleRow label="Km markery" checked={config.showKmMarkers} onChange={v => onChange({ showKmMarkers: v })} />
              </>
            )}
            {hasPhotos && config.mode !== 'slideshow' && (
              <ToggleRow label="Foto pauzy" checked={config.showTrailPhotos} onChange={v => onChange({ showTrailPhotos: v })} />
            )}
            <ToggleRow label="Safe zones" checked={config.enableSafeZones} onChange={v => onChange({ enableSafeZones: v })} />
            <ToggleRow label="Logo" checked={config.showLogo} onChange={v => onChange({ showLogo: v })} />
          </div>
        </PanelSection>

        {config.mode !== 'slideshow' && (
          <PanelSection title="HUD statistiky" id="hud" active={activeSection} setActive={setActiveSection}>
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleRow label="Vzdálenost" checked={config.showDistance} onChange={v => onChange({ showDistance: v })} />
              <ToggleRow label="Čas" checked={config.showTime} onChange={v => onChange({ showTime: v })} />
              <ToggleRow label="Převýšení" checked={config.showElevation} onChange={v => onChange({ showElevation: v })} />
              <ToggleRow label="Rychlost" checked={config.showSpeed} onChange={v => onChange({ showSpeed: v })} />
              <ToggleRow label="Sport ikona" checked={config.showSportIcon} onChange={v => onChange({ showSportIcon: v })} />
            </div>
          </PanelSection>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)] flex items-center justify-between shrink-0">
        <span className="t-mono text-[10px] text-[var(--muted)]">PRESET · CUSTOM</span>
        <button className="text-xs text-[var(--muted)] hover:text-white transition-colors">Reset</button>
      </div>
    </aside>
  )
}
