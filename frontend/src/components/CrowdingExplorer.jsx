
import { useEffect, useState } from 'react'
import {
  Search,
  Clock,
  TrendingUp,
  ShieldCheck,
  BusFront,
  LoaderCircle,
  BarChart3,
} from 'lucide-react'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

import {
  searchRoutes,
  getCrowdingProfile,
} from '../api/client'


const COLORS = {
  low: '#14b8a6',
  moderate: '#f59e0b',
  high: '#ef4444',
  unknown: '#64748b',
}

const TOOLTIP = {
  backgroundColor: '#0b1424',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
}


function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}


function hourWindow(hour) {
  return `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`
}


function formatValue(value) {
  return value == null ? '—' : value
}


function reliable(row) {
  return (
    row.crowding_index != null &&
    ['high', 'medium'].includes(row.confidence)
  )
}


function normalizeProfile(profile) {
  const byHour = new Map(
    (profile || []).map((row) => [row.hour, row])
  )

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    crowding_index: null,
    crowding_level: 'unknown',
    confidence: 'unavailable',
    avg_passengers: null,
    scheduled_trips: null,
    ...byHour.get(hour),
  }))
}


function Stat({ icon: Icon, label, value, hint, color }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Icon className="size-4 text-teal-400" />
        {label}
      </div>

      <p className={`mt-3 text-xl font-bold ${color || 'text-white'}`}>
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {hint}
      </p>
    </div>
  )
}


function ChartCard({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5">
      <h3 className="font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {subtitle}
      </p>

      <div className="mt-5 h-[300px]">
        {children}
      </div>
    </section>
  )
}


export default function CrowdingExplorer() {

  const [query, setQuery] = useState('102DOWN')
  const [routes, setRoutes] = useState([])
  const [route, setRoute] = useState(null)

  const [dayType, setDayType] = useState('weekday')

  const [profiles, setProfiles] = useState(null)

  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)

  const [searchError, setSearchError] = useState('')
  const [profileError, setProfileError] = useState('')


  // Route search with debounce and cancellation.

  useEffect(() => {
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')

      try {
        const result = await searchRoutes(
          query.trim(),
          20,
          controller.signal
        )

        if (!controller.signal.aborted) {
          setRoutes(result.routes || [])
        }

      } catch (error) {

        if (!controller.signal.aborted) {
          setSearchError(error.message)
          setRoutes([])
        }

      } finally {

        if (!controller.signal.aborted) {
          setSearching(false)
        }
      }

    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }

  }, [query])


  // Load both profiles when a route is selected.

  useEffect(() => {
    if (!route) return

    const controller = new AbortController()

    async function loadProfiles() {
      setLoading(true)
      setProfileError('')
      setProfiles(null)

      try {
        const [weekday, weekend] = await Promise.all([
          getCrowdingProfile(
            route.route_key,
            'weekday',
            controller.signal
          ),

          getCrowdingProfile(
            route.route_key,
            'weekend',
            controller.signal
          ),
        ])

        if (!controller.signal.aborted) {
          setProfiles({
            weekday: normalizeProfile(weekday.profile),
            weekend: normalizeProfile(weekend.profile),
          })
        }

      } catch (error) {

        if (!controller.signal.aborted) {
          setProfileError(error.message)
        }

      } finally {

        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadProfiles()

    return () => controller.abort()

  }, [route])


  function selectRoute(selected) {
    setProfiles(null)
    setProfileError('')
    setLoading(true)
    setRoute({ ...selected })
  }


  const activeProfile = profiles?.[dayType] || []

  const available = activeProfile.filter(
    (row) => row.crowding_index != null
  )

  const supported = available.filter(reliable)

  const sorted = [...supported].sort(
    (a, b) => a.crowding_index - b.crowding_index
  )

  const best = sorted[0]
  const peak = sorted[sorted.length - 1]

  const comparison = profiles
    ? profiles.weekday.map((row, index) => ({
        hour: row.label,
        weekday: row.crowding_index,
        weekend: profiles.weekend[index].crowding_index,
      }))
    : []


  return (
    <div className="space-y-6">

      <div>
        <div className="flex items-center gap-3">
          <BarChart3 className="size-6 text-teal-400" />

          <h2 className="text-2xl font-semibold text-white">
            Route Crowdedness Explorer
          </h2>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Discover historical crowdedness patterns across Delhi
          bus routes and identify more comfortable travel hours.
        </p>
      </div>


      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5">

        <label
          htmlFor="route-search"
          className="text-sm font-medium text-slate-200"
        >
          Search a bus route
        </label>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-3.5 size-4 text-slate-500" />

          <input
            id="route-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 102DOWN, 717AUP, 764..."
            className="w-full rounded-xl border border-slate-600 bg-[#0b1424] py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-teal-400"
          />
        </div>

        {searching && (
          <p className="mt-3 text-sm text-slate-400">
            Searching routes...
          </p>
        )}

        {searchError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {searchError}
          </p>
        )}

        {!searching && !searchError && routes.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">
            No matching routes found.
          </p>
        )}

        <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">

          {routes.map((item) => (
            <button
              type="button"
              key={item.route_id}
              onClick={() => selectRoute(item)}
              className={`rounded-xl border p-3 text-left transition ${
                route?.route_id === item.route_id
                  ? 'border-teal-400 bg-teal-500/10'
                  : 'border-slate-700 bg-[#0b1424] hover:border-teal-400/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <BusFront className="size-4 text-teal-400" />

                <span className="font-semibold text-white">
                  {item.route_name}
                </span>
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                {item.description}
              </p>
            </button>
          ))}

        </div>
      </section>


      {!route && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
          Select a bus route to explore its historical patterns.
        </div>
      )}


      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-700 p-10 text-slate-300">
          <LoaderCircle className="size-5 animate-spin text-teal-400" />
          Loading historical profiles...
        </div>
      )}


      {profileError && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {profileError}
        </p>
      )}


      {route && profiles && !loading && (
        <>

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <h3 className="text-xl font-semibold text-white">
                {route.route_name}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                {route.description}
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-700 bg-[#0b1424] p-1">

              {['weekday', 'weekend'].map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={dayType === type}
                  onClick={() => setDayType(type)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                    dayType === type
                      ? 'bg-teal-400 text-[#06221e]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}

            </div>
          </div>


          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

            <Stat
              icon={Clock}
              label="Least crowded supported hour"
              value={best ? hourWindow(best.hour) : 'Unavailable'}
              hint={best
                ? `Index ${best.crowding_index}/100`
                : 'Insufficient historical support'}
              color="text-emerald-400"
            />

            <Stat
              icon={TrendingUp}
              label="Highest crowdedness hour"
              value={peak ? hourWindow(peak.hour) : 'Unavailable'}
              hint={peak
                ? `Index ${peak.crowding_index}/100`
                : 'Insufficient historical support'}
              color="text-amber-400"
            />

            <Stat
              icon={ShieldCheck}
              label="Supported predictions"
              value={`${supported.length}/24 hours`}
              hint="Medium or high historical confidence"
            />

            <Stat
              icon={BarChart3}
              label="Available predictions"
              value={`${available.length}/24 hours`}
              hint="Includes low-confidence estimates"
            />

          </div>


          {available.length === 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              No crowdedness predictions are available for this
              route and day type. Missing estimates are not
              interpreted as low crowdedness.
            </p>
          )}


          <ChartCard
            title="Hourly crowdedness profile"
            subtitle="Relative index from 0 to 100. Missing predictions appear as gaps."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeProfile}>

                <CartesianGrid
                  stroke="#334155"
                  vertical={false}
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval={2}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <Tooltip contentStyle={TOOLTIP} />

                <Bar
                  dataKey="crowding_index"
                  name="Crowdedness index"
                  radius={[4, 4, 0, 0]}
                >
                  {activeProfile.map((row) => (
                    <Cell
                      key={row.hour}
                      fill={COLORS[row.crowding_level] || COLORS.unknown}
                      fillOpacity={row.confidence === 'low' ? 0.45 : 1}
                    />
                  ))}
                </Bar>

              </BarChart>
            </ResponsiveContainer>
          </ChartCard>


          <div className="flex flex-wrap justify-center gap-5 text-xs text-slate-400">

            {['low', 'moderate', 'high'].map((level) => (
              <span
                key={level}
                className="flex items-center gap-2 capitalize"
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: COLORS[level] }}
                />

                {level}
              </span>
            ))}

            <span>Faded bars: low confidence</span>
            <span>Gaps: unknown</span>

          </div>


          <ChartCard
            title="Weekday versus weekend"
            subtitle="Compare the same route across working-day and weekend demand patterns."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparison}>

                <CartesianGrid
                  stroke="#334155"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="hour"
                  interval={2}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <Tooltip contentStyle={TOOLTIP} />
                <Legend />

                <Line
                  type="linear"
                  dataKey="weekday"
                  name="Weekday"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />

                <Line
                  type="linear"
                  dataKey="weekend"
                  name="Weekend"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />

              </LineChart>
            </ResponsiveContainer>
          </ChartCard>


          <div className="grid gap-4 lg:grid-cols-2">

            <ChartCard
              title="Recorded passenger demand"
              subtitle="Average hourly passengers recorded in ONDC ticketing."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeProfile}>

                  <CartesianGrid
                    stroke="#334155"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    interval={3}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />

                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />

                  <Tooltip contentStyle={TOOLTIP} />

                  <Bar
                    dataKey="avg_passengers"
                    name="Average recorded passengers"
                    fill="#38bdf8"
                    radius={[3, 3, 0, 0]}
                  />

                </BarChart>
              </ResponsiveContainer>
            </ChartCard>


            <ChartCard
              title="Scheduled bus frequency"
              subtitle="GTFS route-origin departures per hour, not observed arrivals."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeProfile}>

                  <CartesianGrid
                    stroke="#334155"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    interval={3}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />

                  <Tooltip contentStyle={TOOLTIP} />

                  <Bar
                    dataKey="scheduled_trips"
                    name="Scheduled departures"
                    fill="#a78bfa"
                    radius={[3, 3, 0, 0]}
                  />

                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>


          <section className="rounded-2xl border border-slate-700 bg-[#111c2e] p-5">

            <h3 className="font-semibold text-white">
              Hourly prediction details
            </h3>

            <div className="mt-4 max-h-[420px] overflow-auto">

              <table className="w-full text-left text-sm">

                <thead className="sticky top-0 bg-[#111c2e] text-xs text-slate-400">
                  <tr>
                    <th className="p-3">Hour</th>
                    <th className="p-3">Index</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Confidence</th>
                    <th className="p-3">Avg. passengers</th>
                    <th className="p-3">Departures</th>
                  </tr>
                </thead>

                <tbody>
                  {activeProfile.map((row) => (
                    <tr
                      key={row.hour}
                      className="border-b border-slate-800"
                    >

                      <td className="whitespace-nowrap p-3 text-white">
                        {row.label}
                      </td>

                      <td
                        className="p-3 font-semibold"
                        style={{
                          color: COLORS[row.crowding_level] || COLORS.unknown,
                        }}
                      >
                        {formatValue(row.crowding_index)}
                      </td>

                      <td className="p-3 capitalize text-slate-300">
                        {row.crowding_level}
                      </td>

                      <td className="p-3 capitalize text-slate-300">
                        {row.confidence}
                      </td>

                      <td className="p-3 text-slate-300">
                        {formatValue(row.avg_passengers)}
                      </td>

                      <td className="p-3 text-slate-300">
                        {formatValue(row.scheduled_trips)}
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>

            </div>
          </section>


          <p className="text-xs leading-6 text-slate-500">
            Based on October 2026 ONDC e-ticketing and static Delhi
            GTFS schedules. Crowdedness is a relative demand-frequency
            index, not measured bus occupancy. Confidence indicates
            historical data support. Missing frequency or ticketing
            profiles produce unknown estimates. Recommended hours
            are historical patterns, not guarantees of future
            service or seat availability. All times are IST.
          </p>

        </>
      )}

    </div>
  )
}
