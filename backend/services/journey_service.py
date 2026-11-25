
from datetime import datetime
from zoneinfo import ZoneInfo

from services.routing_service import (
    find_direct_journeys,
    get_journey_stops
)

from services.crowding_service import get_crowding

from services.ranking_service import rank_journeys


IST = ZoneInfo("Asia/Kolkata")


def plan_journey(
    origin_stop_id,
    destination_stop_id,
    departure_time,
    comfort_weight=0.5,
    limit=5
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

    # 1. Find scheduled journey candidates.

    candidates = find_direct_journeys(
        origin_stop_id,
        destination_stop_id,
        time_string,
        limit=100,
        max_wait_minutes=120
    )

    if not candidates:

        return {
            "status": "no_journeys",
            "message": (
                "No direct scheduled journeys "
                "found within the next two hours."
            ),
            "journeys": [],
            "recommendations": {}
        }

    # 2. Attach historical crowding predictions.

    prediction_cache = {}

    for journey in candidates:

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

    # 3. Rank journeys using the dedicated
    # confidence-aware optimisation engine.

    selected, recommendations = rank_journeys(
        candidates,
        comfort_weight=comfort_weight,
        limit=limit
    )

    # 4. Attach intermediate stops
    # and geographical coordinates.

    for journey in selected:

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

    # 5. Return complete results.

    return {

        "status": "success",

        "requested_departure": (
            requested_time.isoformat()
        ),

        "comfort_weight": comfort_weight,

        "total_candidates": len(candidates),

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

            "routing_scope": "Direct bus journeys",

            "ranking_method": (
                "Confidence-aware multi-objective "
                "optimisation with journey-time budget"
            )
        }
    }
