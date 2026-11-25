
from pathlib import Path
import pandas as pd
import numpy as np
import json
import time

START = time.time()

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

print("\n=== TRANSITIQ CROWDING MODEL ===")

# 1. Load preprocessed data

print("\n[1/7] Loading datasets...")

demand = pd.read_parquet(
    DATA / "daily_demand.parquet"
)

frequency = pd.read_parquet(
    DATA / "scheduled_frequency.parquet"
)

demand["service_date"] = pd.to_datetime(
    demand["service_date"]
)

demand["hour"] = demand["hour"].astype(int)
frequency["hour"] = frequency["hour"].astype(int)

print("Demand records:", len(demand))
print("Frequency records:", len(frequency))


# 2. Split training and validation data

print("\n[2/7] Creating chronological split...")

cutoff = pd.Timestamp("2026-10-25")

train = demand[
    demand["service_date"] < cutoff
].copy()

test = demand[
    demand["service_date"] >= cutoff
].copy()

print("Training: October 1-24")
print("Validation: October 25-31")
print("Training records:", len(train))
print("Validation records:", len(test))


# 3. Construct historical demand profiles

def build_profiles(data, dates):

    calendar = pd.DataFrame({
        "service_date": pd.to_datetime(dates)
    })

    calendar["day_type"] = np.where(
        calendar["service_date"].dt.day_of_week >= 5,
        "weekend",
        "weekday"
    )

    day_counts = (
        calendar.groupby("day_type")
        .size()
        .rename("total_days")
        .reset_index()
    )

    profiles = (
        data.groupby(
            ["route_key", "day_type", "hour"],
            as_index=False
        )
        .agg(
            passengers=("passenger_count", "sum"),
            tickets=("ticket_count", "sum"),
            observed_days=("service_date", "nunique")
        )
    )

    profiles = profiles.merge(
        day_counts,
        on="day_type",
        how="left"
    )

    profiles["avg_passengers"] = (
        profiles["passengers"]
        / profiles["total_days"]
    )

    profiles["coverage"] = (
        profiles["observed_days"]
        / profiles["total_days"]
    )

    return profiles


print("\n[3/7] Learning historical demand patterns...")

train_profiles = build_profiles(
    train,
    pd.date_range("2026-10-01", "2026-10-24")
)


# 4. Validate against unseen historical dates

print("\n[4/7] Evaluating model...")

test_profiles = build_profiles(
    test,
    pd.date_range("2026-10-25", "2026-10-31")
)

evaluation = test_profiles.merge(
    train_profiles[
        [
            "route_key",
            "day_type",
            "hour",
            "avg_passengers"
        ]
    ].rename(columns={
        "avg_passengers": "prediction"
    }),
    on=["route_key", "day_type", "hour"],
    how="left"
)

evaluation["prediction_available"] = (
    evaluation["prediction"].notna()
)

prediction_coverage = float(
    evaluation["prediction_available"].mean()
)

evaluation = evaluation.dropna(
    subset=["prediction"]
)

if evaluation.empty:
    raise RuntimeError(
        "No matching validation profiles found."
    )

actual = evaluation["avg_passengers"].to_numpy()
predicted = evaluation["prediction"].to_numpy()

mae = float(
    np.mean(np.abs(actual - predicted))
)

rmse = float(
    np.sqrt(np.mean((actual - predicted) ** 2))
)

wape = float(
    np.sum(np.abs(actual - predicted))
    / max(np.sum(actual), 1)
    * 100
)

print(f"MAE: {mae:.3f}")
print(f"RMSE: {rmse:.3f}")
print(f"WAPE: {wape:.2f}%")

print(
    f"Prediction coverage: "
    f"{prediction_coverage * 100:.2f}%"
)


# 5. Build final profiles using all October data

print("\n[5/7] Building final crowding profiles...")

profiles = build_profiles(
    demand,
    pd.date_range("2026-10-01", "2026-10-31")
)

profiles = profiles.merge(
    frequency,
    on=["route_key", "hour"],
    how="left"
)

# Missing frequency must not be treated
# as confirmed low crowdedness.

profiles["frequency_available"] = (
    profiles["scheduled_trips"].notna()
    & (profiles["scheduled_trips"] > 0)
)

profiles["demand_per_departure"] = np.where(
    profiles["frequency_available"],
    profiles["avg_passengers"]
    / profiles["scheduled_trips"],
    np.nan
)

valid = profiles[
    "demand_per_departure"
].dropna()

if valid.empty:
    raise RuntimeError(
        "No valid demand-to-frequency profiles."
    )

# A common scale allows comparison across routes.

reference = float(valid.quantile(0.95))

if reference <= 0:
    raise RuntimeError(
        "Invalid crowding reference value."
    )

# Smooth crowding score without hard saturation.

profiles["crowding_index"] = (
    100 * (
        1 - np.exp(
            -np.log(2)
            * profiles["demand_per_departure"]
            / reference
        )
    )
).clip(0, 100).round(1)


def classify(value):

    if pd.isna(value):
        return "unknown"

    if value <= 35:
        return "low"

    if value <= 70:
        return "moderate"

    return "high"


profiles["crowding_level"] = (
    profiles["crowding_index"].apply(classify)
)


# 6. Estimate data support

print("\n[6/7] Calculating data support...")

profiles["confidence"] = np.select(
    [
        (
            profiles["coverage"] >= 0.8
        )
        & (
            profiles["tickets"] >= 50
        )
        & profiles["frequency_available"],

        (
            profiles["coverage"] >= 0.4
        )
        & (
            profiles["tickets"] >= 10
        )
        & profiles["frequency_available"]
    ],
    [
        "high",
        "medium"
    ],
    default="low"
)

profiles.loc[
    ~profiles["frequency_available"],
    "confidence"
] = "unavailable"

# Save final model profiles.

profiles.to_parquet(
    DATA / "crowding_profiles.parquet",
    index=False
)

print("Final profiles:", len(profiles))

print(
    "\nCrowding distribution:\n",
    profiles["crowding_level"].value_counts()
)

print(
    "\nConfidence distribution:\n",
    profiles["confidence"].value_counts()
)


# 7. Save model evaluation and metadata

print("\n[7/7] Saving model metadata...")

metrics = {
    "model": "Historical demand-frequency model",
    "training_period": "2026-10-01 to 2026-10-24",
    "validation_period": "2026-10-25 to 2026-10-31",
    "validation_target": "Average recorded hourly passengers",
    "mae": round(mae, 4),
    "rmse": round(rmse, 4),
    "wape_percent": round(wape, 2),
    "prediction_coverage_percent": round(
        prediction_coverage * 100, 2
    ),
    "validation_profiles": int(len(evaluation)),
    "total_profiles": int(len(profiles)),
    "supported_routes": int(
        profiles["route_key"].nunique()
    ),
    "frequency_coverage_percent": round(
        float(
            profiles["frequency_available"].mean()
        ) * 100,
        2
    ),
    "crowding_reference_p95": round(reference, 4),
    "data_source": "ONDC e-ticketing and static GTFS",
    "etm_available": False,
    "is_actual_occupancy_percentage": False
}

with open(
    DATA / "model_metrics.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(metrics, file, indent=4)


print("\n=== MODEL METRICS ===")

print(json.dumps(metrics, indent=4))


# Example route profiles

print("\n=== EXAMPLE ROUTE: 717AUP ===")

example = profiles[
    (profiles["route_key"] == "717AUP")
    & (profiles["day_type"] == "weekday")
]

print(
    example[
        [
            "hour",
            "avg_passengers",
            "scheduled_trips",
            "crowding_index",
            "crowding_level",
            "confidence"
        ]
    ].sort_values("hour").round(2).to_string(index=False)
)

print(
    f"\nExecution time: {time.time() - START:.2f} seconds"
)

print("\n=== CROWDING MODEL COMPLETE ===")
