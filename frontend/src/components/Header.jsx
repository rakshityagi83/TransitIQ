import { Bus, CircleAlert, CircleCheck } from 'lucide-react'

const VIEWS = [
  { id: 'planner', label: 'Journey Planner' },
  { id: 'analytics', label: 'Network Analytics' },
  { id: 'about', label: 'About & Methodology' },
]

export default function Header({ view, onView, health, healthState }) {
  const online = healthState === 'online' && health?.status === 'healthy'
  const statusText = healthState === 'checking'
    ? 'Checking backend'
    : online
      ? 'Backend connected'
      : 'Backend unavailable'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/70 bg-[#080f1c]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300">
            <Bus aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">TransitIQ</p>
            <p className="text-sm text-slate-400">Travel smarter. Ride comfortably.</p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex flex-wrap gap-2">
          {VIEWS.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onView(item.id)}
                className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-teal-400 text-[#06221e]'
                    : 'border border-slate-600/80 text-slate-200 hover:border-teal-400/50'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <p
          role="status"
          className={`inline-flex items-center gap-2 text-sm ${online ? 'text-emerald-300' : 'text-slate-300'}`}
        >
          {online ? (
            <CircleCheck aria-hidden="true" className="size-4" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-4" />
          )}
          <span>
            {statusText}
            {online && health?.bus_stops != null
              ? ` · ${Number(health.bus_stops).toLocaleString('en-IN')} stops`
              : ''}
            {online && health?.crowding_profiles != null
              ? ` · ${Number(health.crowding_profiles).toLocaleString('en-IN')} profiles`
              : ''}
          </span>
        </p>
      </div>
    </header>
  )
}
