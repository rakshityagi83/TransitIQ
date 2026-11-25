import { useEffect, useState } from 'react'
import {
  TrendingDown,
  Activity,
  Database,
  ChartNoAxesCombined,
  ShieldCheck
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAnalytics } from '../api/client'
import { formatCount, formatDecimal, formatPercent, titleFromKey } from '../utils/format'

const CHART = {
  grid: '#1e293b',
  tick: '#94a3b8',
  tooltip: {
    background: '#111c2e',
    border: '1px solid #334155',
    borderRadius: 12,
    color: '#e2e8f0',
  },
}

const LEVEL_COLORS = {
  low: '#34d399',
  moderate: '#fbbf24',
  high: '#f87171',
  unknown: '#94a3b8',
}

function numberOrNull(value) {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value)
}

function entries(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return []
  return Object.entries(record).map(([key, value]) => ({
    key,
    label: titleFromKey(key),
    value: numberOrNull(value),
  }))
}

function Stat({ label, value, hint, featured = false }) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 transition-colors ${
        featured
          ? 'border-teal-400/30 bg-teal-400/5'
          : 'border-slate-800 bg-[#111c2e] hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2">

        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </h3>

        {featured && (
          <TrendingDown className="size-5 text-teal-400" />
        )}

      </div>

      <p className={`mt-3 text-3xl font-bold tracking-tight ${
        featured ? 'text-teal-300' : 'text-white'
      }`}>
        {value}
      </p>

      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {hint}
        </p>
      )}

    </article>
  )
}

function ChartCard({ title, children, empty }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#111c2e] p-5 sm:p-6">

      <div className="mb-5 flex items-center gap-2">

        <ChartNoAxesCombined className="size-5 text-teal-400" />

        <h3 className="text-base font-semibold text-white">
          {title}
        </h3>

      </div>

      {empty ? (
        <p className="text-sm text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="h-72">
          {children}
        </div>
      )}

    </section>
  )
}

export default function AnalyticsView() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getAnalytics(controller.signal)
      .then((data) => {
        setSummary(data)
        setError('')
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') return
        setError(requestError.message || 'Analytics metadata unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  if (loading) {
    return <p className="text-sm text-slate-400">Loading network analytics…</p>
  }

  if (error || !summary) {
    return (
      <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        {error || 'Analytics metadata unavailable.'}
      </p>
    )
  }

  const dataset = summary.dataset || {}
  const model = summary.model || {}
  const validation = summary.validation
  const validationModel = validation?.model && typeof validation.model === 'object' ? validation.model : null
  const baseline = validation?.baseline && typeof validation.baseline === 'object' ? validation.baseline : null
  const metrics = validationModel || model

  const hourly = Array.isArray(validation?.hourly_demand)
    ? validation.hourly_demand.map((row) => ({
      hour: row.hour,
      passengers: numberOrNull(row.avg_passengers),
    }))
    : []

  const dayType = entries(validation?.day_type_demand).map((row) => ({
    label: row.label,
    passengers: row.value,
  }))

  const crowding = entries(validation?.crowding_distribution)
  const confidence = entries(validation?.confidence_distribution)

  const comparison = validationModel && baseline
    ? [
      { metric: 'MAE', model: numberOrNull(validationModel.mae), baseline: numberOrNull(baseline.mae) },
      { metric: 'RMSE', model: numberOrNull(validationModel.rmse), baseline: numberOrNull(baseline.rmse) },
      { metric: 'WAPE %', model: numberOrNull(validationModel.wape_percent), baseline: numberOrNull(baseline.wape_percent) },
    ]
    : []

  const coverage = validation?.prediction_coverage_percent ?? model.prediction_coverage_percent
  const frequency = validation?.frequency_coverage_percent ?? model.frequency_coverage_percent
  const missingValidation = 'Validation data is not available.'

  return (
    <div className="space-y-6">
      <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
  Data intelligence
</p>

<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
  Network Analytics
</h2>
        <p className="mt-1 text-sm text-slate-400">
        Explore historical passenger demand, network patterns and the performance of our crowdedness estimation model.
        </p>
      </div>


      {validation && (
  <section className="overflow-hidden rounded-2xl border border-teal-400/20 bg-[#111c2e] p-6 sm:p-8">

    <div className="grid items-center gap-8 lg:grid-cols-2">

      <div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-300">

          <Activity className="size-3.5" />

          Historical model evaluation

        </div>

        <h3 className="text-2xl font-bold text-white">
          Data-driven travel intelligence.
        </h3>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          TransitIQ learns route-specific demand patterns
          using historical ticketing records, time of day
          and day type.
        </p>

        <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-400">

          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-400" />

          Evaluation uses held-out historical dates.
          These metrics measure recorded passenger demand,
          not actual onboard occupancy.

        </div>

      </div>

      <div className="rounded-2xl border border-teal-400/15 bg-[#0b1424] p-6">

        <p className="text-sm text-slate-400">
          MAE reduction against baseline
        </p>

        <p className="mt-2 text-5xl font-bold tracking-tight text-teal-300">
          {formatPercent(
            validation.mae_improvement_percent
          )}
        </p>

        <div className="mt-5 space-y-4">

          <div>
            <div className="mb-2 flex justify-between text-xs text-slate-400">
              <span>Baseline MAE</span>
              <span>{formatDecimal(baseline?.mae, 4)}</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-full rounded-full bg-slate-500" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-xs text-teal-300">
              <span>TransitIQ MAE</span>
              <span>{formatDecimal(metrics.mae, 4)}</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-teal-400"
                style={{
                  width: `${
                    baseline?.mae > 0
                      ? Math.min(
                          100,
                          Math.max(
                            0,
                            metrics.mae / baseline.mae * 100
                          )
                        )
                      : 0
                  }%`
                }}
              />

            </div>

          </div>

        </div>

      </div>

    </div>

  </section>
)}

      {!validation ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          The validation report is missing. Model metrics are shown where the summary still includes them. Charts that depend on validation data are left empty.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Ticketing records"
          value={formatCount(dataset.raw_ticket_records)}
          hint={dataset.valid_matched_tickets != null
            ? `${formatCount(dataset.valid_matched_tickets)} matched to GTFS`
            : dataset.date_start && dataset.date_end
              ? `${dataset.date_start} to ${dataset.date_end}`
              : null}
        />
        <Stat
          label="Supported routes"
          value={formatCount(model.supported_routes ?? dataset.covered_route_keys)}
          hint={model.model || null}
        />
        <Stat
          label="Historical profiles"
          value={formatCount(model.total_profiles)}
          hint={model.training_period ? `Training ${model.training_period}` : null}
        />
        <Stat
          label="Prediction coverage"
          value={formatPercent(coverage)}
          hint={validation?.evaluation_profiles != null
            ? `${formatCount(validation.evaluation_profiles)} evaluation profiles`
            : null}
        />
        <Stat label="Frequency coverage" value={formatPercent(frequency)} />
        <Stat
          label="Model MAE"
          value={formatDecimal(metrics.mae, 4)}
          hint={model.validation_target || null}
        />
        <Stat label="Model RMSE" value={formatDecimal(metrics.rmse, 4)} />
        <Stat label="Model WAPE" value={formatPercent(metrics.wape_percent)} />
        <Stat
  label="MAE improvement"
  featured
  value={formatPercent(validation?.mae_improvement_percent, 2)}
  hint={validation ? 'Against the constant-mean baseline' : missingValidation}
/>
      </div>

      <ChartCard title="Model and baseline comparison" empty={comparison.length ? null : missingValidation}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparison}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="metric" tick={{ fill: CHART.tick, fontSize: 12 }} />
            <YAxis tick={{ fill: CHART.tick, fontSize: 12 }} />
            <Tooltip contentStyle={CHART.tooltip} />
            <Legend />
            <Bar dataKey="model" name="Model" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="baseline" name="Baseline" fill="#64748b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {validation?.baseline_description ? (
        <p className="text-xs leading-5 text-slate-500">{validation.baseline_description}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Hourly passenger demand" empty={hourly.length ? null : missingValidation}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: CHART.tick, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 12 }} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Bar dataKey="passengers" name="Average passengers" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekday versus weekend demand" empty={dayType.length ? null : missingValidation}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayType}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 12 }} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Bar dataKey="passengers" name="Average daily passengers" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crowdedness distribution" empty={crowding.length ? null : missingValidation}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crowding}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 12 }} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Bar dataKey="value" name="Profiles">
                {crowding.map((row) => (
                  <Cell key={row.key} fill={LEVEL_COLORS[row.key] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Confidence distribution" empty={confidence.length ? null : missingValidation}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={confidence}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 12 }} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Bar dataKey="value" name="Profiles" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {validation?.peak_analysis ? (
        <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-4">
         <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
  <Database className="size-5 text-teal-400" />
  Peak-hour passenger demand
</h3>

<p className="mt-2 text-sm text-slate-400">
  Average recorded passenger demand during historical
  peak and off-peak periods.
</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(validation.peak_analysis).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs tracking-wide text-slate-400 uppercase">{titleFromKey(key)}</dt>
                <dd className="mt-1 text-lg text-white">{key === 'busiest_hour'
  ? `${String(value).padStart(2, '0')}:00 IST`
  : formatDecimal(value, 2)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {Array.isArray(summary.limitations) && summary.limitations.length ? (
        <section>
          <h3 className="text-sm font-medium text-slate-100">Reported limitations</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {summary.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
