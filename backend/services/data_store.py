
from pathlib import Path
import duckdb


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

REQUIRED_FILES = [
    "routes",
    "stops",
    "trips",
    "stop_times",
    "shapes",
    "calendar",
    "crowding_profiles",
    "daily_demand",
    "scheduled_frequency"
]


def get_connection():

    con = duckdb.connect()

    con.execute("SET TimeZone = 'Asia/Kolkata'")

    for table in REQUIRED_FILES:

        path = DATA / f"{table}.parquet"

        if not path.exists():
            con.close()

            raise FileNotFoundError(
                f"Required dataset missing: {path.name}"
            )

        con.read_parquet(
            str(path)
        ).create_view(table)

    return con


def gtfs_time_to_seconds(value):

    hours, minutes, seconds = map(
        int, value.split(":")
    )

    if hours < 0 or not 0 <= minutes < 60 or not 0 <= seconds < 60:
        raise ValueError("Invalid GTFS time")

    return hours * 3600 + minutes * 60 + seconds


def seconds_to_gtfs_time(value):

    value = int(value)

    hours = value // 3600
    minutes = (value % 3600) // 60
    seconds = value % 60

    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
