
from services.data_store import (
    get_connection,
    gtfs_time_to_seconds,
    seconds_to_gtfs_time
)

from services.stop_service import get_stop


def find_direct_journeys(
    origin_stop_id,
    destination_stop_id,
    departure_time,
    limit=20,
    max_wait_minutes=120
):

    origin_stop_id = str(origin_stop_id)
    destination_stop_id = str(destination_stop_id)

    if origin_stop_id == destination_stop_id:
        raise ValueError(
            "Origin and destination must be different."
        )

    origin = get_stop(origin_stop_id)
    destination = get_stop(destination_stop_id)

    if origin is None or destination is None:
        raise ValueError("Invalid bus stop ID.")

    departure_seconds = gtfs_time_to_seconds(
        departure_time
    )

    if not 0 <= departure_seconds < 86400:
        raise ValueError(
            "Departure must be within the selected day."
        )

    limit = max(1, min(int(limit), 100))

    max_wait_minutes = max(
        1, min(int(max_wait_minutes), 180)
    )

    latest_departure = (
        departure_seconds + max_wait_minutes * 60
    )

    con = get_connection()

    try:

        rows = con.execute("""
            WITH boarding AS (
                SELECT
                    trip_id,
                    stop_id,
                    TRY_CAST(stop_sequence AS INTEGER)
                        AS boarding_sequence,

                    TRY_CAST(
                        split_part(departure_time, ':', 1)
                        AS INTEGER
                    ) * 3600
                    +
                    TRY_CAST(
                        split_part(departure_time, ':', 2)
                        AS INTEGER
                    ) * 60
                    +
                    TRY_CAST(
                        split_part(departure_time, ':', 3)
                        AS INTEGER
                    ) AS boarding_seconds

                FROM stop_times
                WHERE stop_id = ?
            ),

            alighting AS (
                SELECT
                    trip_id,
                    stop_id,
                    TRY_CAST(stop_sequence AS INTEGER)
                        AS alighting_sequence,

                    TRY_CAST(
                        split_part(arrival_time, ':', 1)
                        AS INTEGER
                    ) * 3600
                    +
                    TRY_CAST(
                        split_part(arrival_time, ':', 2)
                        AS INTEGER
                    ) * 60
                    +
                    TRY_CAST(
                        split_part(arrival_time, ':', 3)
                        AS INTEGER
                    ) AS alighting_seconds

                FROM stop_times
                WHERE stop_id = ?
            )

            SELECT
                t.trip_id,
                r.route_id,
                r.route_name,
                r.route_key,
                r.agency_id,
                r.description,
                t.shape_id,
                b.boarding_sequence,
                a.alighting_sequence,
                b.boarding_seconds,
                a.alighting_seconds

            FROM boarding b

            JOIN alighting a
                ON b.trip_id = a.trip_id

            JOIN trips t
                ON b.trip_id = t.trip_id

            JOIN routes r
                ON t.route_id = r.route_id

            WHERE
                b.boarding_sequence
                    < a.alighting_sequence

                AND b.boarding_seconds >= ?

                AND b.boarding_seconds <= ?

                AND a.alighting_seconds
                    > b.boarding_seconds

            ORDER BY
                a.alighting_seconds,
                b.boarding_seconds,
                t.trip_id

            LIMIT ?

        """, [
            origin_stop_id,
            destination_stop_id,
            departure_seconds,
            latest_departure,
            limit
        ]).fetchall()

        journeys = []

        for row in rows:

            (
                trip_id,
                route_id,
                route_name,
                route_key,
                agency,
                description,
                shape_id,
                boarding_sequence,
                alighting_sequence,
                boarding_seconds,
                alighting_seconds
            ) = row

            waiting = (
                boarding_seconds - departure_seconds
            ) / 60

            travel = (
                alighting_seconds - boarding_seconds
            ) / 60

            total = waiting + travel

            journeys.append({

                "trip_id": trip_id,
                "route_id": route_id,
                "route_name": route_name,
                "route_key": route_key,
                "agency": agency,
                "description": description,
                "shape_id": shape_id,

                "boarding_stop": origin,
                "alighting_stop": destination,

                "boarding_sequence": boarding_sequence,
                "alighting_sequence": alighting_sequence,

                "departure_time": seconds_to_gtfs_time(
                    boarding_seconds
                ),

                "arrival_time": seconds_to_gtfs_time(
                    alighting_seconds
                ),

                "waiting_minutes": round(waiting, 1),
                "travel_minutes": round(travel, 1),
                "duration_minutes": round(total, 1),

                "stops_travelled": (
                    alighting_sequence
                    - boarding_sequence
                ),

                "transfers": 0,
                "journey_type": "direct",
                "timing_source": "GTFS scheduled times"
            })

        return journeys

    finally:
        con.close()


def get_journey_stops(
    trip_id,
    boarding_sequence,
    alighting_sequence
):

    con = get_connection()

    try:

        rows = con.execute("""
            SELECT
                s.stop_id,
                s.stop_name,
                TRY_CAST(s.stop_lat AS DOUBLE),
                TRY_CAST(s.stop_lon AS DOUBLE),
                st.arrival_time,
                st.departure_time,
                TRY_CAST(
                    st.stop_sequence AS INTEGER
                ) AS sequence

            FROM stop_times st

            JOIN stops s
                ON st.stop_id = s.stop_id

            WHERE st.trip_id = ?

              AND TRY_CAST(
                    st.stop_sequence AS INTEGER
                  ) BETWEEN ? AND ?

            ORDER BY sequence

        """, [
            trip_id,
            boarding_sequence,
            alighting_sequence
        ]).fetchall()

        return [
            {
                "stop_id": row[0],
                "stop_name": row[1],
                "latitude": row[2],
                "longitude": row[3],
                "arrival_time": row[4],
                "departure_time": row[5],
                "sequence": row[6]
            }

            for row in rows
        ]

    finally:
        con.close()
