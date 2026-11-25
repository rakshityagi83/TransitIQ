import { useState } from 'react'
import { ArrowLeftRight, LoaderCircle, Search } from 'lucide-react'
import { getStop, planJourney } from '../api/client'
import {
  DEMO_DATE,
  DEMO_TIME,
  istDeparture,
  preferenceName,
  RECOMMENDATION_LABELS,
  RECOMMENDATION_ORDER,
} from '../utils/format'
import StopField from './StopField'
import JourneyCard from './JourneyCard'
import JourneyDetail from './JourneyDetail'
import JourneyMap from './JourneyMap'

const DEMOS = {
  direct: { originId: '1', destinationId: '26', label: 'Direct comparison' },
  transfer: { originId: '1', destinationId: '1025', label: 'Transfer journey' },
}

export default function JourneyPlanner() {
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [date, setDate] = useState(DEMO_DATE)
  const [time, setTime] = useState(DEMO_TIME)
  const [comfort, setComfort] = useState(0.5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const journeys = Array.isArray(result?.journeys) ? result.journeys : []
  const selected = journeys.find((journey) => journey.trip_id === selectedId) || null

  async function submitPlan(next) {
    const planOrigin = next?.origin ?? origin
    const planDestination = next?.destination ?? destination
    const planDate = next?.date ?? date
    const planTime = next?.time ?? time
    const planComfort = next?.comfort ?? comfort

    if (!planOrigin?.stop_id || !planDestination?.stop_id) {
      setError('Select an origin and a destination from the stop search.')
      return
    }
    if (String(planOrigin.stop_id) === String(planDestination.stop_id)) {
      setError('Origin and destination must be two different stops.')
      return
    }
    if (!planDate || !planTime) {
      setError('Choose a departure date and time.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setSelectedId(null)

    try {
      const data = await planJourney({
        origin_stop_id: String(planOrigin.stop_id),
        destination_stop_id: String(planDestination.stop_id),
        departure_time: istDeparture(planDate, planTime),
        comfort_weight: Number(planComfort),
        limit: 5,
      })
      setResult(data)
      const first = Array.isArray(data?.journeys) ? data.journeys[0] : null
      setSelectedId(first?.trip_id ?? null)
    } catch (requestError) {
      setError(requestError.message || 'Backend unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function runDemo(kind) {
    const demo = DEMOS[kind]
    setDate(DEMO_DATE)
    setTime(DEMO_TIME)
    setComfort(0.5)
    setLoading(true)
    setError('')
    try {
      const [originStop, destinationStop] = await Promise.all([
        getStop(demo.originId),
        getStop(demo.destinationId),
      ])
      setOrigin(originStop)
      setDestination(destinationStop)
      await submitPlan({
        origin: originStop,
        destination: destinationStop,
        date: DEMO_DATE,
        time: DEMO_TIME,
        comfort: 0.5,
      })
    } catch (requestError) {
      setError(requestError.message || 'Backend unavailable.')
      setLoading(false)
    }
  }

  function swapStops() {
    setOrigin(destination)
    setDestination(origin)
  }

  function selectRecommendation(key) {
    const tripId = result?.recommendations?.[key]
    if (!tripId) return
    setSelectedId(tripId)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
  Crowdedness-aware journey planning
</p>

<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
  Plan a smarter journey.
</h2>
            <p className="mt-1 text-sm text-slate-400">
              Compare scheduled Delhi bus options by travel time and relative crowdedness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DEMOS).map(([key, demo]) => (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => runDemo(key)}
                className="rounded-full border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-teal-400/70 disabled:opacity-50"
              >
                {demo.label}
              </button>
            ))}
          </div>
        </div>

        <form
          className="mt-7 space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            submitPlan()
          }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
            <StopField
              label="Origin"
              stop={origin}
              onSelect={setOrigin}
              placeholder="Search origin stop"
            />
            <button
              type="button"
              onClick={swapStops}
              aria-label="Swap origin and destination"
              className="mt-7 inline-flex size-11 items-center justify-center justify-self-center rounded-full border border-slate-600 text-slate-200 hover:border-teal-400/70"
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" />
            </button>
            <StopField
              label="Destination"
              stop={destination}
              onSelect={setDestination}
              placeholder="Search destination stop"
            />
          </div>

          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="departure-date" className="mb-1.5 block text-sm font-medium text-slate-200">
                Departure date
              </label>
              <input
                id="departure-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-slate-600/80 bg-[#0b1424] px-3 py-2.5 text-sm text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="departure-time" className="mb-1.5 block text-sm font-medium text-slate-200">
                Departure time (IST)
              </label>
              <input
                id="departure-time"
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full rounded-xl border border-slate-600/80 bg-[#0b1424] px-3 py-2.5 text-sm text-slate-100"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Date and time are sent as Asia/Kolkata (IST). Timings returned by the planner are scheduled, not live.
          </p>

          <div className="max-w-3xl rounded-xl border border-slate-800 bg-[#0b1424] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="comfort-weight" className="text-sm font-medium text-slate-200">
                Comfort preference
              </label>
              <span className="text-sm text-teal-300">{preferenceName(comfort)} · {comfort.toFixed(2)}</span>
            </div>
            <input
              id="comfort-weight"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={comfort}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={comfort}
              aria-valuetext={`${preferenceName(comfort)} ${comfort.toFixed(2)}`}
              onChange={(event) => setComfort(Number(event.target.value))}
              className="h-2 w-full cursor-pointer"
            />
            <div className="mt-1 grid grid-cols-3 text-xs text-slate-400">
              <span className={comfort <= 0.33 ? 'text-teal-300' : ''}>Speed</span>
              <span className={`text-center ${comfort > 0.33 && comfort < 0.67 ? 'text-teal-300' : ''}`}>Balanced</span>
              <span className={`text-right ${comfort >= 0.67 ? 'text-teal-300' : ''}`}>Comfort</span>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
           className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-teal-400 px-8 py-3.5 text-base font-bold text-[#042f2e] shadow-[0_4px_20px_rgba(20,184,166,0.18)] hover:bg-teal-300 disabled:opacity-60 sm:w-auto"
          >
            {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Search aria-hidden="true" className="size-4" />}
            {loading ? 'Finding journeys…' : 'Find Journeys'}
          </button>
        </form>
      </section>

      {result ? (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Journey comparison</h2>
              <p className="mt-1 text-sm text-slate-400">
                {result.status === 'no_journeys'
                  ? (result.message || 'No scheduled journeys were found in the search window.')
                  : `${result.total_candidates ?? journeys.length} candidates considered · ${journeys.length} shown`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDATION_ORDER.map((key) => {
                const tripId = result.recommendations?.[key]
                const active = tripId && tripId === selectedId
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!tripId}
                    aria-pressed={Boolean(active)}
                    onClick={() => selectRecommendation(key)}
                    className={`rounded-full px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? 'bg-teal-400 text-[#06221e]'
                        : 'border border-slate-600 text-slate-200 hover:border-teal-400/70'
                    }`}
                  >
                    {RECOMMENDATION_LABELS[key]}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-sm text-slate-400">
            Crowdedness is a relative index from 0 to 100, not an occupancy percentage. Unknown predictions are shown as unknown, not zero.
          </p>

          {journeys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#111c2e] px-4 py-10 text-center text-sm text-slate-400">
              {result.message || 'No journeys found for this departure.'}
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <div className="space-y-3">
                {journeys.map((journey) => (
                  <JourneyCard
                    key={journey.trip_id}
                    journey={journey}
                    selected={journey.trip_id === selectedId}
                    onSelect={() => setSelectedId(journey.trip_id)}
                  />
                ))}
              </div>
              <div className="min-w-0 space-y-5">
  <JourneyMap journey={selected} />
  <JourneyDetail journey={selected} />
</div>
            </div>
          )}

          {result.metadata ? (
            <p className="text-xs leading-5 text-slate-500">
              {result.metadata.timing_source ? `Timings: ${result.metadata.timing_source}. ` : ''}
              {result.metadata.crowding_source ? `Crowding: ${result.metadata.crowding_source}. ` : ''}
              {result.metadata.routing_scope ? `${result.metadata.routing_scope}.` : ''}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
