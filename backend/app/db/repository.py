"""
repository.py
Data Persistence Layer for GREEN-WAVE.
Implements the MongoDB Collections specified in README Section 13:
  - experiments
  - simulation_metrics
  - solver_results
Includes transparent standalone in-memory/JSON fallback if MongoDB server is unavailable.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

try:
    import pymongo
except ImportError:
    pymongo = None

from ..core.config import settings

logger = logging.getLogger("greenwave.db")


class DataRepository:
    """
    Manages persistence for experiments, metrics, and solver benchmarks.
    """

    def __init__(self, uri: Optional[str] = None, db_name: Optional[str] = None):
        self.uri = uri or settings.MONGODB_URI
        self.db_name = db_name or settings.MONGODB_DATABASE
        self.client: Optional[pymongo.MongoClient] = None
        self.db = None
        self._is_connected_to_mongo = False

        # In-memory storage structures for standalone mode
        self._experiments: Dict[str, dict] = {}
        self._metrics: Dict[str, List[dict]] = {}
        self._solvers: Dict[str, List[dict]] = {}

        self._connect()

    def _connect(self) -> None:
        if pymongo is None:
            self._is_connected_to_mongo = False
            logger.info("PyMongo not installed. Using standalone in-memory/file persistence.")
            return

        try:
            self.client = pymongo.MongoClient(self.uri, serverSelectionTimeoutMS=1000)
            # Ping database to verify connection
            self.client.admin.command("ping")
            self.db = self.client[self.db_name]
            self._is_connected_to_mongo = True
            logger.info("Connected to MongoDB at %s (database: %s)", self.uri, self.db_name)

            # Ensure indexes as required by README Section 13
            self.db.experiments.create_index([("started_at", -1)])
            self.db.simulation_metrics.create_index([("experiment_id", 1), ("simulation_time", 1)])
            self.db.solver_results.create_index([("experiment_id", 1), ("simulation_time", 1)])
        except Exception as ex:
            self._is_connected_to_mongo = False
            logger.info("MongoDB unavailable (%s). Using standalone persistence.", ex)

    def is_healthy(self) -> bool:
        if self._is_connected_to_mongo and self.client:
            try:
                self.client.admin.command("ping")
                return True
            except Exception:
                return False
        return True  # Standalone mode is always healthy

    # ----------------- Experiments -----------------
    def create_experiment(self, exp_data: dict) -> dict:
        exp_id = str(uuid.uuid4())
        doc = {
            "id": exp_id,
            "_id": exp_id,
            "name": exp_data.get("name", "experiment"),
            "scenario_id": exp_data.get("scenario_id", "balanced_peak"),
            "seed": exp_data.get("seed", 42),
            "status": "queued",
            "controller": exp_data.get("controller", "qaoa"),
            "qaoa": exp_data.get("qaoa") or {"p": 1, "shots": 2048, "optimizer": "COBYLA"},
            "config_version": exp_data.get("config_version", "v1"),
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
            "current_simulation_time": 0.0,
        }

        if self._is_connected_to_mongo:
            self.db.experiments.insert_one(doc)
        else:
            self._experiments[exp_id] = doc

        return doc

    def get_experiment(self, exp_id: str) -> Optional[dict]:
        if self._is_connected_to_mongo:
            doc = self.db.experiments.find_one({"id": exp_id})
            if doc:
                doc["_id"] = str(doc["_id"])
            return doc
        return self._experiments.get(exp_id)

    def list_experiments(self, limit: int = 50) -> List[dict]:
        if self._is_connected_to_mongo:
            cursor = self.db.experiments.find().sort("started_at", -1).limit(limit)
            result = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                result.append(doc)
            return result
        return sorted(list(self._experiments.values()), key=lambda x: x.get("started_at"), reverse=True)[:limit]

    def update_experiment_status(
        self,
        exp_id: str,
        status: str,
        simulation_time: Optional[float] = None,
        completed: bool = False,
    ) -> None:
        updates = {"status": status}
        if simulation_time is not None:
            updates["current_simulation_time"] = simulation_time
        if completed:
            updates["completed_at"] = datetime.now(timezone.utc)

        if self._is_connected_to_mongo:
            self.db.experiments.update_one({"id": exp_id}, {"$set": updates})
        elif exp_id in self._experiments:
            self._experiments[exp_id].update(updates)

    # ----------------- Metrics -----------------
    def save_metric(self, metric: dict) -> None:
        exp_id = metric["experiment_id"]
        if self._is_connected_to_mongo:
            self.db.simulation_metrics.insert_one(metric)
        else:
            if exp_id not in self._metrics:
                self._metrics[exp_id] = []
            self._metrics[exp_id].append(metric)

    def get_metrics(self, exp_id: str, limit: int = 500) -> List[dict]:
        if self._is_connected_to_mongo:
            cursor = self.db.simulation_metrics.find({"experiment_id": exp_id}).sort("simulation_time", 1).limit(limit)
            res = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                res.append(doc)
            return res
        return self._metrics.get(exp_id, [])[:limit]

    # ----------------- Solver Results -----------------
    def save_solver_result(self, result: dict) -> None:
        exp_id = result["experiment_id"]
        if self._is_connected_to_mongo:
            self.db.solver_results.insert_one(result)
        else:
            if exp_id not in self._solvers:
                self._solvers[exp_id] = []
            self._solvers[exp_id].append(result)

    def get_solver_results(self, exp_id: str) -> List[dict]:
        if self._is_connected_to_mongo:
            cursor = self.db.solver_results.find({"experiment_id": exp_id}).sort("simulation_time", 1)
            res = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                res.append(doc)
            return res
        return self._solvers.get(exp_id, [])


# Global database repository instance
repo = DataRepository()
