"""
main.py
FastAPI Application Entrypoint for GREEN-WAVE.
Initializes routes, CORS middleware, lifespan events, and configuration validation.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import api_router
from .core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("greenwave")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting GREEN-WAVE Intelligent Traffic Management API (%s)", settings.APP_ENV)
    logger.info("Decision interval: %ss | Default QAOA shots: %s", 
                settings.DECISION_INTERVAL_SECONDS, settings.DEFAULT_QAOA_SHOTS)
    yield
    logger.info("Shutting down GREEN-WAVE API.")


app = FastAPI(
    title="GREEN-WAVE Traffic Management API",
    description="Predictive, Emergency-Aware, Pedestrian-Safe Traffic Optimization using QUBO & QAOA",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS setup for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)

