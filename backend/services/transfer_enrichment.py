
from services.crowding_service import get_crowding
from services.routing_service import get_journey_stops


CONFIDENCE_ORDER = {
    "unavailable": 0,
    "low": 1,
    "medium": 2,
    "high": 3
}


def classify_crowding(index):

    if index is None:
        return "unknown"

    if index <= 35:
        return "low"

    if index <= 70:
        return "moderate"

    return "high"


def enrich_transfer_journeys(
    journeys,
    service_date
):

    prediction_cache = {}

    for journey in journeys:

        weighted_sum = 0.0
        total_travel = 0.0
        confidence_levels = []
        missing_prediction = False

        for leg in journey["legs"]:

            cache_key = (
                leg["route_key"],
                leg["departure_time"].split(":")[0]
            )

            if cache_key not in prediction_cache:

                prediction_cache[cache_key] = (
                    get_crowding(
                        leg["route_key"],
                        leg["departure_time"],
                        service_date
                    )
                )

            leg.update(prediction_cache[cache_key])

            index = leg.get("crowding_index")
            travel = leg["travel_minutes"]

            confidence_levels.append(
                leg.get("confidence") or "unavailable"
            )

            if index is None:
                missing_prediction = True

            else:
                weighted_sum += index * travel

            total_travel += travel

        if missing_prediction or total_travel <= 0:

            journey["crowding_index"] = None
            journey["crowding_level"] = "unknown"
            journey["confidence"] = "unavailable"
            journey["prediction_available"] = False

        else:

            index = round(
                weighted_sum / total_travel,
                1
            )

            journey["crowding_index"] = index

            journey["crowding_level"] = (
                classify_crowding(index)
            )

            journey["confidence"] = min(
                confidence_levels,
                key=lambda x: CONFIDENCE_ORDER.get(
                    x, 0
                )
            )

            journey["prediction_available"] = True

        journey["crowding_method"] = (
            "Travel-time-weighted leg estimates"
        )

    return journeys


def attach_transfer_geometry(journey):

    all_stops = []
    all_geometry = []

    for leg in journey["legs"]:

        stops = get_journey_stops(
            leg["trip_id"],
            leg["boarding_sequence"],
            leg["alighting_sequence"]
        )

        geometry = [
            [
                stop["latitude"],
                stop["longitude"]
            ]

            for stop in stops

            if stop["latitude"] is not None
            and stop["longitude"] is not None
        ]

        leg["stops"] = stops
        leg["geometry"] = geometry

        for stop in stops:

            if (
                all_stops
                and all_stops[-1]["stop_id"]
                == stop["stop_id"]
            ):
                continue

            all_stops.append(stop)

        for point in geometry:

            if all_geometry and all_geometry[-1] == point:
                continue

            all_geometry.append(point)

    journey["stops"] = all_stops
    journey["geometry"] = all_geometry

    journey["geometry_source"] = (
        "GTFS stop coordinates"
    )

    return journey
