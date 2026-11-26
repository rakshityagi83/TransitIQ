# TransitIQ — Demonstration Video Script

Target duration: Approximately 3 minutes.

## 00:00–00:20 | Introduction

**Screen:** TransitIQ homepage.

**Narration:**

"Traditional journey planners tell us which bus gets us to our destination fastest. But what if a slightly longer journey could be significantly more comfortable?

Introducing TransitIQ, a crowdedness-aware intelligent journey planner for Delhi's public bus network, developed by Team SAG from IIIT Allahabad."

## 00:20–00:40 | Data and technology

**Screen:** Network Analytics dashboard.

**Narration:**

"TransitIQ processes over 2.5 million real-world e-ticketing records alongside official Delhi GTFS schedules. Our system generates more than 48,000 historical prediction profiles across nearly 2,000 route keys.

We estimate relative crowdedness by combining historical passenger demand with scheduled bus frequency."

## 00:40–01:10 | Journey planner

**Screen:** Journey Planner. Select Direct Comparison, adjust the comfort slider and show the journey cards and interactive map.

**Narration:**

"Commuters can search their origin and destination, select a departure time and choose their preference between speed and comfort.

TransitIQ compares available scheduled journeys using travel time, predicted crowdedness and historical confidence. The interactive map displays the corresponding bus stops and journey path.

Our system supports both direct and one-transfer bus journeys."

## 01:10–01:50 | Smart Departure Advisor

**Screen:** Use the Rohini-to-Kohat Enclave direct comparison with comfort preference 0.8. Click Find Journeys, followed by Find a Better Departure.

**Narration:**

"TransitIQ goes beyond recommending which bus to take. Our Smart Departure Advisor also helps commuters decide when to travel.

For this journey, the original recommendation has a crowdedness index of 39.4. The advisor identifies a later departure with an index of 20.8.

That's an 18.6-point improvement, or a 47.2 percent relative reduction in the predicted index, in exchange for approximately 24 additional minutes.

The commuter can now make an informed decision based on this explicit trade-off."

## 01:50–02:15 | Route Crowdedness Explorer

**Screen:** Crowdedness Explorer. Select route 102DOWN, show hourly charts and switch between weekday and weekend.

**Narration:**

"Our Route Crowdedness Explorer allows users to investigate historical patterns across individual bus routes.

They can compare weekday and weekend crowdedness, recorded passenger demand, scheduled departure frequency and historical confidence.

Where sufficient data is unavailable, TransitIQ explicitly communicates uncertainty rather than assuming buses are empty."

## 02:15–02:40 | Validation and engineering

**Screen:** Network Analytics, followed briefly by the GitHub benchmark documentation or test results.

**Narration:**

"We evaluated four demand prediction approaches, including hierarchical smoothing and gradient boosting, using chronological model validation.

Our selected historical averaging model achieved a 56.7 percent reduction in mean absolute error against the constant baseline.

TransitIQ is fully containerized for local deployment, with all 30 automated backend tests passing on Windows and Linux."

## 02:40–03:00 | Limitations and closing

**Screen:** Methodology page, then return to TransitIQ homepage.

**Narration:**

"Our current prototype uses ONDC ticketing and static GTFS schedules because ETM data was unavailable during development. The crowdedness score is a relative prediction index, not measured occupancy.

Future ETM integration will enable further calibration and vehicle-level validation.

With TransitIQ, commuters can make more informed decisions about both how and when to travel.

TransitIQ — Travel Smarter. Ride Comfortably."

## Recording checklist

- Record the actual working application.
- Use the final Docker application at http://127.0.0.1:8082/.
- Close unrelated browser tabs and notifications.
- Preload the map and demo journeys.
- Use comfort preference 0.8 for the advisor demonstration.
- Verify that all narration matches the displayed results.
- Avoid claiming actual occupancy reduction or live tracking.
- Export as MP4 within the submission portal's 100 MB limit.