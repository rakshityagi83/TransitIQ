import { Clock, ArrowRightLeft, Timer } from 'lucide-react'
import {
  crowdingTone,
  formatClock,
  formatConfidence,
  formatCrowdingIndex,
  formatCrowdingLevel,
  formatMinutes,
  recommendationLabels,
  RECOMMENDATION_LABELS,
} from '../utils/format'

const TONE_CLASS = {
  low: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  moderate: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  high: 'border-red-500/40 bg-red-500/15 text-red-300',
  unknown: 'border-slate-500/50 bg-slate-500/15 text-slate-300',
}

export default function JourneyCard({ journey, selected, onSelect }) {
  const tone = crowdingTone(journey.crowding_index, journey.crowding_level)
  const labels = recommendationLabels(journey.recommendations)
  const indexText = formatCrowdingIndex(journey.crowding_index, journey.crowding_level)

  return (
    <article
      className={`rounded-2xl border bg-[#111c2e] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-colors ${
        selected ? 'border-teal-400' : 'border-slate-700/80 hover:border-slate-500'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{journey.route_name || 'Unnamed route'}</h3>
          <p className="mt-1 text-xs tracking-wide text-slate-400 uppercase">
            {journey.journey_type === 'transfer' ? 'One transfer' : 'Direct'} · {journey.transfers ?? 0} transfer
            {journey.transfers === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {labels.map((label) => (
            <span key={label} className="rounded-full bg-teal-400/15 px-2 py-0.5 text-xs font-medium text-teal-200">
              {RECOMMENDATION_LABELS[label] || label}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-slate-100">
        <Clock aria-hidden="true" className="size-4 text-teal-300" />
        <span>
          {formatClock(journey.departure_time)}
          <span className="px-1.5 text-slate-500">→</span>
          {formatClock(journey.arrival_time)}
        </span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-400">Total duration</dt>
          <dd className="font-medium text-slate-100">{formatMinutes(journey.duration_minutes)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Initial wait</dt>
          <dd className="font-medium text-slate-100">{formatMinutes(journey.waiting_minutes)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">In vehicle</dt>
          <dd className="font-medium text-slate-100">{formatMinutes(journey.travel_minutes)}</dd>
        </div>
        {journey.transfers > 0 ? (
          <div>
            <dt className="flex items-center gap-1 text-slate-400">
              <Timer aria-hidden="true" className="size-3.5" />
              Transfer wait
            </dt>
            <dd className="font-medium text-slate-100">{formatMinutes(journey.transfer_wait_minutes)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-400">Crowdedness index</dt>
          <dd>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>
              {indexText} · {formatCrowdingLevel(journey.crowding_index, journey.crowding_level)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Prediction confidence</dt>
          <dd className="font-medium text-slate-100">{formatConfidence(journey.confidence)}</dd>
        </div>
      </dl>

      {journey.transfers > 0 && journey.transfer_stop?.stop_name ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <ArrowRightLeft aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Change at {journey.transfer_stop.stop_name}
        </p>
      ) : null}

      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="mt-4 w-full rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:border-teal-400/70 hover:text-white"
      >
        {selected ? 'Showing stops and legs' : 'Inspect stops and legs'}
      </button>
    </article>
  )
}
