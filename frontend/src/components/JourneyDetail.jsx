import {
  formatClock,
  formatConfidence,
  formatCrowdingIndex,
  formatCrowdingLevel,
  formatMinutes,
} from '../utils/format'

function StopTable({ stops, transferId }) {
  if (!stops?.length) {
    return <p className="text-sm text-slate-400">No stop list was returned for this leg.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Scheduled stops on this bus leg</caption>
        <thead className="text-xs tracking-wide text-slate-400 uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">Stop</th>
            <th scope="col" className="py-2 pr-3 font-medium">Arrival</th>
            <th scope="col" className="py-2 font-medium">Departure</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => {
            const isTransfer = transferId && String(stop.stop_id) === String(transferId)
            return (
              <tr key={`${stop.stop_id}-${stop.sequence}`} className="border-t border-slate-700/80">
                <th scope="row" className="py-2 pr-3 font-normal text-slate-100">
                  {stop.stop_name}
                  {isTransfer ? <span className="ml-2 text-xs text-violet-300">Transfer</span> : null}
                </th>
                <td className="py-2 pr-3 text-slate-300">{formatClock(stop.arrival_time)}</td>
                <td className="py-2 text-slate-300">{formatClock(stop.departure_time)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function JourneyDetail({ journey }) {
  if (!journey) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-700 bg-[#111c2e] p-5 text-sm text-slate-400">
        Select a journey to inspect its bus legs and scheduled stops.
      </section>
    )
  }

  const legs = Array.isArray(journey.legs) && journey.legs.length
    ? journey.legs
    : [journey]
  const transferId = journey.transfer_stop?.stop_id

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5" aria-labelledby="journey-detail-title">
      <h3 id="journey-detail-title" className="text-lg font-semibold text-white">
        {journey.route_name}
      </h3>
      <p className="mt-1 text-sm text-slate-400">
        {journey.boarding_stop?.stop_name} to {journey.alighting_stop?.stop_name}
        {' · '}
        {formatMinutes(journey.duration_minutes)} scheduled
      </p>

      <div className="mt-5 space-y-5">
        {legs.map((leg, index) => (
          <article key={leg.trip_id || index} className="rounded-xl border border-slate-700/80 bg-[#0c1628] p-4">
            <h4 className="font-medium text-slate-100">
              Leg {index + 1}: {leg.route_name || journey.route_name}
            </h4>
            <p className="mt-1 text-sm text-slate-400">
              {formatClock(leg.departure_time)} depart {leg.boarding_stop?.stop_name}
              {' · '}
              {formatClock(leg.arrival_time)} arrive {leg.alighting_stop?.stop_name}
              {' · '}
              {formatMinutes(leg.travel_minutes)} in vehicle
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Crowdedness {formatCrowdingIndex(leg.crowding_index, leg.crowding_level)}
              {' · '}
              {formatCrowdingLevel(leg.crowding_index, leg.crowding_level)}
              {' · '}
              Confidence {formatConfidence(leg.confidence)}
            </p>
            <div className="mt-3">
              <StopTable stops={leg.stops} transferId={transferId} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
