
from datetime import date, datetime

import pytest

from services.departure_advisor import (
    advise_departure,
    parse_gtfs_time,
    reliable_prediction
)


@pytest.fixture(scope="module")
def direct_advice():

    return advise_departure(
        origin_stop_id="1",
        destination_stop_id="26",
        departure_time="2026-11-26T08:00:00+05:30",
        comfort_weight=0.8
    )


@pytest.fixture(scope="module")
def transfer_advice():

    return advise_departure(
        origin_stop_id="1",
        destination_stop_id="1025",
        departure_time="2026-11-26T08:00:00+05:30",
        comfort_weight=0.8
    )


def test_direct_departure_advice(direct_advice):

    assert direct_advice["status"] == "success"

    assert direct_advice["baseline"] is not None

    assert direct_advice["total_candidates"] > 0

    assert len(direct_advice["windows"]) == 5


def test_recommendation_improves_crowding(direct_advice):

    baseline = direct_advice["baseline"]
    recommended = direct_advice["recommendation"]

    assert recommended is not None

    assert recommended["crowding_index"] < (
        baseline["crowding_index"]
    )

    assert recommended["crowding_reduction_points"] >= 5

    assert recommended["reliable_prediction"] is True


def test_recommendation_is_later(direct_advice):

    baseline = direct_advice["baseline"]
    recommended = direct_advice["recommendation"]

    assert datetime.fromisoformat(
        recommended["departure_time"]
    ) > datetime.fromisoformat(
        baseline["departure_time"]
    )

    assert recommended["trip_id"] != baseline["trip_id"]


def test_additional_time_accounting(direct_advice):

    baseline = direct_advice["baseline"]
    recommended = direct_advice["recommendation"]

    expected = (
        recommended["total_elapsed_minutes"]
        - baseline["total_elapsed_minutes"]
    )

    assert recommended["additional_time_minutes"] == (
        pytest.approx(expected, abs=0.1)
    )


def test_recommendation_time_budget(direct_advice):

    baseline = direct_advice["baseline"]
    recommended = direct_advice["recommendation"]

    budget = min(
        45,
        max(15, baseline["total_elapsed_minutes"] * 0.6)
    )

    assert recommended["additional_time_minutes"] <= budget


def test_no_duplicate_alternatives(direct_advice):

    ids = [
        item["trip_id"]
        for item in direct_advice["alternatives"]
    ]

    assert len(ids) == len(set(ids))


def test_transfer_departure_advice(transfer_advice):

    assert transfer_advice["status"] == "success"

    assert transfer_advice["baseline"]["transfers"] == 1

    assert transfer_advice["recommendation"] is None


def test_single_candidate_search(direct_advice):

    assert direct_advice["metadata"]["candidate_searches"] == 1


def test_invalid_comfort_weight():

    with pytest.raises(ValueError):

        advise_departure(
            "1",
            "26",
            "2026-11-26T08:00:00+05:30",
            comfort_weight=1.5
        )


def test_same_origin_destination():

    with pytest.raises(ValueError):

        advise_departure(
            "1",
            "1",
            "2026-11-26T08:00:00+05:30"
        )


def test_gtfs_overnight_time():

    result = parse_gtfs_time(
        "25:30:00",
        date(2026, 11, 26)
    )

    assert result.day == 27
    assert result.hour == 1
    assert result.minute == 30


def test_unreliable_prediction():

    assert not reliable_prediction({
        "crowding_index": 20,
        "confidence": "low"
    })

    assert not reliable_prediction({
        "crowding_index": None,
        "confidence": "unavailable"
    })

    assert reliable_prediction({
        "crowding_index": 20,
        "confidence": "medium"
    })
