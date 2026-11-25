
def effective_crowding(journey):

    index = journey.get("crowding_index")
    confidence = journey.get("confidence")

    if index is None:
        return 100.0

    penalties = {
        "high": 0,
        "medium": 10,
        "low": 25,
        "unavailable": 35
    }

    return min(
        100.0,
        float(index) + penalties.get(confidence, 25)
    )


def rank_journeys(
    candidates,
    comfort_weight=0.5,
    limit=5
):

    if not candidates:
        return [], {}

    if not 0 <= comfort_weight <= 1:
        raise ValueError(
            "Comfort weight must be between 0 and 1."
        )

    limit = max(3, min(int(limit), 10))

    fastest = min(
        candidates,
        key=lambda j: j["duration_minutes"]
    )

    fastest_duration = fastest["duration_minutes"]

    # Permit additional travel time for comfort,
    # but avoid excessively long recommendations.

    extra_time_budget = min(
        45,
        max(15, fastest_duration * 0.6)
    )

    maximum_duration = (
        fastest_duration + extra_time_budget
    )

    eligible = [
        j for j in candidates
        if j["duration_minutes"] <= maximum_duration
    ]

    for journey in candidates:

        journey["recommendations"] = []

        journey["effective_crowding"] = (
            effective_crowding(journey)
        )

        extra_time = max(
            0,
            journey["duration_minutes"]
            - fastest_duration
        )

        time_cost = (
            extra_time / extra_time_budget
        )

        crowding_cost = (
            journey["effective_crowding"] / 100
        )

        transfer_cost = (
            journey.get("transfers", 0) * 0.05
        )

        journey["ranking_score"] = round(
            100 * (
                (1 - comfort_weight) * time_cost
                + comfort_weight * crowding_cost
                + transfer_cost
            ),
            3
        )

        journey["within_time_budget"] = (
            journey["duration_minutes"]
            <= maximum_duration
        )

    fastest["recommendations"].append("fastest")

    reliable = [
        j for j in eligible
        if j.get("crowding_index") is not None
        and j.get("confidence") in (
            "high", "medium"
        )
    ]

    comfortable = None

    if reliable:

        comfortable = min(
            reliable,
            key=lambda j: (
                j["effective_crowding"],
                j["duration_minutes"]
            )
        )

        comfortable["recommendations"].append(
            "least_crowded"
        )

    balanced = min(
        eligible,
        key=lambda j: (
            j["ranking_score"],
            j["duration_minutes"]
        )
    )

    balanced["recommendations"].append("balanced")

    selected = []
    selected_ids = set()
    used_routes = set()

    def add(journey):

        if journey is None:
            return

        trip_id = journey["trip_id"]

        if trip_id in selected_ids:
            return

        selected.append(journey)
        selected_ids.add(trip_id)
        used_routes.add(journey["route_key"])

    add(balanced)
    add(fastest)
    add(comfortable)

    ranked = sorted(
        eligible,
        key=lambda j: (
            j["ranking_score"],
            j["duration_minutes"]
        )
    )

    # Prefer genuinely different bus routes.

    for journey in ranked:

        if len(selected) >= limit:
            break

        if journey["route_key"] not in used_routes:
            add(journey)

    # Return other reasonable departures if available.

    for journey in ranked:

        if len(selected) >= limit:
            break

        add(journey)

    recommendations = {
        "fastest": fastest["trip_id"],
        "least_crowded": (
            comfortable["trip_id"]
            if comfortable else None
        ),
        "balanced": balanced["trip_id"]
    }

    return selected, recommendations
