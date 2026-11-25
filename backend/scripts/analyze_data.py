
from pathlib import Path
import pandas as pd
import duckdb
import re

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"


def locate(folder, filename):
    files = list(folder.rglob(filename))
    if not files:
        raise FileNotFoundError(filename)
    return files[0]


GTFS = RAW / "gtfs"
TICKETS = locate(RAW / "ticketing", "October-Delhi.csv")


def normalize_route(value):
    if pd.isna(value):
        return ""
    return re.sub(r"[^A-Z0-9]", "", str(value).upper())


print("\n=== TRANSITIQ DATASET ANALYSIS ===")

# 1. Inspect GTFS datasets

gtfs_data = {}

for name in [
    "agency",
    "calendar",
    "feed_info",
    "routes",
    "stops",
    "trips",
    "stop_times",
    "shapes"
]:
    path = locate(GTFS, f"{name}.txt")

    df = pd.read_csv(
        path,
        dtype=str,
        low_memory=False
    )

    print(f"\n--- {name.upper()} ---")
    print("Records:", len(df))
    print("Columns:", df.columns.tolist())
    print(df.head(2).to_string(index=False))

    if name in ["routes", "stops", "trips"]:
        gtfs_data[name] = df


# 2. Inspect ticketing dataset efficiently

con = duckdb.connect()

con.read_csv(
    str(TICKETS),
    all_varchar=True
).create_view("tickets")

print("\n=== E-TICKETING SCHEMA ===")
print(con.sql("DESCRIBE tickets").df().to_string(index=False))

print("\n=== SAMPLE TICKETS ===")

# Avoid printing vehicle identifiers
columns = [
    "route",
    "start_stop_name",
    "end_stop_name",
    "passenger_count",
    "created_at"
]

available = [
    row[0]
    for row in con.execute("DESCRIBE tickets").fetchall()
]

selected = [c for c in columns if c in available]

print(
    con.sql(
        f"SELECT {', '.join(selected)} FROM tickets LIMIT 5"
    ).df().to_string(index=False)
)


# 3. Dataset statistics

print("\n=== TICKETING STATISTICS ===")

print(con.sql("""
    SELECT
        COUNT(*) AS total_records,
        COUNT(DISTINCT route) AS unique_routes,
        COUNT(DISTINCT start_stop_name) AS boarding_stops,
        COUNT(DISTINCT end_stop_name) AS destination_stops,
        SUM(TRY_CAST(passenger_count AS BIGINT))
            AS total_passengers,
        MIN(created_at) AS earliest_raw_timestamp,
        MAX(created_at) AS latest_raw_timestamp
    FROM tickets
""").df().to_string(index=False))


# 4. Missing values

print("\n=== MISSING VALUES ===")

for col in columns:
    if col in available:
        missing = con.execute(f"""
            SELECT COUNT(*)
            FROM tickets
            WHERE "{col}" IS NULL
               OR TRIM("{col}") = ''
        """).fetchall()[0][0]

        print(f"{col}: {missing:,}")


# 5. Most frequently observed routes

print("\n=== TOP 15 TICKETING ROUTES ===")

print(con.sql("""
    SELECT
        route,
        COUNT(*) AS tickets,
        SUM(TRY_CAST(passenger_count AS BIGINT))
            AS passengers
    FROM tickets
    GROUP BY route
    ORDER BY tickets DESC
    LIMIT 15
""").df().to_string(index=False))


# 6. Compare GTFS and ticketing route names

print("\n=== ROUTE MATCHING ===")

routes = gtfs_data["routes"]

print("GTFS route columns:", routes.columns.tolist())

if "route_short_name" in routes.columns:

    gtfs_names = set(
        routes["route_short_name"]
        .map(normalize_route)
    ) - {""}

    ticket_routes = con.sql("""
        SELECT route, COUNT(*) AS tickets
        FROM tickets
        WHERE route IS NOT NULL
        GROUP BY route
    """).df()

    ticket_routes["normalized"] = (
        ticket_routes["route"].map(normalize_route)
    )

    matched = ticket_routes[
        ticket_routes["normalized"].isin(gtfs_names)
    ]

    unmatched = ticket_routes[
        ~ticket_routes["normalized"].isin(gtfs_names)
    ]

    print("Unique normalized GTFS routes:", len(gtfs_names))
    print("Unique ticket route labels:", len(ticket_routes))
    print("Matched ticket route labels:", len(matched))
    print("Unmatched ticket route labels:", len(unmatched))

    total = ticket_routes["tickets"].sum()

    if total > 0:
        coverage = 100 * matched["tickets"].sum() / total
        print(f"Matched ticket coverage: {coverage:.2f}%")

    print("\nTop unmatched routes:")

    print(
        unmatched.sort_values(
            "tickets", ascending=False
        ).head(15).to_string(index=False)
    )

else:
    print("Route name column requires inspection.")

con.close()

print("\n=== ANALYSIS COMPLETE ===")
