"""
config.py
Application Configuration using Pydantic Settings for GREEN-WAVE.
Implements environment variables specification from README Section 17.
"""

import os
from pydantic import BaseModel


class Settings(BaseModel):
    APP_ENV: str = os.getenv("APP_ENV", "development")
    API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "green_wave")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    SUMO_BINARY: str = os.getenv("SUMO_BINARY", "sumo")
    SUMO_GUI_BINARY: str = os.getenv("SUMO_GUI_BINARY", "sumo-gui")
    SIMULATION_STEP_LENGTH: float = float(os.getenv("SIMULATION_STEP_LENGTH", "1.0"))
    DEFAULT_QAOA_SHOTS: int = int(os.getenv("DEFAULT_QAOA_SHOTS", "2048"))
    DEFAULT_QAOA_P: int = int(os.getenv("DEFAULT_QAOA_P", "1"))
    DECISION_INTERVAL_SECONDS: float = float(os.getenv("DECISION_INTERVAL_SECONDS", "10.0"))


settings = Settings()
