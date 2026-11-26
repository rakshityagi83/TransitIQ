
from pathlib import Path
import json
import time

import numpy as np
import pandas as pd

from sklearn.ensemble import HistGradientBoostingRegressor


START = time.time()

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

KEYS = ["route_key", "day_type", "hour"]

print("=== TRANSITIQ ADVANCED MODEL BENCHMARK ===")


# 1. Load datasets

demand = pd.read_parquet(DATA / "daily_demand.parquet")
frequency = pd.read_parquet(DATA / "scheduled_frequency.parquet")

demand["service_date"] = pd.to_datetime(demand["service_date"])
demand["hour"] = demand["hour"].astype(int)
frequency["hour"] = frequency["hour"].astype(int)

print("Demand records:", len(demand))
print("Frequency records:", len(frequency))


# 2. Construct daily route-hour observations

def make_grid(routes, start, end):

    dates = pd.date_range(start, end)

    grid = pd.MultiIndex.from_product(
        [routes, dates, range(24)],
        names=["route_key", "service_date", "hour"]
    ).to_frame(index=False)

    grid = grid.merge(
        demand[
            [
                "route_key",
                "service_date",
                "hour",
                "passenger_count"
            ]
        ],
        on=["route_key", "service_date", "hour"],
        how="left"
    )

    grid["observed"] = (
        grid["passenger_count"].notna().astype(int)
    )

    grid["passenger_count"] = (
        grid["passenger_count"].fillna(0)
    )

    grid["day_of_week"] = (
        grid["service_date"].dt.day_of_week
    )

    grid["day_type"] = np.where(
        grid["day_of_week"] >= 5,
        "weekend",
        "weekday"
    )

    return grid


def historical_grid(start, end):

    subset = demand[
        demand["service_date"].between(start, end)
    ]

    routes = sorted(subset["route_key"].unique())

    return make_grid(routes, start, end)


# 3. Historical feature engineering

def add_features(history, target):

    route_stats = (
        history.groupby("route_key")["passenger_count"]
        .mean()
        .rename("route_mean")
        .reset_index()
    )

    hour_stats = (
        history.groupby(
            ["route_key", "hour"],
            as_index=False
        )
        .agg(
            route_hour_mean=("passenger_count", "mean")
        )
    )

    type_stats = (
        history.groupby(KEYS, as_index=False)
        .agg(
            historical_mean=("passenger_count", "mean"),
            observed_days=("observed", "sum"),
            total_days=("observed", "size")
        )
    )

    type_stats["coverage"] = (
        type_stats["observed_days"]
        / type_stats["total_days"]
    )

    result = target.merge(
        route_stats,
        on="route_key",
        how="left"
    )

    result = result.merge(
        hour_stats,
        on=["route_key", "hour"],
        how="left"
    )

    result = result.merge(
        type_stats,
        on=KEYS,
        how="left"
    )

    result = result.merge(
        frequency,
        on=["route_key", "hour"],
        how="left"
    )

    result["scheduled_trips"] = (
        result["scheduled_trips"].fillna(-1)
    )

    result["hour_sin"] = np.sin(
        2 * np.pi * result["hour"] / 24
    )

    result["hour_cos"] = np.cos(
        2 * np.pi * result["hour"] / 24
    )

    result["weekday_sin"] = np.sin(
        2 * np.pi * result["day_of_week"] / 7
    )

    result["weekday_cos"] = np.cos(
        2 * np.pi * result["day_of_week"] / 7
    )

    result["is_weekend"] = (
        result["day_of_week"] >= 5
    ).astype(int)

    return result


FEATURES = [
    "hour",
    "day_of_week",
    "is_weekend",
    "hour_sin",
    "hour_cos",
    "weekday_sin",
    "weekday_cos",
    "scheduled_trips",
    "route_mean",
    "route_hour_mean",
    "historical_mean",
    "coverage",
    "observed_days"
]


# 4. Hierarchical smoothing model

def smoothed_prediction(frame, alpha):

    support = frame["observed_days"].fillna(0)

    specific = frame["historical_mean"].fillna(0)

    broader = (
        frame["route_hour_mean"]
        .fillna(frame["route_mean"])
        .fillna(0)
    )

    prediction = (
        support * specific + alpha * broader
    ) / (support + alpha)

    return prediction.clip(lower=0)


# 5. Create leakage-safe ML training features
# Historical features only use earlier dates.

def make_ml_training(end):

    end = pd.Timestamp(end)

    blocks = []

    block_start = pd.Timestamp("2026-10-08")

    while block_start <= end:

        history_end = block_start - pd.Timedelta(days=1)

        block_end = min(
            block_start + pd.Timedelta(days=6),
            end
        )

        history = historical_grid(
            "2026-10-01",
            history_end
        )

        routes = sorted(history["route_key"].unique())

        target = make_grid(
            routes,
            block_start,
            block_end
        )

        features = add_features(history, target)

        blocks.append(features)

        print(
            "ML training block:",
            block_start.date(),
            "to",
            block_end.date(),
            "| rows:",
            len(features)
        )

        block_start = block_end + pd.Timedelta(days=1)

    return pd.concat(blocks, ignore_index=True)


def train_gradient_model(end):

    training = make_ml_training(end)

    model = HistGradientBoostingRegressor(
        loss="poisson",
        learning_rate=0.08,
        max_iter=120,
        max_leaf_nodes=31,
        min_samples_leaf=40,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=42
    )

    print("Training gradient boosting on", len(training), "rows")

    model.fit(
        training[FEATURES],
        training["passenger_count"]
    )

    return model


# 6. Evaluation metrics

def metrics(actual, prediction):

    actual = np.asarray(actual, dtype=float)
    prediction = np.asarray(prediction, dtype=float)

    error = actual - prediction

    return {
        "mae": round(float(np.abs(error).mean()), 4),

        "rmse": round(
            float(np.sqrt(np.mean(error ** 2))),
            4
        ),

        "wape_percent": round(
            float(
                100 * np.abs(error).sum()
                / max(actual.sum(), 1)
            ),
            2
        )
    }


def evaluate(frame, prediction):

    evaluation = frame[
        KEYS + ["passenger_count"]
    ].copy()

    evaluation["prediction"] = np.asarray(prediction)

    # Primary target: average hourly recorded demand.
    aggregated = (
        evaluation.groupby(KEYS, as_index=False)
        .agg(
            actual=("passenger_count", "mean"),
            predicted=("prediction", "mean")
        )
    )

    return {
        "profile": metrics(
            aggregated["actual"],
            aggregated["predicted"]
        ),
        "daily": metrics(
            frame["passenger_count"],
            prediction
        )
    }


# 7. Generate model predictions

def predict_all(frame, model, alpha):

    return {
        "M0_constant": (
            frame["route_mean"].fillna(0)
        ),

        "M1_historical": (
            frame["historical_mean"].fillna(0)
        ),

        "M2_hierarchical": (
            smoothed_prediction(frame, alpha)
        ),

        "M3_gradient_boosting": (
            np.maximum(
                model.predict(frame[FEATURES]),
                0
            )
        )
    }


# 8. Tune using October 18-24 only

print("\n=== TUNING PERIOD ===")

history = historical_grid(
    "2026-10-01",
    "2026-10-17"
)

routes = sorted(history["route_key"].unique())

tuning = make_grid(
    routes,
    "2026-10-18",
    "2026-10-24"
)

tuning = add_features(history, tuning)

alpha_results = {}

for alpha in [1, 2, 5, 10, 20]:

    result = evaluate(
        tuning,
        smoothed_prediction(tuning, alpha)
    )

    alpha_results[alpha] = result["profile"]["mae"]

    print(
        "Alpha:",
        alpha,
        "| Profile MAE:",
        result["profile"]["mae"]
    )

best_alpha = min(alpha_results, key=alpha_results.get)

print("Selected smoothing alpha:", best_alpha)

tuning_model = train_gradient_model("2026-10-17")

tuning_predictions = predict_all(
    tuning,
    tuning_model,
    best_alpha
)

tuning_results = {
    name: evaluate(tuning, prediction)
    for name, prediction in tuning_predictions.items()
}

print("\n=== TUNING RESULTS ===")
print(json.dumps(tuning_results, indent=2))

selected_model = min(
    tuning_results,
    key=lambda name: tuning_results[name]["profile"]["mae"]
)

print("Selected model:", selected_model)

del history, tuning, tuning_model, tuning_predictions


# 9. Final chronological benchmark

print("\n=== FINAL BENCHMARK: OCTOBER 25-31 ===")

history = historical_grid(
    "2026-10-01",
    "2026-10-24"
)

routes = sorted(history["route_key"].unique())

testing = make_grid(
    routes,
    "2026-10-25",
    "2026-10-31"
)

testing = add_features(history, testing)

final_model = train_gradient_model("2026-10-24")

predictions = predict_all(
    testing,
    final_model,
    best_alpha
)

final_results = {
    name: evaluate(testing, prediction)
    for name, prediction in predictions.items()
}


# 10. Compare on historically supported,
# observed validation profiles as well.

common = testing[KEYS + [
    "passenger_count",
    "observed",
    "observed_days"
]].copy()

for name, prediction in predictions.items():
    common[name] = np.asarray(prediction)

aggregation = {
    "actual": ("passenger_count", "mean"),
    "test_observed_days": ("observed", "sum"),
    "train_observed_days": ("observed_days", "first")
}

for name in predictions:
    aggregation[name] = (name, "mean")

common = common.groupby(
    KEYS,
    as_index=False
).agg(**aggregation)

common = common[
    (common["test_observed_days"] > 0)
    & (common["train_observed_days"] > 0)
]

common_results = {
    name: metrics(common["actual"], common[name])
    for name in predictions
}


# 11. Coverage checks

actual_test = demand[
    demand["service_date"].between(
        "2026-10-25",
        "2026-10-31"
    )
]

route_coverage = (
    actual_test["route_key"].isin(routes).mean() * 100
)

all_observed_profiles = (
    actual_test[KEYS].drop_duplicates()
)

historical_profiles = (
    history[history["observed"] > 0][KEYS]
    .drop_duplicates()
)

matched_profiles = all_observed_profiles.merge(
    historical_profiles,
    on=KEYS,
    how="inner"
)

historical_coverage = (
    100 * len(matched_profiles)
    / max(len(all_observed_profiles), 1)
)


# 12. Print final results

print("\n=== ALL KNOWN-ROUTE PROFILES ===")

for name, result in final_results.items():

    print(
        name,
        "| Profile MAE:",
        result["profile"]["mae"],
        "| Daily MAE:",
        result["daily"]["mae"],
        "| Profile WAPE:",
        result["profile"]["wape_percent"]
    )

print("\n=== COMMON OBSERVED PROFILES ===")

for name, result in common_results.items():
    print(name, result)

print("\nSelected using tuning period:", selected_model)
print("Common evaluation profiles:", len(common))
print("Daily evaluation rows:", len(testing))

print(
    "Known-route record coverage:",
    round(float(route_coverage), 2),
    "%"
)

print(
    "Historical observed-profile coverage:",
    round(float(historical_coverage), 2),
    "%"
)


# 13. Save independent benchmark report

report = {
    "training_period": "2026-10-01 to 2026-10-17",
    "tuning_period": "2026-10-18 to 2026-10-24",
    "final_training_period": "2026-10-01 to 2026-10-24",
    "benchmark_period": "2026-10-25 to 2026-10-31",

    "selected_alpha": best_alpha,
    "alpha_tuning_results": alpha_results,
    "selected_model": selected_model,

    "tuning_results": tuning_results,
    "final_results": final_results,
    "common_observed_profile_results": common_results,

    "daily_evaluation_rows": int(len(testing)),
    "common_evaluation_profiles": int(len(common)),

    "known_route_record_coverage_percent": round(
        float(route_coverage), 2
    ),

    "historical_profile_coverage_percent": round(
        float(historical_coverage), 2
    ),

    "limitations": [
        "Missing ticket observations represent zero recorded demand, not zero occupancy.",
        "Evaluation is restricted to routes known during training.",
        "October 25-31 was previously examined in the original model evaluation.",
        "Scheduled frequency does not establish actual bus capacity or occupancy.",
        "ETM data remains unavailable.",
        "Benchmark does not overwrite the production model."
    ]
}

with open(
    DATA / "model_benchmark.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(report, file, indent=4)

print("\nBenchmark saved to model_benchmark.json")

print(
    "Execution time:",
    round(time.time() - START, 2),
    "seconds"
)

print("\n=== BENCHMARK COMPLETE ===")
