
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
