
from pathlib import Path
import duckdb
import json
import time

START = time.time()

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

PROCESSED.mkdir(parents=True, exist_ok=True)


def locate(folder, filename):
    files = list(folder.rglob(filename))

    if not files:
        raise FileNotFoundError(filename)

    return files[0]


con = duckdb.connect()
con.execute("SET TimeZone = 'Asia/Kolkata'")
con.execute("SET memory_limit = '2GB'")

print("\n=== TRANSITIQ PREPROCESSING ===")

# 1. Load GTFS datasets

print("\n[1/7] Loading GTFS datasets...")

for table in [
    "routes",
    "stops",
    "trips",
    "stop_times",
    "shapes",
    "calendar"
]:
    path = locate(RAW / "gtfs", f"{table}.txt")

    con.read_csv(
        str(path),
        all_varchar=True
    ).create_view(table)

    print(f"Loaded {table}")


# 2. Create normalized route mapping

print("\n[2/7] Creating route mapping...")

con.execute("""
    CREATE TABLE route_mapping AS
    SELECT
        route_id,
        agency_id,
        route_short_name AS route_name,
        route_desc AS description,
        regexp_replace(
            upper(trim(route_short_name)),
            '[^A-Z0-9]',
            '',
            'g'
        ) AS route_key
    FROM routes
    WHERE route_short_name IS NOT NULL
""")


# 3. Load and clean ticketing data

print("\n[3/7] Cleaning ticketing records...")

ticket_path = locate(
    RAW / "ticketing",
    "October-Delhi.csv"
)

con.read_csv(
    str(ticket_path),
    all_varchar=True
).create_view("raw_tickets")

con.execute("""
    CREATE TABLE clean_tickets AS
    WITH parsed AS (
        SELECT
            regexp_replace(
                upper(trim(route)),
                '[^A-Z0-9]',
                '',
                'g'
            ) AS route_key,
            trim(start_stop_name) AS boarding_stop,
            trim(end_stop_name) AS destination_stop,
            TRY_CAST(
                passenger_count AS INTEGER
            ) AS passengers,
            TRY_CAST(
                created_at AS TIMESTAMPTZ
            ) AS ticket_time
        FROM raw_tickets
    )
    SELECT
        route_key,
        boarding_stop,
        destination_stop,
        passengers,
        ticket_time,
        CAST(ticket_time AS DATE) AS service_date,
        EXTRACT(HOUR FROM ticket_time)::INTEGER AS hour,
        CASE
            WHEN EXTRACT(ISODOW FROM ticket_time)
                IN (6, 7)
            THEN 'weekend'
            ELSE 'weekday'
        END AS day_type
    FROM parsed
    WHERE passengers > 0
      AND ticket_time IS NOT NULL
      AND route_key != ''
      AND CAST(ticket_time AS DATE)
          BETWEEN DATE '2026-10-01'
              AND DATE '2026-10-31'
      AND route_key IN (
          SELECT route_key FROM route_mapping
      )
""")


# 4. Aggregate daily passenger demand

print("\n[4/7] Calculating hourly passenger demand...")

con.execute("""
    CREATE TABLE daily_demand AS
    SELECT
        route_key,
        service_date,
        day_type,
        hour,
        COUNT(*) AS ticket_count,
        SUM(passengers) AS passenger_count
    FROM clean_tickets
    GROUP BY
        route_key,
        service_date,
        day_type,
        hour
""")


# 5. Calculate scheduled trip frequencies

print("\n[5/7] Calculating scheduled bus frequencies...")

con.execute("""
    CREATE TABLE first_departures AS
    SELECT
        trip_id,
        arg_min(
            departure_time,
            TRY_CAST(stop_sequence AS INTEGER)
        ) AS departure
    FROM stop_times
    GROUP BY trip_id
""")

con.execute("""
    CREATE TABLE scheduled_frequency AS
    WITH departures AS (
        SELECT
            r.route_key,
            t.trip_id,
            TRY_CAST(
                split_part(f.departure, ':', 1)
                AS INTEGER
            ) AS departure_hour
        FROM trips t
        JOIN route_mapping r
            ON t.route_id = r.route_id
        JOIN first_departures f
            ON t.trip_id = f.trip_id
    )
    SELECT
        route_key,
        departure_hour % 24 AS hour,
        COUNT(DISTINCT trip_id) AS scheduled_trips
    FROM departures
    WHERE departure_hour >= 0
    GROUP BY route_key, departure_hour % 24
""")


# 6. Export processed data

print("\n[6/7] Exporting processed datasets...")

exports = {
    "routes": "route_mapping",
    "stops": "stops",
    "trips": "trips",
    "stop_times": "stop_times",
    "shapes": "shapes",
    "calendar": "calendar",
    "daily_demand": "daily_demand",
    "scheduled_frequency": "scheduled_frequency"
}

for filename, table in exports.items():

    output = PROCESSED / f"{filename}.parquet"

    con.table(table).write_parquet(
        str(output),
        compression="zstd"
    )

    size_mb = output.stat().st_size / (1024 * 1024)

    print(f"Saved {output.name}: {size_mb:.2f} MB")


# 7. Generate processing summary

print("\n[7/7] Generating summary...")


def scalar(query):
    return con.execute(query).fetchall()[0][0]


summary = {
    "raw_ticket_records": scalar(
        "SELECT COUNT(*) FROM raw_tickets"
    ),
    "valid_matched_tickets": scalar(
        "SELECT COUNT(*) FROM clean_tickets"
    ),
    "matched_passengers": scalar(
        "SELECT SUM(passengers) FROM clean_tickets"
    ),
    "covered_route_keys": scalar(
        "SELECT COUNT(DISTINCT route_key) FROM clean_tickets"
    ),
    "daily_demand_records": scalar(
        "SELECT COUNT(*) FROM daily_demand"
    ),
    "frequency_records": scalar(
        "SELECT COUNT(*) FROM scheduled_frequency"
    ),
    "date_start": "2026-10-01",
    "date_end": "2026-10-31",
    "timezone": "Asia/Kolkata",
    "data_source": "ONDC e-ticketing and static GTFS",
    "etm_available": False
}

summary["usable_ticket_percentage"] = round(
    100 * summary["valid_matched_tickets"]
    / summary["raw_ticket_records"],
    2
)

with open(
    PROCESSED / "metadata.json",
    "w",
    encoding="utf-8"
) as file:
    json.dump(summary, file, indent=4, default=str)

print("\n=== PROCESSING SUMMARY ===")
print(json.dumps(summary, indent=4, default=str))

con.close()

print(
    f"\nExecution time: {time.time() - START:.2f} seconds"
)

print("\n=== PREPROCESSING COMPLETE ===")
