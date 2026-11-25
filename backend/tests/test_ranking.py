
from services.ranking_service import (
    effective_crowding,
    rank_journeys
)


def make_journey(
    trip_id,
    route,
    duration,
    crowding,
    confidence="high",
    transfers=0
):

    return {
        "trip_id": trip_id,
        "route_key": route,
        "duration_minutes": duration,
        "crowding_index": crowding,
        "confidence": confidence,
        "transfers": transfers
    }


def test_speed_preference():

    journeys = [
        make_journey("A", "R1", 30, 70),
        make_journey("B", "R2", 40, 20)
    ]

    selected, recommendations = rank_journeys(
        journeys,
        comfort_weight=0
    )

    assert recommendations["fastest"] == "A"
    assert recommendations["balanced"] == "A"


def test_comfort_preference():

    journeys = [
        make_journey("A", "R1", 30, 70),
        make_journey("B", "R2", 40, 20)
    ]

    selected, recommendations = rank_journeys(
        journeys,
        comfort_weight=1
    )

    assert recommendations["least_crowded"] == "B"
    assert recommendations["balanced"] == "B"


def test_excessive_duration_filtered():

    journeys = [
        make_journey("A", "R1", 30, 80),
        make_journey("B", "R2", 120, 5)
    ]

    selected, recommendations = rank_journeys(
        journeys,
        comfort_weight=1
    )

    assert len(selected) == 1
    assert selected[0]["trip_id"] == "A"


def test_unknown_crowding():

    journey = make_journey(
        "A", "R1", 30, None, "unavailable"
    )

    assert effective_crowding(journey) == 100


def test_confidence_penalty():

    high = make_journey(
        "A", "R1", 30, 40, "high"
    )

    low = make_journey(
        "B", "R2", 30, 40, "low"
    )

    assert effective_crowding(low) > (
        effective_crowding(high)
    )


def test_no_reliable_comfort_recommendation():

    journeys = [
        make_journey("A", "R1", 30, 10, "low"),
        make_journey("B", "R2", 40, None, "unavailable")
    ]

    selected, recommendations = rank_journeys(
        journeys
    )

    assert recommendations["least_crowded"] is None


def test_empty_candidates():

    selected, recommendations = rank_journeys([])

    assert selected == []
    assert recommendations == {}


def test_distinct_routes_preferred():

    journeys = [
        make_journey("A", "R1", 30, 20),
        make_journey("B", "R1", 32, 20),
        make_journey("C", "R1", 33, 20),
        make_journey("D", "R2", 35, 25)
    ]

    selected, recommendations = rank_journeys(
        journeys,
        limit=3
    )

    routes = {
        journey["route_key"]
        for journey in selected
    }

    assert len(routes) == 2
