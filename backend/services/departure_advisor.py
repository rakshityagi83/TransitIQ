
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.journey_service import plan_journey
from services.ranking_service import rank_journeys


IST = ZoneInfo("Asia/Kolkata")

DEPARTURE_OFFSETS = [0, 15, 30, 45, 60]

MIN_CROWDING_IMPROVEMENT = 5


def parse_gtfs_time(value, service_date):

    hours, minutes, seconds = map(
        int, value.split(":")
    )

    midnight = datetime.combine(
        service_date,
        datetime.min.time(),
        tzinfo=IST
    )

    return midnight + timedelta(
        hours=hours,
        minutes=minutes,
        seconds=seconds
    )


def journey_identity(journey):

    return str(journey["trip_id"])


def reliable_prediction(journey):

    return (
        journey.get("crowding_index") is not None
        and journey.get("confidence") in (
            "high", "medium"
        )
    )


def summarise_journey(
    journey,
    requested_time,
    window_time,
    offset
):

    departure = parse_gtfs_time(
        journey["departure_time"],
        requested_time.date()
    )

    arrival = parse_gtfs_time(
        journey["arrival_time"],
        requested_time.date()
    )

    return {
        "window_offset_minutes": offset,

        "requested_departure": (
            window_time.isoformat()
        ),

        "trip_id": journey_identity(journey),

        "route_name": journey["route_name"],
        "route_key": journey["route_key"],

        "journey_type": journey.get(
            "journey_type", "direct"
        ),

        "transfers": journey.get("transfers", 0),

        "departure_time": departure.isoformat(),
        "arrival_time": arrival.isoformat(),

        "waiting_minutes": round(
            (departure - window_time)
            .total_seconds() / 60,
            1
        ),

        "journey_duration_minutes": round(
            (arrival - window_time)
            .total_seconds() / 60,
            1
        ),

        "total_elapsed_minutes": round(
            (arrival - requested_time)
            .total_seconds() / 60,
            1
        ),

        "crowding_index": journey.get(
            "crowding_index"
        ),

        "crowding_level": journey.get(
            "crowding_level", "unknown"
        ),

        "confidence": journey.get(
            "confidence", "unavailable"
        ),

        "effective_crowding": journey.get(
            "effective_crowding"
        ),

        "reliable_prediction": (
            reliable_prediction(journey)
        )
    }


def advise_departure(
    origin_stop_id,
    destination_stop_id,
    departure_time,
    comfort_weight=0.5
):

    requested = datetime.fromisoformat(
        departure_time
    )

    if requested.tzinfo is None:
        requested = requested.replace(
            tzinfo=IST
        )
    else:
        requested = requested.astimezone(IST)

    if origin_stop_id == destination_stop_id:
        raise ValueError(
            "Origin and destination must be different."
        )

    if not 0 <= comfort_weight <= 1:
        raise ValueError(
            "Comfort weight must be between 0 and 1."
        )

    # Search and enrich journey candidates once.
    candidates = plan_journey(
        origin_stop_id=origin_stop_id,
        destination_stop_id=destination_stop_id,
        departure_time=requested.isoformat(),
        comfort_weight=comfort_weight,
        candidates_only=True
    )

    if not candidates:

        return {
            "status": "no_journeys",
            "windows": [],
            "alternatives": [],
            "baseline": None,
            "recommendation": None,
            "message": (
                "No scheduled journeys were found."
            )
        }

    windows = []
    unique_alternatives = {}

    baseline = None

    for offset in DEPARTURE_OFFSETS:

        window_time = requested + timedelta(
            minutes=offset
        )

        # The existing routing engine searches
        # a single GTFS service day.
        if window_time.date() != requested.date():
            continue

        eligible = []

        for candidate in candidates:

            departure = parse_gtfs_time(
                candidate["departure_time"],
                requested.date()
            )

            if departure < window_time:
                continue

            # Copy candidates because the ranking
            # service modifies their dictionaries.
            journey = candidate.copy()

            journey["duration_minutes"] = max(
                0,
                float(candidate["duration_minutes"])
                - offset
            )

            eligible.append(journey)

        if not eligible:

            windows.append({
                "window_offset_minutes": offset,
                "requested_departure": (
                    window_time.isoformat()
                ),
                "status": "no_journeys",
                "journey": None
            })

            continue

        selected, recommendations = rank_journeys(
            eligible,
            comfort_weight=comfort_weight,
            limit=5
        )

        by_id = {
            journey_identity(j): j
            for j in selected
        }

        balanced = by_id[
            str(recommendations["balanced"])
        ]

        summary = summarise_journey(
            balanced,
            requested,
            window_time,
            offset
        )

        windows.append({
            "window_offset_minutes": offset,
            "requested_departure": (
                window_time.isoformat()
            ),
            "status": "success",
            "journey": summary
        })

        if offset == 0:
            baseline = summary
            continue

        # Inspect reliable comfort alternatives,
        # not just the balanced recommendation.
        for journey in selected:

            if not reliable_prediction(journey):
                continue

            alternative = summarise_journey(
                journey,
                requested,
                window_time,
                offset
            )

            trip_id = alternative["trip_id"]

            # Keep each scheduled journey only once.
            if trip_id not in unique_alternatives:
                unique_alternatives[trip_id] = (
                    alternative
                )

    alternatives = []
    recommendation = None

    if baseline is not None:

        for alternative in unique_alternatives.values():

            if (
                alternative["trip_id"]
                == baseline["trip_id"]
            ):
                continue

            # Must actually depart later than the
            # original recommended bus.
            if (
                alternative["departure_time"]
                <= baseline["departure_time"]
            ):
                continue

            additional_time = round(
                alternative["total_elapsed_minutes"]
                - baseline["total_elapsed_minutes"],
                1
            )

            alternative["additional_time_minutes"] = (
                additional_time
            )

            alternative["crowding_reduction_points"] = (
                None
            )

            if baseline["reliable_prediction"]:

                reduction = round(
                    baseline["crowding_index"]
                    - alternative["crowding_index"],
                    1
                )

                alternative[
                    "crowding_reduction_points"
                ] = reduction

            alternatives.append(alternative)

        # Include the delay in the overall time
        # budget, rather than treating it as free.
        max_extra_time = min(
            45,
            max(
                15,
                baseline["total_elapsed_minutes"]
                * 0.6
            )
        )

        qualified = [
            item for item in alternatives

            if (
                item["crowding_reduction_points"]
                is not None
            )

            and (
                item["crowding_reduction_points"]
                >= MIN_CROWDING_IMPROVEMENT
            )

            and (
                item["additional_time_minutes"]
                <= max_extra_time
            )

            and (
                item["effective_crowding"]
                < baseline["effective_crowding"]
            )
        ]

        if qualified:

            def advisor_score(item):

                time_cost = (
                    max(
                        0,
                        item["additional_time_minutes"]
                    )
                    / max_extra_time
                )

                crowding_cost = (
                    item["effective_crowding"] / 100
                )

                return (
                    (1 - comfort_weight) * time_cost
                    + comfort_weight * crowding_cost
                    + item["transfers"] * 0.05
                )

            recommendation = min(
                qualified,
                key=lambda item: (
                    advisor_score(item),
                    item["total_elapsed_minutes"]
                )
            )

            recommendation = recommendation.copy()

            recommendation["advisor_score"] = round(
                advisor_score(recommendation) * 100,
                3
            )

    alternatives.sort(
        key=lambda item: (
            item["effective_crowding"],
            item["total_elapsed_minutes"]
        )
    )

    if recommendation is not None:

        message = (
            "A later scheduled departure offers "
            "a meaningfully lower predicted "
            "crowdedness index within the time budget."
        )

    elif baseline and not baseline["reliable_prediction"]:

        message = (
            "The original journey has insufficient "
            "historical support for a reliable "
            "crowdedness comparison."
        )

    else:

        message = (
            "No meaningfully less crowded later "
            "departure was identified within "
            "the available search window."
        )

    return {
        "status": "success",
        "requested_departure": requested.isoformat(),
        "comfort_weight": comfort_weight,
        "total_candidates": len(candidates),
        "windows": windows,
        "baseline": baseline,
        "alternatives": alternatives[:10],
        "recommendation": recommendation,
        "message": message,

        "metadata": {
            "departure_offsets_minutes": (
                DEPARTURE_OFFSETS
            ),
            "search_horizon_minutes": 120,
            "minimum_improvement_points": (
                MIN_CROWDING_IMPROVEMENT
            ),
            "timing_source": "Static GTFS",
            "candidate_searches": 1,
            "crowding_is_relative_index": True,
            "etm_available": False,
            "same_service_day_only": True,
            "search_scope": (
                "Bounded direct and one-transfer "
                "journey candidates"
            )
        }
    }
