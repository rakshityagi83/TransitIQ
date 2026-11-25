
from services.data_store import get_connection


def search_stops(query, limit=10):

    query = query.strip()

    if not query:
        return []

    limit = max(1, min(int(limit), 50))

    con = get_connection()

    try:

        result = con.execute("""
            SELECT
                stop_id,
                stop_name,
                TRY_CAST(stop_lat AS DOUBLE) AS latitude,
                TRY_CAST(stop_lon AS DOUBLE) AS longitude
            FROM stops
            WHERE contains(
                LOWER(stop_name),
                LOWER(?)
            )
            ORDER BY
                CASE
                    WHEN LOWER(stop_name) = LOWER(?)
                    THEN 0

                    WHEN starts_with(
                        LOWER(stop_name),
                        LOWER(?)
                    )
                    THEN 1

                    ELSE 2
                END,
                LENGTH(stop_name),
                stop_name,
                stop_id
            LIMIT ?
        """, [
            query,
            query,
            query,
            limit
        ]).fetchall()

        return [
            {
                "stop_id": row[0],
                "stop_name": row[1],
                "latitude": row[2],
                "longitude": row[3]
            }
            for row in result
        ]

    finally:
        con.close()


def get_stop(stop_id):

    con = get_connection()

    try:

        rows = con.execute("""
            SELECT
                stop_id,
                stop_name,
                TRY_CAST(stop_lat AS DOUBLE),
                TRY_CAST(stop_lon AS DOUBLE)
            FROM stops
            WHERE stop_id = ?
        """, [str(stop_id)]).fetchall()

        if not rows:
            return None

        row = rows[0]

        return {
            "stop_id": row[0],
            "stop_name": row[1],
            "latitude": row[2],
            "longitude": row[3]
        }

    finally:
        con.close()
