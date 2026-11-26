export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readError(response) {
  let message = `Request failed (${response.status}).`

  try {
    const body = await response.json()
    if (typeof body?.detail === 'string' && body.detail.trim()) {
      message = body.detail
    } else if (Array.isArray(body?.detail)) {
      const parts = body.detail
        .map((item) => item?.msg || item?.message)
        .filter(Boolean)
      if (parts.length) message = parts.join(' ')
    }
  } catch {
    // Keep the status fallback when the body is not JSON.
  }

  throw new ApiError(message, response.status)
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response

  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('Backend unavailable.')
  }

  if (!response.ok) await readError(response)
  return response.json()
}

export function getHealth(signal) {
  return request('/health', { signal })
}

export function searchStops(query, limit = 8, signal) {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  })
  return request(`/api/stops?${params}`, { signal })
}

export function getStop(stopId, signal) {
  return request(`/api/stops/${encodeURIComponent(stopId)}`, { signal })
}

export function planJourney(payload, signal) {
  return request('/api/journey/plan', {
    method: 'POST',
    body: payload,
    signal,
  })
}

export function getAnalytics(signal) {
  return request('/api/analytics/summary', { signal })
}

export function getDepartureAdvice(payload, signal) {
  return request('/api/journey/departure-advice', {
    method: 'POST',
    body: payload,
    signal,
  })
}