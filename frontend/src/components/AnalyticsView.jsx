import { useEffect, useState } from 'react'
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

function Stat({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <h3 className="text-xs tracking-wide text-slate-400 uppercase">{label}</h3>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p> : null}
    </article>
  )
}

function ChartCard({ title, children, empty }) {
  return (
    <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-100">{title}</h3>
      {empty ? <p className="text-sm text-slate-400">{empty}</p> : <div className="h-64">{children}</div>}
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
        <h2 className="text-xl font-semibold text-white">Network Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Figures come from the analytics summary. Crowdedness remains a relative index, not measured occupancy.
        </p>
      </div>

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
          <h3 className="text-sm font-medium text-slate-100">Peak analysis</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(validation.peak_analysis).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs tracking-wide text-slate-400 uppercase">{titleFromKey(key)}</dt>
                <dd className="mt-1 text-lg text-white">{formatDecimal(value, 2)}</dd>
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
