export const DEMO_DATE = '2026-11-26'
export const DEMO_TIME = '08:00'

export const RECOMMENDATION_ORDER = ['fastest', 'least_crowded', 'balanced']

export const RECOMMENDATION_LABELS = {
  fastest: 'Fastest',
  least_crowded: 'Least crowded',
  balanced: 'Balanced',
}

export function preferenceName(weight) {
  if (weight <= 0.33) return 'Speed'
  if (weight >= 0.67) return 'Comfort'
  return 'Balanced'
}

export function isUnknownCrowding(index, level) {
  return index == null || level == null || level === 'unknown'
}

export function formatCrowdingIndex(index, level) {
  if (isUnknownCrowding(index, level)) return 'Unknown'
  const value = Number(index)
  if (!Number.isFinite(value)) return 'Unknown'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatCrowdingLevel(index, level) {
  if (isUnknownCrowding(index, level)) return 'Unknown'
  return String(level).charAt(0).toUpperCase() + String(level).slice(1)
}

export function crowdingTone(index, level) {
  if (isUnknownCrowding(index, level)) return 'unknown'
  if (level === 'low' || level === 'moderate' || level === 'high') return level
  return 'unknown'
}

export function formatConfidence(value) {
  const labels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    unavailable: 'Unavailable',
  }
  if (!value) return 'Unavailable'
  return labels[value] || String(value)
}

export function formatClock(value) {
  if (!value || typeof value !== 'string') return '—'
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  if (!Number.isFinite(hour) || rawMinute == null) return value
  const day = Math.floor(hour / 24)
  const clock = `${String(hour % 24).padStart(2, '0')}:${rawMinute.padStart(2, '0')}`
  return day > 0 ? `${clock} (+${day}d)` : clock
}

export function formatMinutes(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const amount = Number(value)
  if (amount < 60) {
    const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
    return `${text} min`
  }
  const hours = Math.floor(amount / 60)
  const minutes = Math.round(amount - hours * 60)
  if (minutes === 60) return `${hours + 1} h`
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`
}

export function formatCount(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-IN')
}

export function formatDecimal(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${formatDecimal(value, digits)}%`
}

export function titleFromKey(key) {
  return String(key)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function recommendationLabels(recommendations) {
  const values = Array.isArray(recommendations) ? recommendations : []
  const known = RECOMMENDATION_ORDER.filter((key) => values.includes(key))
  const extra = values.filter((key) => !RECOMMENDATION_ORDER.includes(key))
  return [...known, ...extra]
}

export function istDeparture(date, time) {
  return `${date}T${time}:00+05:30`
}

export function stopPoint(stop) {
  const latitude = Number(stop?.latitude)
  const longitude = Number(stop?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return [latitude, longitude]
}
