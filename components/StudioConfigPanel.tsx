'use client'
import { StoryConfig, ActivityStoryData } from '@/components/StoryGenerator/storyTypes'

interface StudioConfigPanelProps {
  config: StoryConfig
  data: ActivityStoryData
  onChange: (patch: Partial<StoryConfig>) => void
  disabled?: boolean
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10 bg-white/5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-orange-500/20 text-orange-400 border-r border-orange-500/20'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all ${
        checked
          ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
          : 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'
      }`}
    >
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
      {label}
    </button>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-white/50 text-xs">{label}</span>
        <span className="text-white/80 text-xs font-medium">{value}{unit || ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/10 rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 cursor-pointer"
      />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-white/30 text-xs uppercase tracking-wider font-semibold mb-2">{children}</p>
}

function Divider() {
  return <div className="h-px bg-white/8 my-1" />
}

export function StudioConfigPanel({ config, data, onChange, disabled }: StudioConfigPanelProps) {
  const hasPhotos = (data.allPhotos?.length || 0) > 0

  const modeCards = [
    { id: '2d', label: '2D Story', icon: '🗺' },
    { id: '3d', label: '3D Fly-over', icon: '🏔' },
    { id: 'camera-follow', label: 'Kamera', icon: '📍' },
    { id: 'slideshow', label: 'Slideshow', icon: '🖼' },
  ] as const

  return (
    <div
      className={`flex flex-col gap-4 overflow-y-auto h-full p-4 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
    >
      {/* Sekce 1 — Režim */}
      <div>
        <SectionLabel>Režim</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {modeCards.map(m => (
            <button
              key={m.id}
              onClick={() => onChange({ mode: m.id })}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                config.mode === m.id
                  ? 'border-orange-500/45 bg-orange-500/6 text-white'
                  : 'border-white/8 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/80'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span className="text-xs">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Sekce 2 — Styl mapy / Pozadí */}
      <div>
        <SectionLabel>
          {config.mode === '2d' ? 'Pozadí' :
           config.mode === 'slideshow' ? 'Přechody' : 'Styl mapy'}
        </SectionLabel>

        {config.mode === '2d' && (
          <div className="flex flex-col gap-2">
            <SegmentedControl
              options={[
                { label: 'Gradient', value: 'gradient' },
                { label: 'Mapa', value: 'map' },
                { label: 'Fotka', value: 'photo' },
              ]}
              value={config.backgroundType}
              onChange={v => onChange({ backgroundType: v as StoryConfig['backgroundType'] })}
            />
            {config.backgroundType === 'gradient' && (
              <SegmentedControl
                options={[
                  { label: 'Night', value: 'night' },
                  { label: 'Forest', value: 'forest' },
                  { label: 'Sunset', value: 'sunset' },
                ]}
                value={config.gradientTheme}
                onChange={v => onChange({ gradientTheme: v as StoryConfig['gradientTheme'] })}
              />
            )}
            {config.backgroundType === 'map' && (
              <SegmentedControl
                options={[
                  { label: 'Standard', value: 'standard' },
                  { label: 'Topo', value: 'topo' },
                  { label: 'Dark', value: 'dark' },
                  { label: 'Satellite', value: 'satellite' },
                ]}
                value={config.mapStyle}
                onChange={v => onChange({ mapStyle: v as StoryConfig['mapStyle'] })}
              />
            )}
          </div>
        )}

        {config.mode === '3d' && (
          <SegmentedControl
            options={[
              { label: 'Satellite', value: 'satellite-3d' },
              { label: 'Outdoor', value: 'outdoor-3d' },
              { label: 'Dark', value: 'dark-3d' },
            ]}
            value={config.mapStyle3D}
            onChange={v => onChange({ mapStyle3D: v as StoryConfig['mapStyle3D'] })}
          />
        )}

        {config.mode === 'camera-follow' && (
          <SegmentedControl
            options={[
              { label: 'OSM', value: 'standard' },
              { label: 'Topo', value: 'topo' },
              { label: 'Dark', value: 'dark' },
              { label: 'Esri', value: 'esri' },
            ]}
            value={config.mapStyle}
            onChange={v => onChange({ mapStyle: v as StoryConfig['mapStyle'] })}
          />
        )}

        {config.mode === 'slideshow' && (
          <SegmentedControl
            options={[
              { label: 'Crossfade', value: 'crossfade' },
              { label: 'Slide', value: 'slide' },
              { label: 'Zoom', value: 'zoom' },
            ]}
            value={config.slideshowTransition}
            onChange={v => onChange({ slideshowTransition: v as StoryConfig['slideshowTransition'] })}
          />
        )}
      </div>

      <Divider />

      {/* Sekce 3 — Délka videa */}
      <div>
        <SectionLabel>Délka videa</SectionLabel>
        <Slider
          label="Délka"
          value={config.durationSeconds}
          min={config.mode === '2d' ? 4 : 3}
          max={config.mode === '2d' ? 15 : 30}
          step={1}
          unit=" s"
          onChange={v => onChange({ durationSeconds: v })}
        />
      </div>

      <Divider />

      {/* Sekce 4 — Kondicionální parametry */}
      {config.mode === '3d' && (
        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3">
          <SectionLabel>3D parametry</SectionLabel>
          <div className="flex flex-col gap-3">
            <Slider
              label="Náklon (pitch)"
              value={config.cameraPitch}
              min={30} max={75} step={5} unit="°"
              onChange={v => onChange({ cameraPitch: v })}
            />
            <Slider
              label="Výška (altitude)"
              value={config.cameraAltitude}
              min={200} max={3000} step={100} unit=" m"
              onChange={v => onChange({ cameraAltitude: v })}
            />
            <Slider
              label="Terén (exaggeration)"
              value={config.terrainExaggeration}
              min={0.5} max={3.0} step={0.1} unit="×"
              onChange={v => onChange({ terrainExaggeration: v })}
            />
          </div>
        </div>
      )}

      {config.mode === 'camera-follow' && (
        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3">
          <SectionLabel>Viewport</SectionLabel>
          <Slider
            label="Zobrazená oblast"
            value={config.cfViewportKm}
            min={10} max={50} step={5} unit=" km"
            onChange={v => onChange({ cfViewportKm: v })}
          />
          <p className="text-white/25 text-xs mt-1.5">detail ←→ přehled</p>
        </div>
      )}

      {(config.mode === '3d' || config.mode === 'camera-follow') && <Divider />}

      {/* Sekce 5 — Vrstvy */}
      <div>
        <SectionLabel>Vrstvy</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {config.mode === '2d' && (
            <>
              <Toggle label="Elevační profil" checked={config.showElevationProfile} onChange={v => onChange({ showElevationProfile: v })} />
              <Toggle label="Km markery" checked={config.showKmMarkers} onChange={v => onChange({ showKmMarkers: v })} />
            </>
          )}
          {config.mode === '3d' && (
            <Toggle label="Hillshade" checked={config.showHillshade} onChange={v => onChange({ showHillshade: v })} />
          )}
          {config.mode === 'camera-follow' && (
            <>
              <Toggle label="Ghost trail" checked={config.cfShowGhostTrail} onChange={v => onChange({ cfShowGhostTrail: v })} />
              <Toggle label="Km markery" checked={config.showKmMarkers} onChange={v => onChange({ showKmMarkers: v })} />
            </>
          )}
          {hasPhotos && config.mode !== 'slideshow' && (
            <Toggle label="Foto pauzy" checked={config.showTrailPhotos} onChange={v => onChange({ showTrailPhotos: v })} />
          )}
          <Toggle label="Safe zones" checked={config.enableSafeZones} onChange={v => onChange({ enableSafeZones: v })} />
          <Toggle label="Logo" checked={config.showLogo} onChange={v => onChange({ showLogo: v })} />
        </div>
      </div>

      {/* Sekce 6 — HUD statistiky (skryté pro Slideshow) */}
      {config.mode !== 'slideshow' && (
        <>
          <Divider />
          <div>
            <SectionLabel>Statistiky v HUD</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Toggle label="Vzdálenost" checked={config.showDistance} onChange={v => onChange({ showDistance: v })} />
              <Toggle label="Čas" checked={config.showTime} onChange={v => onChange({ showTime: v })} />
              <Toggle label="Převýšení" checked={config.showElevation} onChange={v => onChange({ showElevation: v })} />
              <Toggle label="Rychlost" checked={config.showSpeed} onChange={v => onChange({ showSpeed: v })} />
              <Toggle label="Sport ikona" checked={config.showSportIcon} onChange={v => onChange({ showSportIcon: v })} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
