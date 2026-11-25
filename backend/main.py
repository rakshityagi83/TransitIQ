
from datetime import datetime, date
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.data_store import DATA, get_connection
from services.stop_service import search_stops, get_stop
from services.crowding_service import (
    get_crowding,
    get_hourly_profile
)
from services.journey_service import plan_journey


app = FastAPI(
    title="TransitIQ API",
    description=(
        "Crowdedness-aware bus journey planner "
        "for Delhi public transportation."
    ),
    version="0.1.0"
)


# Allow local frontend development.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)


# Request models

class JourneyRequest(BaseModel):

    origin_stop_id: str = Field(min_length=1)
    destination_stop_id: str = Field(min_length=1)

    departure_time: datetime

    comfort_weight: float = Field(
        default=0.5,
        ge=0,
        le=1
    )

    limit: int = Field(
        default=5,
        ge=3,
        le=10
    )


# Application information

@app.get("/")
def root():

    return {
        "application": "TransitIQ",
        "version": "0.1.0",
        "status": "running",
        "description": (
            "Crowdedness-aware Delhi bus "
            "journey planner"
        ),
        "documentation": "/docs",
        "data_sources": [
            "Delhi Bus GTFS",
            "October 2026 ONDC e-ticketing"
        ]
    }


# Health check

@app.get("/health")
def health():

    con = None

    try:

        con = get_connection()

        stops = con.execute(
            "SELECT COUNT(*) FROM stops"
        ).fetchall()[0][0]

        profiles = con.execute(
            "SELECT COUNT(*) FROM crowding_profiles"
        ).fetchall()[0][0]

        return {
            "status": "healthy",
            "data_available": True,
            "bus_stops": stops,
            "crowding_profiles": profiles
        }

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Required datasets unavailable."
        )

    finally:

        if con is not None:
            con.close()


# Bus stop autocomplete

@app.get("/api/stops")
def stops(
    query: str = Query(
        min_length=1,
        max_length=100
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=50
    )
):

    return {
        "query": query,
        "stops": search_stops(query, limit)
    }


# Individual stop details

@app.get("/api/stops/{stop_id}")
def stop_details(stop_id: str):

    stop = get_stop(stop_id)

    if stop is None:

        raise HTTPException(
            status_code=404,
            detail="Bus stop not found."
        )

    return stop


# Search bus routes

@app.get("/api/routes")
def routes(
    query: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100)
):

    con = get_connection()

    try:

        rows = con.execute("""
            SELECT
                route_id,
                route_name,
                route_key,
                agency_id,
                description
            FROM routes
            WHERE contains(
                LOWER(route_name),
                LOWER(?)
            )
            ORDER BY route_name
            LIMIT ?
        """, [
            query.strip(),
            limit
        ]).fetchall()

        return {
            "routes": [
                {
                    "route_id": row[0],
                    "route_name": row[1],
                    "route_key": row[2],
                    "agency": row[3],
                    "description": row[4]
                }
                for row in rows
            ]
        }

    finally:
        con.close()


# Complete journey planner

@app.post("/api/journey/plan")
def journey(request: JourneyRequest):

    try:

        return plan_journey(
            origin_stop_id=request.origin_stop_id,
            destination_stop_id=request.destination_stop_id,
            departure_time=(
                request.departure_time.isoformat()
            ),
            comfort_weight=request.comfort_weight,
            limit=request.limit
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# Route crowdedness prediction

@app.get("/api/crowding/{route_key}")
def crowding(
    route_key: str,
    departure_time: str,
    service_date: date
):

    try:

        return get_crowding(
            route_key.upper(),
            departure_time,
            service_date
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# Hourly crowdedness profiles

@app.get("/api/crowding/{route_key}/profile")
def crowding_profile(
    route_key: str,
    day_type: str = "weekday"
):

    try:

        return {
            "route_key": route_key.upper(),
            "day_type": day_type,
            "profile": get_hourly_profile(
                route_key.upper(),
                day_type
            )
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# Dataset and model statistics

@app.get("/api/analytics/summary")
def analytics():

    try:

        with open(
            DATA / "metadata.json",
            encoding="utf-8"
        ) as file:

            dataset = json.load(file)

        with open(
            DATA / "model_metrics.json",
            encoding="utf-8"
        ) as file:

            model = json.load(file)

        return {
            "dataset": dataset,
            "model": model,
            "limitations": [
                "E-ticketing represents partial passenger demand.",
                "ETM data has not yet been integrated.",
                "Crowding scores are relative indices.",
                "Journey timings use static GTFS schedules.",
                "Current routing supports direct bus journeys."
            ]
        }

    except (OSError, json.JSONDecodeError):

        raise HTTPException(
            status_code=503,
            detail="Analytics metadata unavailable."
        )
