
from services.data_store import (
    get_connection,
    gtfs_time_to_seconds,
    seconds_to_gtfs_time
)

from services.stop_service import get_stop


def find_transfer_journeys(
    origin_stop_id,
    destination_stop_id,
    departure_time,
    limit=20,
    max_wait_minutes=120,
    min_transfer_minutes=5,
    max_transfer_minutes=45
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

    start = gtfs_time_to_seconds(departure_time)

    if not 0 <= start < 86400:
        raise ValueError("Invalid departure time.")

    limit = max(1, min(int(limit), 100))

    con = get_connection()

    try:

        rows = con.execute("""
            WITH times AS MATERIALIZED (
                SELECT
                    trip_id,
                    stop_id,

                    TRY_CAST(stop_sequence AS INTEGER)
                        AS seq,

                    TRY_CAST(
                        split_part(arrival_time, ':', 1)
                        AS INTEGER
                    ) * 3600
                    + TRY_CAST(
                        split_part(arrival_time, ':', 2)
                        AS INTEGER
                    ) * 60
                    + TRY_CAST(
                        split_part(arrival_time, ':', 3)
                        AS INTEGER
                    ) AS arr,

                    TRY_CAST(
                        split_part(departure_time, ':', 1)
                        AS INTEGER
                    ) * 3600
                    + TRY_CAST(
                        split_part(departure_time, ':', 2)
                        AS INTEGER
                    ) * 60
                    + TRY_CAST(
                        split_part(departure_time, ':', 3)
                        AS INTEGER
                    ) AS dep

                FROM stop_times
            ),

            first_boarding AS (
                SELECT *
                FROM times
                WHERE stop_id = ?
                  AND dep BETWEEN ? AND ?
            ),

            first_legs AS (
                SELECT
                    a.trip_id AS trip1,
                    t.route_id AS route1,
                    b.stop_id AS transfer_stop,
                    a.seq AS board1,
                    b.seq AS exit1,
                    a.dep AS departure1,
                    b.arr AS arrival1

                FROM first_boarding a

                JOIN times b
                    ON a.trip_id = b.trip_id

                JOIN trips t
                    ON a.trip_id = t.trip_id

                WHERE b.seq > a.seq
                  AND b.arr > a.dep
                  AND b.stop_id NOT IN (?, ?)
            ),

            destination_arrivals AS (
                SELECT *
                FROM times
                WHERE stop_id = ?
                  AND arr BETWEEN ? AND ?
            ),

            second_legs AS (
                SELECT
                    a.trip_id AS trip2,
                    t.route_id AS route2,
                    a.stop_id AS transfer_stop,
                    a.seq AS board2,
                    b.seq AS exit2,
                    a.dep AS departure2,
                    b.arr AS arrival2

                FROM destination_arrivals b

                JOIN times a
                    ON a.trip_id = b.trip_id

                JOIN trips t
                    ON a.trip_id = t.trip_id

                WHERE a.seq < b.seq
                  AND b.arr > a.dep
                  AND a.stop_id NOT IN (?, ?)
            )

            SELECT
                f.trip1,
                s.trip2,
                f.route1,
                s.route2,
                r1.route_name,
                r2.route_name,
                r1.route_key,
                r2.route_key,
                f.transfer_stop,
                f.board1,
                f.exit1,
                s.board2,
                s.exit2,
                f.departure1,
                f.arrival1,
                s.departure2,
                s.arrival2

            FROM first_legs f

            JOIN second_legs s
                ON f.transfer_stop = s.transfer_stop

            JOIN routes r1
                ON f.route1 = r1.route_id

            JOIN routes r2
                ON s.route2 = r2.route_id

            WHERE f.trip1 != s.trip2
              AND r1.route_key != r2.route_key

              AND s.departure2 >= f.arrival1 + ?
              AND s.departure2 <= f.arrival1 + ?

              AND s.arrival2 <= ?

           QUALIFY ROW_NUMBER() OVER (
    PARTITION BY
        f.trip1,
        s.trip2
    ORDER BY
        s.departure2 - f.arrival1,
        f.arrival1,
        f.transfer_stop
) = 1

ORDER BY
    s.arrival2,
    f.departure1,
    f.trip1,
    s.trip2

LIMIT ?

        """, [
            origin_stop_id,
            start,
            start + max_wait_minutes * 60,
            origin_stop_id,
            destination_stop_id,
            destination_stop_id,
            start,
            start + 4 * 3600,
            origin_stop_id,
            destination_stop_id,
            min_transfer_minutes * 60,
            max_transfer_minutes * 60,
            start + 4 * 3600,
            limit
        ]).fetchall()

        journeys = []
        stop_cache = {}

        for row in rows:

            (
                trip1,
                trip2,
                route1,
                route2,
                name1,
                name2,
                key1,
                key2,
                transfer_id,
                board1,
                exit1,
                board2,
                exit2,
                dep1,
                arr1,
                dep2,
                arr2
            ) = row

            if transfer_id not in stop_cache:
                stop_cache[transfer_id] = get_stop(
                    transfer_id
                )

            transfer_stop = stop_cache[transfer_id]

            initial_wait = (dep1 - start) / 60
            transfer_wait = (dep2 - arr1) / 60

            travel1 = (arr1 - dep1) / 60
            travel2 = (arr2 - dep2) / 60

            total = (arr2 - start) / 60

            legs = [
                {
                    "trip_id": trip1,
                    "route_id": route1,
                    "route_name": name1,
                    "route_key": key1,
                    "boarding_stop": origin,
                    "alighting_stop": transfer_stop,
                    "boarding_sequence": board1,
                    "alighting_sequence": exit1,
                    "departure_time":
                        seconds_to_gtfs_time(dep1),
                    "arrival_time":
                        seconds_to_gtfs_time(arr1),
                    "travel_minutes": round(travel1, 1)
                },
                {
                    "trip_id": trip2,
                    "route_id": route2,
                    "route_name": name2,
                    "route_key": key2,
                    "boarding_stop": transfer_stop,
                    "alighting_stop": destination,
                    "boarding_sequence": board2,
                    "alighting_sequence": exit2,
                    "departure_time":
                        seconds_to_gtfs_time(dep2),
                    "arrival_time":
                        seconds_to_gtfs_time(arr2),
                    "travel_minutes": round(travel2, 1)
                }
            ]

            journeys.append({
                "trip_id":
                    f"{trip1}__{transfer_id}__{trip2}",

                "route_id": f"{route1}+{route2}",
                "route_name": f"{name1} + {name2}",
                "route_key": f"{key1}+{key2}",

                "boarding_stop": origin,
                "alighting_stop": destination,
                "transfer_stop": transfer_stop,

                "departure_time":
                    seconds_to_gtfs_time(dep1),

                "arrival_time":
                    seconds_to_gtfs_time(arr2),

                "waiting_minutes":
                    round(initial_wait, 1),

                "transfer_wait_minutes":
                    round(transfer_wait, 1),

                "travel_minutes":
                    round(travel1 + travel2, 1),

                "duration_minutes":
                    round(total, 1),

                "stops_travelled":
                    (exit1 - board1) + (exit2 - board2),

                "transfers": 1,
                "journey_type": "transfer",

                "timing_source":
                    "GTFS scheduled times",

                "legs": legs
            })

        return journeys

    finally:
        con.close()
