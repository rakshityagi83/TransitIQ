
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def journey_payload(destination="26"):

    return {
        "origin_stop_id": "1",
        "destination_stop_id": destination,
        "departure_time": "2026-11-26T08:00:00+05:30",
        "comfort_weight": 0.5,
        "limit": 5
    }


def test_health():

    response = client.get("/health")

    assert response.status_code == 200


def test_stop_search():

    response = client.get(
        "/api/stops?query=Rohini&limit=5"
    )

    assert response.status_code == 200


def test_stop_details():

    response = client.get("/api/stops/1")

    assert response.status_code == 200


def test_route_search():

    response = client.get(
        "/api/routes?query=102"
    )

    assert response.status_code == 200


def test_direct_journey():

    response = client.post(
        "/api/journey/plan",
        json=journey_payload("26")
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["direct_candidates"] > 0

    assert any(
        j["transfers"] == 0
        for j in data["journeys"]
    )


def test_transfer_journey():

    response = client.post(
        "/api/journey/plan",
        json=journey_payload("1025")
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["transfer_candidates"] > 0

    transfers = [
        j for j in data["journeys"]
        if j["transfers"] == 1
    ]

    assert len(transfers) > 0

    for journey in transfers:

        assert len(journey["legs"]) == 2

        assert 5 <= journey[
            "transfer_wait_minutes"
        ] <= 45

        assert len(journey["geometry"]) > 0


def test_invalid_comfort_weight():

    payload = journey_payload()

    payload["comfort_weight"] = 1.5

    response = client.post(
        "/api/journey/plan",
        json=payload
    )

    assert response.status_code in (400, 422)


def test_missing_required_fields():

    response = client.post(
        "/api/journey/plan",
        json={}
    )

    assert response.status_code == 422


def test_crowding_profile():

    response = client.get(
        "/api/crowding/717AUP/profile"
        "?day_type=weekday"
    )

    assert response.status_code == 200


def test_analytics():

    response = client.get(
        "/api/analytics/summary"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["validation"] is not None

    assert data["capabilities"][
        "transfer_routing"
    ] is True

    assert data["validation"][
        "mae_improvement_percent"
    ] > 0
