# TransitIQ — Technical Note

**Transport Stack Hackathon 2026 | Problem Statement 2**

**Team SAG**

## 1. Abstract

TransitIQ is a crowdedness-aware journey planning system designed for Delhi's public bus network. Unlike conventional journey planners that primarily optimize travel time, TransitIQ incorporates historical passenger demand, scheduled transport supply and prediction confidence into journey recommendations.

The system processes approximately 2.56 million real-world e-ticketing records alongside official GTFS schedules, generating 48,472 historical prediction profiles across 1,984 route keys.

TransitIQ supports direct and one-transfer journey planning, comfort-aware ranking, intelligent departure-time recommendations and interactive historical crowdedness analysis.

## 2. Data Sources and Processing

The system uses two primary datasets:

- Delhi Buses Static GTFS.
- October 2026 Delhi ONDC e-ticketing records.

| Data characteristic | Count |
|---|---:|
| Original ticketing records | 2,559,899 |
| Usable matched records | 2,518,947 |
| Recorded passengers in matched data | 2,709,551 |
| Supported route keys | 1,984 |
| Bus stops | 6,862 |
| Scheduled trips | 80,357 |
| Daily demand records | 413,938 |
| Historical prediction profiles | 48,472 |

Ticketing route identifiers are normalized and matched against GTFS routes. Passenger demand is aggregated by route, service date and hour. Scheduled bus departures are extracted from GTFS and combined with historical demand profiles.

Processed datasets are stored in Apache Parquet format and queried using DuckDB.

ETM records were unavailable during development. Consequently, the system estimates relative crowdedness from partial recorded passenger demand and scheduled transport supply rather than directly measuring vehicle occupancy.

## 3. Crowdedness Estimation

For a route r, hour h and day type d, average hourly recorded demand is calculated as:

μ(r,h,d) = Total recorded passengers / Number of applicable historical days

Demand is normalized by scheduled departure frequency:

D(r,h,d) = μ(r,h,d) / Scheduled departures(r,h)

The resulting demand-frequency ratio is converted into a bounded crowdedness index:

C = 100 × [1 − exp(−ln(2) × D/R)]

Here, R is the global 95th percentile of valid demand-per-departure values.

The transformation provides a common relative comparison scale across routes and hours.

Crowdedness classifications:

- Low: 0–35
- Moderate: above 35–70
- High: above 70–100
- Unknown: insufficient required information

Missing frequency information produces an unknown prediction rather than an artificially low index.

## 4. Confidence Estimation

Prediction confidence is based on historical observation coverage and ticket volume.

| Confidence | Minimum day coverage | Minimum tickets |
|---|---:|---:|
| High | 80% | 50 |
| Medium | 40% | 10 |
| Low | Below medium thresholds | — |
| Unavailable | Required profile or frequency missing | — |

High and medium confidence additionally require valid scheduled frequency.

Confidence represents historical data support rather than calibrated probability. The recommendation engine incorporates confidence penalties and avoids presenting unsupported predictions as reliable comfort recommendations.

## 5. Model Experimentation and Validation

Four prediction approaches were evaluated:

1. Constant route-average baseline.
2. Historical route-hour-day-type averaging.
3. Hierarchical demand smoothing.
4. Histogram Gradient Boosting regression.

The evaluation used chronological partitions:

- Initial training: October 1–17.
- Model selection: October 18–24.
- Final training: October 1–24.
- Final benchmark: October 25–31.

Historical machine-learning features were generated using earlier observations to avoid target leakage.

### Common Observed Profile Evaluation

| Model | MAE | RMSE | WAPE |
|---|---:|---:|---:|
| Constant baseline | 3.0703 | 6.4841 | 62.73% |
| Historical average | 1.3293 | 2.3357 | 27.16% |
| Hierarchical smoothing | 1.3035 | 2.2941 | 26.63% |
| Gradient boosting | 1.4182 | 2.7978 | 28.98% |

The evaluation covers 35,177 common observed profiles.

The historical averaging model was selected based on its lowest profile MAE during the model-selection period. It also achieved the lowest daily MAE in the final expanded evaluation.

Hierarchical smoothing achieved slightly better final aggregated profile accuracy, but the production model was not changed solely on the basis of final benchmark results.

### Key Validation Findings

- 56.7% MAE reduction against the constant baseline.
- 94.62% historical observed-profile prediction coverage.
- 76.87% scheduled frequency coverage among final profiles.
- 330,288 daily evaluation rows in the expanded benchmark.

Held-out recorded passenger demand also exhibited clear peak and off-peak patterns:

| Period | Mean recorded passengers per network hour |
|---|---:|
| Morning peak, 07:00–11:00 | 9,285.75 |
| Midday off-peak, 11:00–17:00 | 3,061.38 |
| Evening peak, 17:00–21:00 | 7,154.21 |

These findings support the presence of meaningful temporal demand patterns.

The validation measures recorded passenger demand prediction, not actual onboard occupancy accuracy. October 25–31 had also been examined in the original model evaluation and is therefore not claimed to be a completely untouched holdout.

## 6. Journey Planning and Optimization

TransitIQ searches static GTFS schedules for direct and one-transfer journeys.

Candidate journeys are evaluated using:

- Scheduled waiting and travel time.
- Predicted crowdedness.
- Prediction confidence.
- Transfer requirements.
- User-selected comfort preference.

The ranking objective is:

Score = 100 × [(1 − w)T + wCₑ + P]

Where:

- w is the user-selected comfort weight between zero and one.
- T is normalized additional journey time.
- Cₑ is normalized confidence-adjusted crowdedness.
- P is a transfer penalty.

Lower scores represent preferable journeys under the ranking objective.

An additional-time budget prevents excessive detours for comfort. Transfer crowdedness is estimated using travel-time-weighted individual leg predictions.

The search is bounded for computational efficiency and does not claim globally optimal routing across all possible transfers.

## 7. Smart Departure Advisor

The Smart Departure Advisor extends journey planning into departure-time optimization.

It evaluates up to five departure windows at 15-minute intervals, covering the original requested time and the following hour.

Rather than rerunning the full routing engine for every window, the advisor reuses a shared candidate search with a 120-minute departure horizon.

Recommendations account for:

- Scheduled boarding and arrival times.
- Additional elapsed time relative to the original request.
- Predicted crowdedness reduction.
- Historical confidence.
- Transfer penalties.
- Duplicate journey alternatives.

A later departure is recommended only when it provides a meaningful predicted crowdedness reduction within the defined additional-time budget.

## 8. Demonstrated Journey

Origin: Rohini Sec 22 Terminal.

Destination: Kohat Enclave Metro Station.

Requested departure: November 26, 2026, 08:00 IST.

Comfort preference: 0.8.

| Metric | Original journey | Suggested alternative |
|---|---|---|
| Route | 102DOWN | 102ADOWN |
| Boarding time | 08:10 | 08:35 |
| Total elapsed time | 49.9 minutes | 74.3 minutes |
| Crowdedness index | 39.4 | 20.8 |
| Confidence | Medium | Medium |

The advisor identified an 18.6-point reduction in the predicted crowdedness index, equivalent to a 47.2% relative reduction, at the cost of 24.4 additional minutes.

This demonstrates an actionable commuter trade-off rather than a claim of measured occupancy reduction.

The system also successfully handled a transfer journey for which no sufficiently better later departure existed.

## 9. System Architecture

The architecture consists of:

**Data layer:** GTFS and ONDC ticketing, preprocessing, Parquet storage and DuckDB.

**Intelligence layer:** Historical demand estimation, frequency-adjusted crowdedness, model benchmarking, confidence-aware ranking and departure optimization.

**Application layer:** FastAPI REST endpoints and a React frontend providing journey planning, interactive maps, route exploration and network analytics.

**Deployment layer:** A multi-stage Docker image that serves the compiled frontend and backend through a single HTTP endpoint.

No external database server or paid inference API is required.

## 10. Testing and Reproducibility

The application includes 30 automated backend tests covering API functionality, routing, ranking, prediction handling and departure recommendations.

Final verified results:

- Windows: 30 tests passed in 11.43 seconds.
- Linux Docker: 30 tests passed in 12.91 seconds.
- Frontend ESLint: passed.
- Frontend production compilation: passed.
- Docker production image: successfully built and started locally.

The source repository includes dataset preparation scripts, model training scripts, benchmark results, API documentation, setup instructions and Docker configuration.

Raw and processed datasets are excluded from Git. Authorized dataset access is required to reproduce the application.

## 11. Limitations and Future Work

Current limitations include partial ONDC demand coverage, unavailable ETM data, static rather than live bus schedules, missing frequency information and bounded direct or one-transfer routing.

The relative crowdedness index has not been calibrated against observed onboard passenger counts or vehicle capacity.

Future development will focus on ETM integration, stop-level demand estimation, live transport information, calibrated uncertainty, expanded routing and real-world commuter evaluation.

Public cloud deployment remains subject to data access and redistribution permissions.

## 12. Conclusion

TransitIQ demonstrates how real-world transport datasets can be transformed into practical commuter decision support.

Its contribution is not limited to predicting crowdedness: the system integrates historical predictions into actionable journey and departure-time recommendations while explicitly communicating confidence, limitations and travel-time trade-offs.
