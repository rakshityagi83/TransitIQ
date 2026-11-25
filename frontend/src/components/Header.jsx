
import {
  BusFront,
  Route,
  ChartNoAxesCombined,
  Info,
  CircleAlert,
  Database,
  MapPin
} from 'lucide-react'

const VIEWS = [
  {
    id: 'planner',
    label: 'Journey Planner',
    icon: Route
  },
  {
    id: 'analytics',
    label: 'Network Analytics',
    icon: ChartNoAxesCombined
  },
  {
    id: 'about',
    label: 'Methodology',
    icon: Info
  },
]

export default function Header({
  view,
  onView,
  health,
  healthState
}) {
  const online =
    healthState === 'online' &&
    health?.status === 'healthy'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#080f1c]/95 backdrop-blur-xl">

      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">

        <div className="flex items-center gap-3">

          <div className="brand-logo flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <BusFront
              aria-hidden="true"
              className="size-7 text-[#042f2e]"
            />
          </div>

          <div>
            <div className="text-2xl font-bold tracking-tight text-white">
              Transit<span className="text-teal-400">IQ</span>
            </div>

            <p className="text-xs tracking-wide text-slate-400">
              Intelligent urban mobility
            </p>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="order-3 flex w-full flex-wrap gap-1 rounded-xl border border-slate-800 bg-[#111c2e] p-1 lg:order-none lg:w-auto"
        >

          {VIEWS.map((item) => {
            const active = view === item.id
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onView(item.id)}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
                  active
                    ? 'bg-teal-400 text-[#042f2e] shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4"
                />
                {item.label}
              </button>
            )
          })}

        </nav>

        <div
          role="status"
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
            online
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}
        >

          {online ? (
            <span className="size-2 rounded-full bg-emerald-400" />
          ) : (
            <CircleAlert className="size-4" />
          )}

          {healthState === 'checking'
            ? 'Connecting'
            : online
              ? 'Backend online'
              : 'Backend unavailable'}

        </div>

      </div>

      <div className="border-t border-slate-800/70 bg-[#0d1625]">

        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-xs text-slate-400 sm:px-8">

          <span className="flex items-center gap-2">
            <MapPin className="size-3.5 text-teal-400" />
            Delhi Bus Network
          </span>

          {online && health?.bus_stops != null && (
            <span>
              <strong className="font-medium text-slate-200">
                {Number(health.bus_stops).toLocaleString('en-IN')}
              </strong>
              {' '}bus stops
            </span>
          )}

          {online && health?.crowding_profiles != null && (
            <span className="flex items-center gap-2">

              <Database className="size-3.5 text-teal-400" />

              <strong className="font-medium text-slate-200">
                {Number(health.crowding_profiles).toLocaleString('en-IN')}
              </strong>

              historical profiles
            </span>
          )}

          <span className="hidden text-slate-500 sm:ml-auto sm:block">
            Transport Stack Hackathon 2026
          </span>

        </div>

      </div>

    </header>
  )
}
