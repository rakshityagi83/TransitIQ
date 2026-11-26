from pathlib import Path

from fastapi.staticfiles import StaticFiles
from fastapi.routing import APIRoute

from main import app


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "dist"


if not (FRONTEND / "index.html").is_file():
    raise RuntimeError(
        "Frontend production build is missing."
    )


# Remove the original API homepage in production.
# All other API endpoints remain available.

app.router.routes[:] = [
    route
    for route in app.router.routes
    if not (
        isinstance(route, APIRoute)
        and route.path == "/"
        and "GET" in route.methods
    )
]


# Serve the compiled React application.

app.mount(
    "/",
    StaticFiles(
        directory=str(FRONTEND),
        html=True
    ),
    name="frontend"
)