# =============================================================
# Stage 1: Build the React + Three.js Frontend
# =============================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =============================================================
# Stage 2: Production Python Runtime (FastAPI + Qiskit)
# =============================================================
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source, simulation assets, and entrypoint
COPY backend/ ./backend/
COPY simulation/ ./simulation/
COPY run.py .

# Copy compiled frontend assets from Stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application server
CMD ["python", "run.py"]
