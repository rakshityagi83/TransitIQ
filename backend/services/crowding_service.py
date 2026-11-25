
from datetime import date, timedelta

from services.data_store import (
    get_connection,
    gtfs_time_to_seconds
)


def get_crowding(
    route_key,
    departure_time,
    service_date
):

    if isinstance(service_date, str):
        service_date = date.fromisoformat(
            service_date
        )

    seconds = gtfs_time_to_seconds(
        departure_time
    )

    # Support GTFS times beyond midnight.
    actual_date = service_date + timedelta(
        days=seconds // 86400
    )

    hour = (seconds // 3600) % 24

    day_type = (
        "weekend"
        if actual_date.weekday() >= 5
        else "weekday"
    )

    con = get_connection()

    try:

        rows = con.execute("""
            SELECT
                crowding_index,
                crowding_level,
                confidence,
                avg_passengers,
                scheduled_trips,
                demand_per_departure,
                tickets,
                observed_days,
                total_days,
                coverage

            FROM crowding_profiles

            WHERE route_key = ?
              AND day_type = ?
              AND hour = ?

        """, [
            route_key,
            day_type,
            hour
        ]).fetchall()

        if not rows:

            return {
                "crowding_index": None,
                "crowding_level": "unknown",
                "confidence": "unavailable",
                "prediction_available": False,
                "hour": hour,
                "day_type": day_type,
                "reason": (
                    "Insufficient historical data"
                )
            }

        row = rows[0]

        return {

            "crowding_index": (
                round(float(row[0]), 1)
                if row[0] is not None
                else None
            ),

            "crowding_level": row[1],
            "confidence": row[2],

            "avg_passengers": (
                round(float(row[3]), 2)
                if row[3] is not None
                else None
            ),

            "scheduled_trips": (
                int(row[4])
                if row[4] is not None
                else None
            ),

            "demand_per_departure": (
                round(float(row[5]), 2)
                if row[5] is not None
                else None
            ),

            "historical_tickets": int(row[6]),
            "observed_days": int(row[7]),
            "total_days": int(row[8]),

            "data_coverage_percent": round(
                float(row[9]) * 100, 2
            ),

            "prediction_available": (
                row[0] is not None
            ),

            "hour": hour,
            "day_type": day_type,

            "prediction_source": (
                "Historical ONDC ticketing "
                "and GTFS frequency"
            ),

            "is_actual_occupancy_percentage": False
        }

    finally:
        con.close()


def get_hourly_profile(
    route_key,
    day_type="weekday"
):

    if day_type not in [
        "weekday", "weekend"
    ]:
        raise ValueError("Invalid day type.")

    con = get_connection()

    try:

        rows = con.execute("""
            SELECT
                hour,
                crowding_index,
                crowding_level,
                confidence,
                avg_passengers,
                scheduled_trips

            FROM crowding_profiles

            WHERE route_key = ?
              AND day_type = ?

            ORDER BY hour

        """, [
            route_key,
            day_type
        ]).fetchall()

        return [

            {
                "hour": int(row[0]),

                "crowding_index": (
                    float(row[1])
                    if row[1] is not None
                    else None
                ),

                "crowding_level": row[2],
                "confidence": row[3],

                "avg_passengers": (
                    round(float(row[4]), 2)
                    if row[4] is not None
                    else None
                ),

                "scheduled_trips": (
                    int(row[5])
                    if row[5] is not None
                    else None
                )
            }

            for row in rows
        ]

    finally:
        con.close()
