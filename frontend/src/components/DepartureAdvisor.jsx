
import { useEffect, useRef, useState } from 'react'
import { Clock, Sparkles, ArrowRight, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { getDepartureAdvice } from '../api/client'

function formatTime(value) {
  if (!value) return '—'

  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })
}

function crowdColor(value) {
  if (value == null) return 'text-slate-400'
  if (value <= 35) return 'text-emerald-400'
  if (value <= 70) return 'text-amber-400'
  return 'text-red-400'
}

function crowdBar(value) {
  if (value <= 35) return 'bg-emerald-400'
  if (value <= 70) return 'bg-amber-400'
  return 'bg-red-400'
}

function JourneySummary({ journey, label }) {
  if (!journey) return null

  const index = journey.crowding_index

  return (
    <div className="rounded-xl border border-slate-700 bg-[#0b1424] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <h4 className="mt-2 text-lg font-semibold text-white">
        {journey.route_name}
      </h4>

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
        {formatTime(journey.departure_time)}
        <ArrowRight className="size-4" />
        {formatTime(journey.arrival_time)}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Expected crowdedness index
      </div>

      <div className={`text-3xl font-bold ${crowdColor(index)}`}>
        {index == null ? 'Unknown' : index.toFixed(1)}
        {index != null && (
          <span className="text-sm text-slate-500"> / 100</span>
        )}
      </div>

      {index != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${crowdBar(index)}`}
            style={{ width: `${index}%` }}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">Total elapsed time</p>
          <p className="font-medium text-white">
            {journey.total_elapsed_minutes} min
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Confidence</p>
          <p className="font-medium capitalize text-white">
            {journey.confidence}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Transfers</p>
          <p className="text-slate-200">{journey.transfers}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Boarding time</p>
          <p className="text-slate-200">
            {formatTime(journey.departure_time)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DepartureAdvisor({ payload }) {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const controllerRef = useRef(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  async function analyse() {
    controllerRef.current?.abort()

    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError('')
    setAdvice(null)

    try {
      const result = await getDepartureAdvice(
        payload,
        controller.signal
      )

      if (!controller.signal.aborted) {
        setAdvice(result)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Departure analysis failed.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  const baseline = advice?.baseline
  const recommended = advice?.recommendation

  const reduction =
    recommended && baseline?.crowding_index > 0
      ? (
          recommended.crowding_reduction_points
          / baseline.crowding_index
        ) * 100
      : null

  return (
    <section className="space-y-5 rounded-2xl border border-teal-500/30 bg-[#111c2e] p-4 sm:p-5">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-teal-400" />

            <h2 className="text-xl font-semibold text-white">
              Smart Departure Advisor
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Discover whether leaving later could make your
            selected commute more comfortable.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || !payload}
          onClick={analyse}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-[#06221e] hover:bg-teal-400 disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Clock className="size-4" />
          )}

          {loading
            ? 'Analysing departures...'
            : 'Find a Better Departure'}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!advice && !loading && !error && (
        <p className="text-sm text-slate-500">
          Compare up to five departure windows using historical
          passenger demand and scheduled bus timings.
        </p>
      )}

      {advice && (
        <div className="space-y-5" aria-live="polite">

          <p className="text-sm text-slate-300">
            {advice.total_candidates ?? 0} journey candidates analysed.
          </p>

          {recommended && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
              <div className="flex items-center gap-2 text-teal-300">
                <CheckCircle2 className="size-5" />

                <h3 className="font-semibold">
                  Better departure identified
                </h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">
                    Lower crowdedness index
                  </p>

                  <p className="text-2xl font-bold text-emerald-400">
                    {recommended.crowding_reduction_points} pts
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Relative index reduction
                  </p>

                  <p className="text-2xl font-bold text-emerald-400">
                    {reduction == null ? '—' : `${reduction.toFixed(1)}%`}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Arrival time difference
                  </p>

                  <p className="text-2xl font-bold text-white">
                    {recommended.additional_time_minutes > 0 ? '+' : ''}
                    {recommended.additional_time_minutes} min
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300">
                Be ready to depart at{' '}
                <strong className="text-white">
                  {formatTime(recommended.requested_departure)}
                </strong>
                {' '}for the scheduled{' '}
                <strong className="text-white">
                  {formatTime(recommended.departure_time)}
                </strong>
                {' '}bus.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <JourneySummary
              journey={baseline}
              label="Original recommendation"
            />

            <JourneySummary
              journey={recommended}
              label="Suggested alternative"
            />
          </div>

          {!recommended && (
            <div className="rounded-xl border border-slate-700 bg-[#0b1424] p-4 text-sm text-slate-300">
              {advice.message}
            </div>
          )}

          {advice.windows?.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold text-white">
                Departure window comparison
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-xs text-slate-400">
                    <tr>
                      <th className="p-3">Ready at</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Boarding</th>
                      <th className="p-3">Crowding</th>
                      <th className="p-3">Confidence</th>
                      <th className="p-3">Total time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {advice.windows.map((window) => {
                      const journey = window.journey
                      const suggested =
                        recommended &&
                        recommended.window_offset_minutes ===
                          window.window_offset_minutes

                      return (
                        <tr
                          key={window.window_offset_minutes}
                          className={`border-b border-slate-800 ${
                            suggested ? 'bg-teal-500/10' : ''
                          }`}
                        >
                          <td className="whitespace-nowrap p-3 font-medium text-white">
                            {formatTime(window.requested_departure)}
                          </td>

                          <td className="p-3 text-slate-300">
                            {journey?.route_name ?? 'Unavailable'}
                          </td>

                          <td className="p-3 text-slate-300">
                            {formatTime(journey?.departure_time)}
                          </td>

                          <td className={`p-3 font-semibold ${crowdColor(journey?.crowding_index)}`}>
                            {journey?.crowding_index ?? '—'}
                          </td>

                          <td className="p-3 capitalize text-slate-300">
                            {journey?.confidence ?? '—'}
                          </td>

                          <td className="whitespace-nowrap p-3 text-slate-300">
                            {journey
                              ? `${journey.total_elapsed_minutes} min`
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Multiple windows may recommend the same scheduled
                bus. Total time includes any delay relative to your
                original requested departure.
              </p>
            </div>
          )}

          <p className="text-xs leading-5 text-slate-500">
            Predictions use historical ONDC ticketing data and static
            GTFS schedules. Crowdedness is a relative index, not an
            actual occupancy percentage. Confidence indicates
            historical data support. All displayed times are IST.
          </p>
        </div>
      )}
    </section>
  )
}
