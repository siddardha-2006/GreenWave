#!/usr/bin/env python3
"""
run_green_wave.py
Convenience launcher to run the GREEN-WAVE FastAPI backend server.
"""

import os
import sys
import uvicorn

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    from app.core.config import settings
    print("=" * 70)
    print("  GREEN-WAVE Intelligent Traffic Management Platform")
    print(f"  Starting FastAPI server on http://{settings.API_HOST}:{settings.API_PORT}")
    print(f"  Interactive API Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")
    print("=" * 70)
    uvicorn.run("app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True, reload_dirs=[backend_dir])

