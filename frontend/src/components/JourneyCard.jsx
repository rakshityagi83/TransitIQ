
import {
  BusFront,
  Clock,
  ArrowRight,
  ArrowRightLeft,
  Timer,
  MapPinned,
  CheckCircle2,
  Users,
  Zap,
  Armchair,
  Scale
} from 'lucide-react'

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
  low: 'text-emerald-300',
  moderate: 'text-amber-300',
  high: 'text-red-300',
  unknown: 'text-slate-400',
}

const BAR_CLASS = {
  low: 'bg-emerald-400',
  moderate: 'bg-amber-400',
  high: 'bg-red-400',
  unknown: 'bg-slate-600',
}

const BADGES = {
  fastest: {
    icon: Zap,
    style: 'bg-sky-400/10 text-sky-300'
  },
  least_crowded: {
    icon: Armchair,
    style: 'bg-emerald-400/10 text-emerald-300'
  },
  balanced: {
    icon: Scale,
    style: 'bg-violet-400/10 text-violet-300'
  }
}

export default function JourneyCard({
  journey,
  selected,
  onSelect
}) {

  const tone = crowdingTone(
    journey.crowding_index,
    journey.crowding_level
  )

  const labels = recommendationLabels(
    journey.recommendations
  )

  const indexText = formatCrowdingIndex(
    journey.crowding_index,
    journey.crowding_level
  )

  const known =
    journey.crowding_index != null &&
    Number.isFinite(Number(journey.crowding_index))

  const progress = known
    ? Math.max(0, Math.min(100, Number(journey.crowding_index)))
    : 0

  return (
    <article
      className={`rounded-2xl border bg-[#111c2e] p-5 transition-all ${
        selected
          ? 'border-teal-400/80 shadow-[0_0_24px_rgba(20,184,166,0.08)]'
          : 'border-slate-800 hover:border-slate-600'
      }`}
    >

      <div className="flex flex-wrap gap-2">
        {labels.map((label) => {
          const badge = BADGES[label]
          const Icon = badge?.icon || CheckCircle2

          return (
            <span
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                badge?.style || 'bg-slate-800 text-slate-300'
              }`}
            >
              <Icon className="size-3.5" />
              {RECOMMENDATION_LABELS[label] || label}
            </span>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">

        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300">
          <BusFront className="size-6" />
        </div>

        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold text-white">
            {journey.route_name || 'Unnamed route'}
          </h3>

          <p className="text-xs text-slate-400">
            {journey.transfers > 0
              ? '1 bus transfer'
              : 'Direct journey'}
          </p>
        </div>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-xl border border-slate-800 bg-[#0b1424] p-3">

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="size-3.5" />
            Total duration
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            {formatMinutes(journey.duration_minutes)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-300">
            {formatClock(journey.departure_time)}
            <ArrowRight className="size-3" />
            {formatClock(journey.arrival_time)}
          </div>

        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b1424] p-3">

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="size-3.5" />
            Crowdedness
          </p>

          <p className={`mt-2 text-2xl font-bold ${TONE_CLASS[tone]}`}>
            {known ? indexText : 'Unknown'}
          </p>

          {known && (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700"
              role="meter"
              aria-label="Relative crowdedness index"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className={`h-full rounded-full ${BAR_CLASS[tone]}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <p className={`mt-2 text-xs font-medium ${TONE_CLASS[tone]}`}>
            {formatCrowdingLevel(
              journey.crowding_index,
              journey.crowding_level
            )}
          </p>

        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">

        <div>
          <dt className="text-xs text-slate-400">
            Initial wait
          </dt>
          <dd className="mt-1 font-medium text-white">
            {formatMinutes(journey.waiting_minutes)}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-400">
            In vehicle
          </dt>
          <dd className="mt-1 font-medium text-white">
            {formatMinutes(journey.travel_minutes)}
          </dd>
        </div>

        {journey.transfers > 0 && (
          <div>
            <dt className="flex items-center gap-1 text-xs text-slate-400">
              <Timer className="size-3.5" />
              Transfer wait
            </dt>

            <dd className="mt-1 font-medium text-white">
              {formatMinutes(journey.transfer_wait_minutes)}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-xs text-slate-400">
            Prediction confidence
          </dt>
          <dd className="mt-1 font-medium text-white">
            {formatConfidence(journey.confidence)}
          </dd>
        </div>

      </dl>

      {journey.transfers > 0 &&
        journey.transfer_stop?.stop_name && (

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-400/15 bg-violet-400/5 p-3 text-xs text-violet-200">

            <ArrowRightLeft className="size-4 shrink-0" />

            <span>
              Change at {journey.transfer_stop.stop_name}
            </span>

          </div>
      )}

      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${
          selected
            ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
            : 'border-slate-700 text-slate-200 hover:border-teal-400/70'
        }`}
      >
        {selected
          ? <CheckCircle2 className="size-4" />
          : <MapPinned className="size-4" />
        }

        {selected
          ? 'Currently viewing'
          : 'View route and stops'}
      </button>

    </article>
  )
}
