import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { stopPoint } from '../utils/format'

const LEG_COLORS = ['#14b8a6', '#38bdf8', '#f59e0b', '#c084fc']
const DELHI = [28.6139, 77.209]

function FitToJourney({ positions, signature }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length < 1) return
    if (positions.length === 1) {
      map.setView(positions[0], 15)
      return
    }
    map.fitBounds(positions, { padding: [32, 32], maxZoom: 15 })
  }, [map, positions, signature])

  return null
}

function geometryPoints(geometry) {
  if (!Array.isArray(geometry)) return []
  return geometry
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null
      const latitude = Number(pair[0])
      const longitude = Number(pair[1])
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
      return [latitude, longitude]
    })
    .filter(Boolean)
}

export default function JourneyMap({ journey }) {
  const model = useMemo(() => {
    const legs = Array.isArray(journey?.legs) && journey.legs.length
      ? journey.legs
      : journey
        ? [{ ...journey, route_name: journey.route_name }]
        : []

    const drawnLegs = legs.map((leg, index) => ({
      id: leg.trip_id || `leg-${index}`,
      name: leg.route_name || `Leg ${index + 1}`,
      color: LEG_COLORS[index % LEG_COLORS.length],
      positions: geometryPoints(leg.geometry?.length ? leg.geometry : index === 0 ? journey?.geometry : []),
    }))

    const origin = stopPoint(journey?.boarding_stop)
    const destination = stopPoint(journey?.alighting_stop)
    const transfer = journey?.transfers > 0 ? stopPoint(journey?.transfer_stop) : null
    const special = new Set(
      [journey?.boarding_stop?.stop_id, journey?.alighting_stop?.stop_id, journey?.transfer_stop?.stop_id]
        .filter(Boolean)
        .map(String),
    )

    const seen = new Set()
    const intermediates = []
    const sourceStops = legs.flatMap((leg) => (Array.isArray(leg.stops) ? leg.stops : []))
    sourceStops.forEach((stop) => {
      const id = String(stop.stop_id)
      if (special.has(id) || seen.has(id)) return
      const point = stopPoint(stop)
      if (!point) return
      seen.add(id)
      intermediates.push({ id, name: stop.stop_name, point })
    })

    const bounds = [
      ...drawnLegs.flatMap((leg) => leg.positions),
      ...(origin ? [origin] : []),
      ...(destination ? [destination] : []),
      ...(transfer ? [transfer] : []),
    ]

    return { drawnLegs, origin, destination, transfer, intermediates, bounds }
  }, [journey])

  const signature = journey?.trip_id || 'none'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#111c2e]" aria-labelledby="map-title">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div>
          <h3 id="map-title" className="text-base font-semibold text-white">Scheduled stop-based route map</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
            Lines connect scheduled GTFS stop coordinates. This is not a road-following path.
            {journey?.geometry_source ? ` Source: ${journey.geometry_source}.` : ''}
          </p>
        </div>
        {model.drawnLegs.length ? (
          <ul className="flex flex-wrap gap-3 text-xs text-slate-300">
            {model.drawnLegs.map((leg) => (
              <li key={leg.id} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-5 rounded-full" style={{ backgroundColor: leg.color }} />
                {leg.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="h-[420px]">
        <MapContainer
          center={DELHI}
          zoom={11}
          scrollWheelZoom
          className="h-full w-full"
          aria-label="Map of the selected scheduled bus journey"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToJourney positions={model.bounds} signature={signature} />
          {model.drawnLegs.map((leg) => (
            leg.positions.length > 1 ? (
              <Polyline key={leg.id} positions={leg.positions} pathOptions={{ color: leg.color, weight: 5, opacity: 0.9 }} />
            ) : null
          ))}
          {model.intermediates.map((stop) => (
            <CircleMarker
              key={stop.id}
              center={stop.point}
              radius={4}
              pathOptions={{ color: '#94a3b8', fillColor: '#cbd5e1', fillOpacity: 0.9, weight: 1 }}
            >
              <Popup>{stop.name}</Popup>
            </CircleMarker>
          ))}
          {model.origin ? (
            <CircleMarker center={model.origin} radius={9} pathOptions={{ color: '#042f2e', fillColor: '#14b8a6', fillOpacity: 1, weight: 2 }}>
              <Popup>Origin: {journey.boarding_stop?.stop_name}</Popup>
            </CircleMarker>
          ) : null}
          {model.transfer ? (
            <CircleMarker center={model.transfer} radius={8} pathOptions={{ color: '#2e1065', fillColor: '#a78bfa', fillOpacity: 1, weight: 2 }}>
              <Popup>Transfer: {journey.transfer_stop?.stop_name}</Popup>
            </CircleMarker>
          ) : null}
          {model.destination ? (
            <CircleMarker center={model.destination} radius={9} pathOptions={{ color: '#451a03', fillColor: '#f59e0b', fillOpacity: 1, weight: 2 }}>
              <Popup>Destination: {journey.alighting_stop?.stop_name}</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
      </div>
      <p className="px-4 py-2 text-xs text-slate-500">
        Teal marks the origin, amber the destination, and violet a transfer stop. Smaller points are intermediate bus stops.
      </p>
    </section>
  )
}
