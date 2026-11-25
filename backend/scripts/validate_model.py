
from pathlib import Path
import json
import numpy as np
import pandas as pd


DATA = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "processed"
)

print("=== TRANSITIQ MODEL VALIDATION ===")

demand = pd.read_parquet(
    DATA / "daily_demand.parquet"
)

profiles = pd.read_parquet(
    DATA / "crowding_profiles.parquet"
)

demand["service_date"] = pd.to_datetime(
    demand["service_date"]
)

cutoff = pd.Timestamp("2026-10-25")

train = demand[
    demand["service_date"] < cutoff
].copy()

test = demand[
    demand["service_date"] >= cutoff
].copy()


# 1. Chronological validation

def build_profiles(data, start, end):

    calendar = pd.DataFrame({
        "service_date": pd.date_range(start, end)
    })

    calendar["day_type"] = np.where(
        calendar["service_date"].dt.day_of_week >= 5,
        "weekend",
        "weekday"
    )

    counts = calendar.groupby("day_type").size()

    result = (
        data.groupby(
            ["route_key", "day_type", "hour"],
            as_index=False
        )["passenger_count"]
        .sum()
    )

    result["avg_passengers"] = (
        result["passenger_count"]
        / result["day_type"].map(counts)
    )

    return result


train_profiles = build_profiles(
    train,
    "2026-10-01",
    "2026-10-24"
)

test_profiles = build_profiles(
    test,
    "2026-10-25",
    "2026-10-31"
)


# 2. Compare against a simple baseline

# Baseline ignores hour-of-day and day-type.
# It predicts a constant demand for each route.

baseline = (
    train.groupby("route_key")["passenger_count"]
    .sum()
    .div(24 * 24)
    .rename("baseline")
    .reset_index()
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

coverage = float(
    evaluation["prediction"].notna().mean()
)

evaluation = evaluation.merge(
    baseline,
    on="route_key",
    how="left"
)

evaluation = evaluation.dropna(
    subset=["prediction", "baseline"]
)

if evaluation.empty:
    raise RuntimeError("No comparable profiles.")


def calculate_metrics(actual, predicted):

    actual = np.asarray(actual)
    predicted = np.asarray(predicted)

    return {
        "mae": round(float(
            np.mean(np.abs(actual - predicted))
        ), 4),

        "rmse": round(float(
            np.sqrt(
                np.mean((actual - predicted) ** 2)
            )
        ), 4),

        "wape_percent": round(float(
            100 * np.abs(
                actual - predicted
            ).sum() / max(actual.sum(), 1)
        ), 2)
    }


model_metrics = calculate_metrics(
    evaluation["avg_passengers"],
    evaluation["prediction"]
)

baseline_metrics = calculate_metrics(
    evaluation["avg_passengers"],
    evaluation["baseline"]
)

improvement = round(
    100 * (
        baseline_metrics["mae"]
        - model_metrics["mae"]
    ) / max(baseline_metrics["mae"], 1e-9),
    2
)

print("\n=== MODEL VS BASELINE ===")

print("Model:", model_metrics)
print("Baseline:", baseline_metrics)
print("MAE improvement:", improvement, "%")
print("Evaluation profiles:", len(evaluation))
print("Prediction coverage:", round(
    coverage * 100, 2
), "%")


# 3. Hourly network demand patterns

# Use held-out validation dates only.

hourly = (
    test.groupby("hour")["passenger_count"]
    .sum()
    .reindex(range(24), fill_value=0)
    .div(7)
)

print("\n=== AVERAGE DAILY HOURLY DEMAND ===")
print(hourly.round(2).to_string())

morning_hours = [7, 8, 9, 10]
evening_hours = [17, 18, 19, 20]
off_peak_hours = [11, 12, 13, 14, 15, 16]

morning = float(
    hourly.loc[morning_hours].mean()
)

evening = float(
    hourly.loc[evening_hours].mean()
)

off_peak = float(
    hourly.loc[off_peak_hours].mean()
)

print("\n=== PEAK VS OFF-PEAK ===")

print("Morning peak:", round(morning, 2))
print("Evening peak:", round(evening, 2))
print("Midday off-peak:", round(off_peak, 2))

print("Busiest hour:", int(hourly.idxmax()))


# 4. Weekday vs weekend patterns

daily = (
    demand.groupby(
        ["service_date", "day_type"]
    )["passenger_count"]
    .sum()
    .reset_index()
)

day_comparison = (
    daily.groupby("day_type")["passenger_count"]
    .mean()
)

print("\n=== WEEKDAY VS WEEKEND ===")
print(day_comparison.round(2).to_string())


# 5. Crowdedness index distribution

print("\n=== CROWDING DISTRIBUTION ===")

crowding_distribution = (
    profiles["crowding_level"].value_counts()
)

print(crowding_distribution.to_string())


# 6. Confidence distribution

print("\n=== CONFIDENCE DISTRIBUTION ===")

confidence_distribution = (
    profiles["confidence"].value_counts()
)

print(confidence_distribution.to_string())


# 7. Frequency coverage

frequency_coverage = float(
    profiles["frequency_available"].mean()
    * 100
)

print("\n=== FREQUENCY COVERAGE ===")
print(round(frequency_coverage, 2), "%")


# 8. Save validation report

report = {

    "model": model_metrics,

    "baseline": baseline_metrics,

    "baseline_description": (
        "Constant mean hourly demand per route, "
        "without hour-of-day or day-type effects"
    ),

    "mae_improvement_percent": improvement,

    "evaluation_profiles": len(evaluation),

    "prediction_coverage_percent": round(
        coverage * 100, 2
    ),

    "frequency_coverage_percent": round(
        frequency_coverage, 2
    ),

    "peak_analysis": {
        "morning": round(morning, 2),
        "evening": round(evening, 2),
        "midday_off_peak": round(off_peak, 2),
        "busiest_hour": int(hourly.idxmax())
    },

    "hourly_demand": [
        {
            "hour": int(hour),
            "avg_passengers": round(float(value), 2)
        }
        for hour, value in hourly.items()
    ],

    "day_type_demand": {
        str(key): round(float(value), 2)
        for key, value in day_comparison.items()
    },

    "crowding_distribution": {
        str(key): int(value)
        for key, value in crowding_distribution.items()
    },

    "confidence_distribution": {
        str(key): int(value)
        for key, value in confidence_distribution.items()
    },

    "limitations": [
        "ONDC ticketing data represents recorded demand",
        "ETM dataset unavailable",
        "Scheduled rather than observed bus frequency",
        "Missing ticket observations treated as zero recorded demand",
        "Crowding index is not actual bus occupancy",
        "Confidence represents historical data support",
        "Validation uses matched observed profiles",
        "Baseline includes all 24 hours of each training day"
    ]
}

with open(
    DATA / "validation_report.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(report, file, indent=4)

print("\nValidation report saved successfully.")
print("=== VALIDATION COMPLETE ===")
