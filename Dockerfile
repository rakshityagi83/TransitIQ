
# Stage 1: Build React frontend

FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build


# Stage 2: Python production environment

FROM python:3.14-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

RUN python -m pip install \
    -r /app/backend/requirements.txt

COPY backend/ /app/backend/

COPY data/processed/ /app/data/processed/

COPY --from=frontend-build \
    /app/frontend/dist \
    /app/frontend/dist

WORKDIR /app/backend

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8080') + '/health', timeout=8)"

CMD ["sh", "-c", "exec python -m uvicorn production:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
