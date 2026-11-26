
from datetime import datetime
from zoneinfo import ZoneInfo

from services.routing_service import (
    find_direct_journeys,
    get_journey_stops
)

from services.crowding_service import get_crowding
from services.ranking_service import rank_journeys

from services.transfer_service import (
    find_transfer_journeys
)

from services.transfer_enrichment import (
    enrich_transfer_journeys,
    attach_transfer_geometry
)


IST = ZoneInfo("Asia/Kolkata")


def plan_journey(
    origin_stop_id,
    destination_stop_id,
    departure_time,
    comfort_weight=0.5,
    limit=5,
    candidates_only=False
):

    comfort_weight = float(comfort_weight)

    if not 0 <= comfort_weight <= 1:
        raise ValueError(
            "Comfort weight must be between 0 and 1."
        )

    limit = max(3, min(int(limit), 10))

    requested_time = datetime.fromisoformat(
        departure_time
    )

    if requested_time.tzinfo is None:
        requested_time = requested_time.replace(
            tzinfo=IST
        )
    else:
        requested_time = requested_time.astimezone(
            IST
        )

    service_date = requested_time.date()

    time_string = requested_time.strftime(
        "%H:%M:%S"
    )

    # 1. Search direct journeys.

    direct_journeys = find_direct_journeys(
        origin_stop_id,
        destination_stop_id,
        time_string,
        limit=100,
        max_wait_minutes=120
    )

    prediction_cache = {}

    for journey in direct_journeys:

        journey["journey_type"] = "direct"
        journey["transfers"] = 0
        journey["transfer_wait_minutes"] = 0

        cache_key = (
            journey["route_key"],
            journey["departure_time"].split(":")[0]
        )

        if cache_key not in prediction_cache:

            prediction_cache[cache_key] = get_crowding(
                journey["route_key"],
                journey["departure_time"],
                service_date
            )

        journey.update(
            prediction_cache[cache_key]
        )

    # 2. Search one-transfer journeys.

    transfer_journeys = find_transfer_journeys(
        origin_stop_id,
        destination_stop_id,
        time_string,
        limit=30,
        max_wait_minutes=120,
        min_transfer_minutes=5,
        max_transfer_minutes=45
    )

    transfer_journeys = enrich_transfer_journeys(
        transfer_journeys,
        service_date
    )

    # 3. Combine all journey candidates.

    candidates = (
        direct_journeys + transfer_journeys
    )
    if candidates_only:
        return candidates

    if not candidates:

        return {
            "status": "no_journeys",
            "message": (
                "No direct or one-transfer scheduled "
                "journeys found within the search window."
            ),
            "journeys": [],
            "recommendations": {},
            "total_candidates": 0,
            "unique_routes": 0,
            "returned_unique_routes": 0
        }

    # 4. Rank combined journey candidates.

    selected, recommendations = rank_journeys(
        candidates,
        comfort_weight=comfort_weight,
        limit=limit
    )

    # 5. Generate geometry for selected journeys.

    for journey in selected:

        if journey["transfers"] == 1:

            attach_transfer_geometry(journey)

        else:

            stops = get_journey_stops(
                journey["trip_id"],
                journey["boarding_sequence"],
                journey["alighting_sequence"]
            )

            journey["stops"] = stops

            journey["geometry"] = [
                [
                    stop["latitude"],
                    stop["longitude"]
                ]
                for stop in stops
                if stop["latitude"] is not None
                and stop["longitude"] is not None
            ]

            journey["geometry_source"] = (
                "GTFS stop coordinates"
            )

            journey["legs"] = [{
                key: journey.get(key)
                for key in [
                    "trip_id",
                    "route_id",
                    "route_name",
                    "route_key",
                    "boarding_stop",
                    "alighting_stop",
                    "boarding_sequence",
                    "alighting_sequence",
                    "departure_time",
                    "arrival_time",
                    "travel_minutes",
                    "crowding_index",
                    "crowding_level",
                    "confidence",
                    "prediction_available",
                    "stops",
                    "geometry"
                ]
            }]

    # 6. Return unified journey response.

    return {
        "status": "success",

        "requested_departure": (
            requested_time.isoformat()
        ),

        "comfort_weight": comfort_weight,

        "total_candidates": len(candidates),

        "direct_candidates": len(direct_journeys),

        "transfer_candidates": len(transfer_journeys),

        "unique_routes": len({
            j["route_key"]
            for j in candidates
        }),

        "returned_unique_routes": len({
            j["route_key"]
            for j in selected
        }),

        "journeys": selected,

        "recommendations": recommendations,

        "metadata": {

            "timing_source": "Static GTFS",

            "crowding_source": (
                "Historical October 2026 "
                "ONDC e-ticketing data"
            ),

            "crowding_is_relative_index": True,

            "etm_available": False,

            "routing_scope": (
                "Direct and one-transfer bus journeys"
            ),

            "maximum_transfers": 1,

            "minimum_transfer_minutes": 5,

            "ranking_method": (
                "Confidence-aware multi-objective "
                "optimisation with journey-time budget"
            ),

            "transfer_crowding_method": (
                "Travel-time-weighted leg estimates"
            )
        }
    }
