
from datetime import datetime
from zoneinfo import ZoneInfo

from services.routing_service import (
    find_direct_journeys,
    get_journey_stops
)

from services.crowding_service import get_crowding


IST = ZoneInfo("Asia/Kolkata")


def effective_crowding(journey):

    index = journey.get("crowding_index")
    confidence = journey.get("confidence")

    # Missing data is not zero crowding.
    if index is None:
        return 100.0

    # Conservative uncertainty adjustment.
    penalties = {
        "high": 0,
        "medium": 10,
        "low": 25,
        "unavailable": 35
    }

    return min(
        100.0,
        float(index)
        + penalties.get(confidence, 25)
    )


def calculate_score(
    journey,
    max_duration,
    comfort_weight
):

    time_cost = (
        journey["duration_minutes"]
        / max(max_duration, 1)
    )

    crowding_cost = (
        effective_crowding(journey) / 100
    )

    transfer_cost = (
        journey["transfers"] * 0.05
    )

    score = (
        (1 - comfort_weight) * time_cost
        + comfort_weight * crowding_cost
        + transfer_cost
    )

    return round(score * 100, 3)


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

    limit = max(1, min(int(limit), 10))

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

    # 2. Attach crowding predictions.
    # Cache repeated route-hour combinations.

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

        prediction = prediction_cache[cache_key]

        journey.update(prediction)

        journey["effective_crowding"] = (
            effective_crowding(journey)
        )

        journey["recommendations"] = []

    # 3. Calculate ranking scores.

    max_duration = max(
        j["duration_minutes"]
        for j in candidates
    )

    for journey in candidates:

        journey["ranking_score"] = calculate_score(
            journey,
            max_duration,
            comfort_weight
        )

    # 4. Find fastest journey.

    fastest = min(
        candidates,
        key=lambda j: j["duration_minutes"]
    )

    fastest["recommendations"].append("fastest")

    # 5. Find least crowded reliable journey.

    known_crowding = [
        j for j in candidates
        if j.get("crowding_index") is not None
        and j.get("confidence") in (
            "high", "medium"
        )
    ]

    comfortable = None

    if known_crowding:

        comfortable = min(
            known_crowding,
            key=lambda j: (
                effective_crowding(j),
                j["duration_minutes"]
            )
        )

        comfortable["recommendations"].append(
            "least_crowded"
        )

    # 6. Find balanced journey.

    balanced = min(
        candidates,
        key=lambda j: (
            j["ranking_score"],
            j["duration_minutes"]
        )
    )

    balanced["recommendations"].append("balanced")

    # 7. Prioritise recommended journeys.

    selected = []
    selected_ids = set()

    def add_journey(journey):

        if journey is None:
            return

        trip_id = journey["trip_id"]

        if trip_id not in selected_ids:
            selected.append(journey)
            selected_ids.add(trip_id)

    add_journey(balanced)
    add_journey(fastest)
    add_journey(comfortable)

    ranked = sorted(
        candidates,
        key=lambda j: j["ranking_score"]
    )

    # Prefer different routes where possible.

    used_routes = {
        j["route_key"] for j in selected
    }

    for journey in ranked:

        if len(selected) >= max(limit, 3):
            break

        if journey["route_key"] not in used_routes:

            add_journey(journey)

            used_routes.add(
                journey["route_key"]
            )

    # Fill remaining slots with other departures.

    for journey in ranked:

        if len(selected) >= max(limit, 3):
            break

        add_journey(journey)

    # 8. Attach real stop coordinates and sequences.

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

    # 9. Return complete journey results.

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

        "journeys": selected,

        "recommendations": {

            "fastest": fastest["trip_id"],

            "least_crowded": (
                comfortable["trip_id"]
                if comfortable
                else None
            ),

            "balanced": balanced["trip_id"]
        },

        "metadata": {

            "timing_source": "Static GTFS",

            "crowding_source": (
                "Historical October 2026 "
                "ONDC e-ticketing data"
            ),

            "crowding_is_relative_index": True,

            "etm_available": False,

            "routing_scope": "Direct bus journeys"
        }
    }
