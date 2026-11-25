import { useEffect, useState } from 'react'
import { getAnalytics } from '../api/client'

const STAGES = [
  'Official GTFS and ONDC ticketing data',
  'Preprocessing',
  'Historical demand-frequency model',
  'DuckDB',
  'Journey routing',
  'Confidence-aware ranking',
  'FastAPI',
  'React',
]

const DISCLOSURES = [
  'ETM data has not been integrated.',
  'ONDC ticketing represents partial passenger demand.',
  'Crowdedness scores are relative indices, not occupancy percentages.',
  'Confidence reflects historical data support, not a calibrated probability of how full a bus will be.',
  'Journey timings are scheduled from static GTFS, not live vehicle positions.',
  'Routing supports direct journeys and one-transfer journeys that share a stop.',
  'Map geometry is based on scheduled stop coordinates and does not follow the road network.',
  'Model evaluation measures recorded demand prediction, not actual onboard occupancy.',
]

export default function AboutView() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAnalytics(controller.signal)
      .then(setSummary)
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') return
        setError(requestError.message || 'Analytics metadata unavailable.')
      })
    return () => controller.abort()
  }, [])

  const dataset = summary?.dataset
  const model = summary?.model
  const capabilities = summary?.capabilities

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5">
        <h2 className="text-xl font-semibold text-white">About & Methodology</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          TransitIQ is a crowdedness-aware journey planner for Delhi buses, built for the Transport Stack Hackathon 2026.
          It ranks scheduled bus options using historical demand and GTFS frequency. It does not track live buses.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5" aria-labelledby="architecture-title">
        <h3 id="architecture-title" className="text-base font-semibold text-white">System architecture</h3>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {STAGES.map((stage, index) => (
            <li key={stage} className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1628] px-3 py-2 text-sm text-slate-200">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-xs text-teal-300">
                {index + 1}
              </span>
              {stage}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Official GTFS and ONDC ticketing data are preprocessed into queryable tables. A historical demand-frequency model
          estimates a relative crowdedness index. DuckDB serves those tables to the journey router, which searches direct
          and one-transfer itineraries. A confidence-aware ranker balances extra travel time against crowdedness, and FastAPI
          returns the ranked options to this React app.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5" aria-labelledby="disclosure-title">
        <h3 id="disclosure-title" className="text-base font-semibold text-white">What the scores mean</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
          {DISCLOSURES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5" aria-labelledby="live-meta-title">
        <h3 id="live-meta-title" className="text-base font-semibold text-white">Current dataset and model</h3>
        {error ? <p className="mt-2 text-sm text-amber-200">{error}</p> : null}
        {!summary && !error ? <p className="mt-2 text-sm text-slate-400">Loading summary…</p> : null}
        {summary ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Data source</dt>
              <dd className="text-slate-100">{dataset?.data_source || model?.data_source || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Ticket window</dt>
              <dd className="text-slate-100">
                {dataset?.date_start && dataset?.date_end ? `${dataset.date_start} to ${dataset.date_end}` : '—'}
                {dataset?.timezone ? ` (${dataset.timezone})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Model</dt>
              <dd className="text-slate-100">{model?.model || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Evaluation target</dt>
              <dd className="text-slate-100">{model?.validation_target || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Occupancy percentage</dt>
              <dd className="text-slate-100">
                {model?.is_actual_occupancy_percentage === false
                  ? 'No. The index is not an occupancy percentage.'
                  : model?.is_actual_occupancy_percentage === true
                    ? 'Reported as an occupancy percentage.'
                    : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">ETM integrated</dt>
              <dd className="text-slate-100">
                {dataset?.etm_available === false || model?.etm_available === false || capabilities?.etm_integrated === false
                  ? 'No'
                  : dataset?.etm_available === true
                    ? 'Yes'
                    : '—'}
              </dd>
            </div>
          </dl>
        ) : null}

        {capabilities ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {Object.entries(capabilities).map(([key, value]) => (
              <li key={key} className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">
                {key.replaceAll('_', ' ')}: {value ? 'yes' : 'no'}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
