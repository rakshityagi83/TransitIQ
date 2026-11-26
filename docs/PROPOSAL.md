# TransitIQ
## Crowdedness-Aware Intelligent Urban Mobility

**Team SAG | IIIT Allahabad**

**Transport Stack Hackathon 2026 — Problem Statement 2**

### Problem

Conventional public transport journey planners focus primarily on travel time and connectivity. However, commuters also care about comfort, crowdedness and the quality of their travel experience.

Without crowdedness information, passengers cannot effectively compare a faster but potentially crowded journey against a more comfortable alternative.

### Proposed Solution

TransitIQ is an intelligent journey planner that integrates historical crowdedness predictions with scheduled public bus routing.

Using real-world ONDC e-ticketing and Delhi GTFS datasets, TransitIQ estimates passenger demand across bus routes and times of day, normalizes demand by scheduled transport supply and generates confidence-aware crowdedness indices.

Commuters can customize their preference between speed and comfort and receive journey recommendations that reflect their individual priorities.

### Innovation

TransitIQ introduces three complementary decision-support capabilities:

**Crowdedness-aware journey planning:** Compare direct and one-transfer journeys based on travel time, expected crowdedness and historical prediction confidence.

**Smart Departure Advisor:** Identify whether leaving later could provide a more comfortable journey while accounting for additional elapsed time.

**Route Crowdedness Explorer:** Explore historical hourly patterns, weekday and weekend differences, scheduled bus frequency and supported off-peak travel opportunities.

Unlike a static crowdedness dashboard, TransitIQ connects predictions directly to actionable journey decisions.

### Technical Approach

The prototype uses:

- Approximately 2.56 million real-world ticketing records.
- Historical route-hour-day-type demand profiles.
- Scheduled GTFS frequency adjustment.
- Comparative benchmarking of four prediction approaches.
- Confidence-aware multi-objective journey ranking.
- Efficient DuckDB queries over Parquet datasets.
- FastAPI and an interactive React frontend.
- Containerized local deployment using Docker.

### Prototype Results

The current working prototype supports 1,984 route keys and 48,472 historical prediction profiles.

The selected historical demand model achieved a 56.7% MAE reduction against a constant route-average baseline on common observed validation profiles.

In a demonstrated Rohini-to-Kohat Enclave journey, the Smart Departure Advisor identified a later bus with a 47.2% lower relative crowdedness index, in exchange for 24.4 additional minutes of elapsed time.

All 30 automated backend tests passed on both Windows and Linux Docker environments.

### Expected Impact

TransitIQ can help commuters:

- Make better-informed public transport choices.
- Understand comfort versus travel-time trade-offs.
- Identify historically less crowded travel hours.
- Plan journeys according to personal comfort preferences.
- Recognize when historical information is insufficient.

Aggregated insights could also assist transport planners in understanding demand patterns and identifying opportunities for improved service allocation, subject to further validation.

### Current Limitations

ETM data was unavailable during prototype development. The current model therefore uses partial recorded e-ticketing demand and static GTFS schedules.

Predicted crowdedness is a relative index, not measured onboard occupancy. Confidence labels communicate historical data support rather than guaranteed prediction accuracy.

### Phase 2 Roadmap

Future development will prioritize ETM integration and vehicle-level occupancy validation, improved stop-level demand modelling, real-time service information, expanded routing and calibrated uncertainty estimation.

### Vision

TransitIQ aims to make public transportation journey planning more human-centric by treating commuter comfort as an important optimization objective alongside travel time.

**Travel Smarter. Ride Comfortably.**