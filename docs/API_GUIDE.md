
# TransitIQ Frontend Integration Guide

## Technology Stack

- React + Vite
- Tailwind CSS
- Leaflet / React Leaflet
- Lucide React
- Recharts

## Backend Base URL

http://127.0.0.1:8000

Interactive API documentation:

http://127.0.0.1:8000/docs

## 1. Health Check

GET /health

Returns backend availability and dataset statistics.

## 2. Bus Stop Search

GET /api/stops?query=Rohini&limit=10

Response:

{
  "query": "Rohini",
  "stops": [
    {
      "stop_id": "1",
      "stop_name": "Rohini Sec 22 Terminal",
      "latitude": 28.717971,
      "longitude": 77.063899
    }
  ]
}

Use stop_id as the selected value.

Debounce autocomplete requests by 300ms.

## 3. Journey Planner

POST /api/journey/plan

Content-Type: application/json

Request:

{
  "origin_stop_id": "1",
  "destination_stop_id": "26",
  "departure_time": "2026-11-26T08:00:00+05:30",
  "comfort_weight": 0.5,
  "limit": 5
}

Comfort weight:

- 0: Speed priority
- 0.5: Balanced
- 1: Comfort priority

Important response fields:

- status
- journeys
- recommendations
- unique_routes
- total_candidates
- metadata

Each journey contains:

- trip_id
- route_name
- route_key
- boarding_stop
- alighting_stop
- departure_time
- arrival_time
- waiting_minutes
- travel_minutes
- duration_minutes
- crowding_index
- crowding_level
- confidence
- prediction_available
- transfers
- ranking_score
- recommendations
- stops
- geometry

Recommendation labels:

- fastest
- least_crowded
- balanced

Multiple labels may belong to the same journey.

The recommendations object maps each recommendation
category to its corresponding trip_id.

Geometry is an array of [latitude, longitude] pairs
that can be rendered using Leaflet Polyline.

## 4. Crowdedness Profile

GET /api/crowding/717AUP/profile?day_type=weekday

Available day types:

- weekday
- weekend

Use the returned profile array to render hourly charts.

Each record contains:

- hour
- crowding_index
- crowding_level
- confidence
- avg_passengers
- scheduled_trips

## 5. Analytics

GET /api/analytics/summary

Returns dataset statistics, model evaluation metrics
and technical limitations.

## 6. Crowdedness Display Rules

The crowdedness index is a relative score from
0 to 100, NOT an occupancy percentage.

- Low: 0 to 35
- Moderate: Above 35 to 70
- High: Above 70
- Unknown: null

Never display unknown crowdedness as zero.

Always display prediction confidence separately.

## 7. Error Handling

Handle:

- Backend unavailable
- No journeys found
- Invalid stop selection
- Loading state
- Missing crowding predictions

## 8. Verified Demo Journey

Origin: Rohini Sec 22 Terminal
Origin ID: 1

Destination: Kohat Enclave Metro Station
Destination ID: 26

Departure: 26 November 2026, 08:00 IST

Routes: 102DOWN and 102ADOWN

## 9. Data Sources

- Official Delhi Bus GTFS
- October 2026 ONDC e-ticketing data

ETM dataset access remains pending.

All timings are scheduled, not live predictions.


## 10. Direct and Transfer Journey Support

The journey planner now supports both direct journeys
and journeys involving one bus transfer.

The existing POST /api/journey/plan endpoint is unchanged.

Additional journey response fields:

- journey_type: direct or transfer
- transfers: 0 or 1
- transfer_stop: interchange stop for transfer journeys
- transfer_wait_minutes
- legs: array of individual bus journey segments
- effective_crowding
- within_time_budget

Each leg includes its own route name, departure time,
arrival time, crowding index, confidence, stops and geometry.

Render each transfer leg using a different map colour.

The least_crowded recommendation may be null when no
sufficiently supported prediction is available.

## 11. Transfer Demo Journey

Origin: Rohini Sec 22 Terminal
Origin ID: 1

Destination: Kashmere Gate City Bus Terminal
Destination ID: 1025

Departure: 26 November 2026, 08:00 IST

## 12. Analytics Dashboard

GET /api/analytics/summary

Response sections:

- dataset
- model
- validation
- capabilities
- limitations

The validation object includes:

- model
- baseline
- mae_improvement_percent
- prediction_coverage_percent
- frequency_coverage_percent
- peak_analysis
- hourly_demand
- day_type_demand
- crowding_distribution
- confidence_distribution

Use the actual API response to generate charts.
Do not hardcode analytics statistics.

## 13. Backend Testing

From the backend directory with the virtual environment
activated, run:

python -m pytest tests -v --tb=short

Current verified development result: 30 passed.

Processed datasets must exist before running integration tests.


## 14. Smart Departure Advisor

POST /api/journey/departure-advice

Uses the same request structure as POST /api/journey/plan.

Example request:

```json
{
  "origin_stop_id": "1",
  "destination_stop_id": "26",
  "departure_time": "2026-11-26T08:00:00+05:30",
  "comfort_weight": 0.8,
  "limit": 5
}
```

Important response fields:

- status
- requested_departure
- comfort_weight
- total_candidates
- baseline
- windows
- alternatives
- recommendation
- message
- metadata

The recommendation may be null when no sufficiently supported
and meaningfully less crowded later journey is available.

Each recommended alternative includes:

- departure_time
- arrival_time
- requested_departure
- total_elapsed_minutes
- additional_time_minutes
- crowding_index
- crowding_reduction_points
- confidence

The advisor compares up to five departure windows using a
shared, bounded 120-minute journey candidate search.

Multiple windows may identify the same scheduled bus.
The alternatives list deduplicates scheduled journey IDs.

Additional elapsed time includes the delay relative to the
original requested departure.

## 15. Route Crowdedness Explorer

Search routes:

GET /api/routes?query=102DOWN&limit=20

Load weekday profile:

GET /api/crowding/102DOWN/profile?day_type=weekday

Load weekend profile:

GET /api/crowding/102DOWN/profile?day_type=weekend

Normalize missing hours to unknown values, not zero crowdedness.

Recommended travel hours should use only medium-confidence
or high-confidence historical predictions.
