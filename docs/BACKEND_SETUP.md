
# TransitIQ — Backend Setup Guide

## 1. Prerequisites

- Python 3.14 (tested version)
- Git
- Internet connection for dataset downloads

## 2. Clone the Repository

git clone https://github.com/rakshityagi83/TransitIQ.git

cd TransitIQ

## 3. Create the Python Environment

Windows PowerShell:

cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

## 4. Download Official Datasets

Transport Stack Portal:

https://delhi.transportstack.in/

Required datasets:

1. Delhi Buses Static GTFS
   - delhi_buses_static_gtfs_v1.zip

2. October 2026 Delhi ONDC E-ticketing Data
   - October-Delhi.csv.zip

Ticketing dataset download:

https://pub-091bd9e794bb4877b10b29e6df80f065.r2.dev/2026-10/October-Delhi.csv.zip

## 5. Dataset Directory Structure

Extract the datasets into the following directories:

data/
    raw/
        gtfs/
            agency.txt
            calendar.txt
            feed_info.txt
            routes.txt
            shapes.txt
            stops.txt
            stop_times.txt
            trips.txt
        ticketing/
            October-Delhi.csv
    processed/

Raw and processed datasets are excluded from Git
to avoid unnecessary repository size and redistribution
of source datasets.

macOS metadata files can be ignored.

## 6. Build Processed Datasets

From the backend directory with the virtual
environment activated:

python scripts/preprocess.py
python scripts/train_crowding.py
python scripts/validate_model.py

Optional exploratory data analysis:

python scripts/analyze_data.py

The processing pipeline generates Parquet datasets,
model profiles and JSON analytics reports.

## 7. Run Automated Tests

python -m pytest tests -v --tb=short

Verified development result:

18 passed, 1 dependency deprecation warning.

## 8. Start the Backend

python -m uvicorn main:app --host 127.0.0.1 --port 8000

## 9. Verify the Backend

Health endpoint:

http://127.0.0.1:8000/health

Interactive API documentation:

http://127.0.0.1:8000/docs

Analytics:

http://127.0.0.1:8000/api/analytics/summary

## 10. Architecture

Raw GTFS and ONDC ticketing data
    -> Data preprocessing
    -> Parquet storage
    -> Historical demand-frequency model
    -> DuckDB query engine
    -> Direct and transfer journey routing
    -> Confidence-aware recommendation engine
    -> FastAPI REST API
    -> React frontend

## 11. External Dependencies

The backend does not require:

- PostgreSQL
- Paid APIs
- LLM API keys
- External database servers

## 12. Known Limitations

- ETM data access remains unresolved.
- ONDC ticketing captures partial passenger demand.
- Crowdedness is a relative index, not measured occupancy.
- Bus frequency and timings use static GTFS schedules.
- Transfers are limited to one shared-stop interchange.
- Map geometry connects scheduled bus stop coordinates.
- Confidence labels represent historical data support.
- Candidate searches are bounded for performance.
