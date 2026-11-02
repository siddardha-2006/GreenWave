# GREEN-WAVE

## Predictive, Emergency-Aware and Pedestrian-Safe Intelligent Traffic Management using QUBO and QAOA

> **Project status:** Research prototype / simulation-based
> decision-support system. It is not a certified real-world
> traffic-signal controller.
>
> **Core principle:** Quantum optimization proposes candidate
> vehicle-movement sets. A separate deterministic safety controller
> validates and schedules every signal transition. QAOA must never
> directly bypass pedestrian clearance, yellow/all-red intervals,
> conflict rules, or emergency-safe transitions.

------------------------------------------------------------------------

## 1. Project overview

GREEN-WAVE is a simulated intelligent traffic-management platform for a
four-way intersection. It combines:

-   **SUMO** for realistic, reproducible traffic simulation.
-   **TraCI** for reading traffic state and applying signal commands in
    the simulator.
-   **Predictive traffic modelling** for estimating near-future queue
    lengths and arrivals.
-   **QUBO / Maximum-Weight Independent Set (MWIS)** for selecting
    compatible vehicle movements.
-   **QAOA** as an experimental quantum-inspired/hybrid optimization
    approach.
-   **Classical baselines** (greedy MWIS, exact MWIS, simulated
    annealing) for fair evaluation.
-   **A deterministic safety and phase controller** for pedestrian
    crossing, clearance, emergency preemption, minimum/maximum green,
    and fallback behaviour.
-   **FastAPI + MongoDB** for APIs, experiment history, configuration,
    and metrics.
-   **React + TypeScript** for the operator dashboard and simulation
    visualizations.

The project must demonstrate whether QAOA is competitive on the selected
instances. It must **not** claim quantum advantage merely because a
quantum circuit was executed. For the initial 12-movement problem, an
exact classical solver can enumerate only (2\^{12}=4096) bitstrings and
is expected to be a strong reference baseline.

### Primary objectives

1.  Reduce average vehicle waiting time and queue length in the SUMO
    simulation.
2.  Maintain throughput without selecting conflicting movements.
3.  Respect pedestrian crossing requests and clearance.
4.  Give emergency vehicles priority at the earliest **safe**
    transition.
5.  Compare QAOA with greedy, exact, and simulated-annealing solvers on
    identical inputs.
6.  Make results reproducible and auditable.

### Non-goals

-   Controlling real roadside traffic lights.
-   Claiming regulatory or safety certification.
-   Claiming a practical quantum speedup.
-   Using camera-based AI as a mandatory dependency for the first
    working prototype.
-   Treating a QAOA bitstring as a safe signal command without
    independent validation.

------------------------------------------------------------------------

## 2. Recommended implementation scope

Build in stages. Do not begin with a multi-junction network, YOLO, V2X,
or a large neural network.

### MVP (must work first)

-   One four-way SUMO junction.
-   Twelve vehicle movements.
-   A verified movement-conflict matrix.
-   Queue and waiting-time collection through TraCI.
-   MWIS QUBO construction.
-   Greedy, exact enumeration, simulated annealing, and QAOA solvers.
-   Independent feasibility validator.
-   Basic phase scheduler and safe fallback.
-   MongoDB experiment storage.
-   Dashboard showing queues, active phase, solver result, and metrics.

### Phase 2

-   Pedestrian requests and crossing occupancy in SUMO.
-   Minimum WALK and pedestrian clearance intervals, configured from the
    applicable local design requirements.
-   Emergency-vehicle detection from SUMO vehicle type/route and safe
    preemption.
-   Predictive queue model, initially a simple baseline before LSTM/GRU.
-   Experiment comparison charts and export.

### Phase 3 (optional)

-   Multiple coordinated intersections and green corridors.
-   Camera-based vehicle/pedestrian detection (e.g. YOLO) as an
    alternative sensor input.
-   V2X message simulation.
-   Weather/incident scenarios.
-   Explainability and fairness analysis.
-   Hardware QAOA runs, if access is available.

------------------------------------------------------------------------

## 3. System architecture

``` text
                         ┌──────────────────────────┐
                         │       React UI           │
                         │ Live view / experiments  │
                         └────────────┬─────────────┘
                                      │ HTTP / WebSocket
                         ┌────────────▼─────────────┐
                         │       FastAPI API        │
                         │ Auth/config/run/metrics  │
                         └───────┬─────────┬────────┘
                                 │         │
                           ┌─────▼───┐ ┌───▼──────────┐
                           │ MongoDB │ │ Run manager  │
                           │ results │ │ background   │
                           └─────────┘ │ orchestration│
                                       └──────┬───────┘
                                              │
                    ┌─────────────────────────▼──────────────────────┐
                    │               Simulation service               │
                    │ SUMO + TraCI + scenario + traffic state         │
                    └─────────────────────────┬──────────────────────┘
                                              │
                    ┌─────────────────────────▼──────────────────────┐
                    │                 Decision pipeline               │
                    │                                                 │
                    │ Queue predictor → priority/weight calculation   │
                    │                 → MWIS/QUBO builder              │
                    │                 → QAOA / classical solver        │
                    │                 → independent validator         │
                    │                 → safe phase scheduler           │
                    └─────────────────────────┬──────────────────────┘
                                              │
                                      SUMO traffic lights
```

### Strict separation of responsibilities

-   **Optimizer:** selects a compatible set of vehicle movements.
-   **Safety validator:** rejects any set that violates the verified
    conflict graph or current safety state.
-   **Phase scheduler:** controls green, yellow, all-red, pedestrian
    WALK/clearance, and transitions.
-   **Emergency manager:** requests priority and selects a safe
    preemption transition; it does not bypass clearance.
-   **SUMO adapter:** is the only component that writes simulator signal
    states.
-   **API/UI:** observes and configures runs; it must not directly issue
    raw signal states.

------------------------------------------------------------------------

## 4. Traffic movement model

Use twelve directed vehicle movements for the initial junction. The
exact mapping depends on the SUMO network and lane connections.

Create a single authoritative movement registry, for example:

  ID    Movement   Description
  ----- ---------- ------------------------------
  M0    N-S        North approach to south exit
  M1    N-E        North approach to east exit
  M2    N-W        North approach to west exit
  M3    S-N        South approach to north exit
  M4    S-E        South approach to east exit
  M5    S-W        South approach to west exit
  M6    E-W        East approach to west exit
  M7    E-N        East approach to north exit
  M8    E-S        East approach to south exit
  M9    W-E        West approach to east exit
  M10   W-N        West approach to north exit
  M11   W-S        West approach to south exit

This table is an illustrative naming convention, not a substitute for
the actual SUMO lane-to-lane connection map. Verify every movement
against the network geometry and signal logic.

### Conflict graph

Represent the junction as an undirected graph (G=(V,E)):

-   Each vertex is one vehicle movement.
-   An edge ((i,j)) exists when movements (i) and (j) cannot safely
    receive green simultaneously.
-   No edge means simultaneous service is allowed by the verified
    junction geometry and signal rules.

**Do not invent the conflict matrix from intuition.** Derive and review
it using lane connections, crossing paths, SUMO signal logic, and an
explicit engineering review. Include pedestrian-vehicle conflicts in the
safety/phase model even if pedestrian requests are initially kept
outside the vehicle-only QUBO.

Store the movement registry and conflict edges in version-controlled
configuration. Add tests for symmetry, no self-edges, valid movement
IDs, and known safe/unsafe pairs.

------------------------------------------------------------------------

## 5. QUBO formulation

### Binary decision variables

For each movement (i):

\[ x_i `\in `{=tex}{0,1} \]

-   (x_i=1): movement (i) is selected as a candidate for service.
-   (x_i=0): movement (i) is not selected.

### Movement priority weights

A simple initial weight is:

\[ w_i = `\alpha `{=tex}Q_i + `\beta `{=tex}`\widehat{Q}`{=tex}\_i +
`\gamma `{=tex}W_i \]

where:

-   (Q_i): current queue measure.
-   (`\widehat{Q}`{=tex}\_i): predicted near-future queue/arrivals.
-   (W_i): normalized waiting-time or starvation-priority measure.
-   (`\alpha`{=tex},`\beta`{=tex},`\gamma`{=tex}): configurable
    non-negative coefficients.

Normalize input features to comparable ranges before combining them.
Document the normalization and coefficient values in each experiment.
Avoid allowing one feature's units to dominate accidentally.

Emergency urgency and pedestrian requests must be handled by the
safety/priority manager. Do not model emergency preemption as merely an
arbitrarily huge QUBO weight.

### MWIS QUBO

Minimize:

\[ E(x)=-`\sum`{=tex}*i w_i x_i +
P`\sum`{=tex}*{(i,j)`\in `{=tex}E}x_ix_j \]

The first term rewards serving high-priority movements. The second
penalizes selecting conflicting movements together.

For non-negative weights, a simple sufficient penalty is:

\[ P \> `\sum`{=tex}\_i w_i \]

This is conservative. A smaller penalty may be possible, but it must be
validated so that no infeasible solution can beat a feasible one. Record
the selected penalty in every run.

### QUBO-to-Ising conversion

Using (x_i=(1-Z_i)/2), ignoring the global constant (which does not
affect the optimizer):

\[ H_C=`\sum`{=tex}*i h_i
Z_i+`\sum`{=tex}*{(i,j)`\in `{=tex}E}J\_{ij}Z_iZ_j \]

with:

\[ h_i=`\frac{w_i}{2}`{=tex}-`\frac{P\,d_i}{4}`{=tex}, `\qquad`{=tex}
J\_{ij}=`\frac{P}{4}`{=tex} \]

where (d_i) is the degree of movement (i) in the conflict graph.

The cost unitary is:

\[ U_C(`\gamma`{=tex})=e\^{-i`\gamma `{=tex}H_C} \]

The standard mixer is:

\[ H_M=`\sum`{=tex}\_i X_i,`\qquad`{=tex}
U_M(`\beta`{=tex})=e\^{-i`\beta `{=tex}H_M} \]

For each QAOA layer:

-   Apply (R_Z(2`\gamma `{=tex}h_i)) to qubit (i).
-   For each conflict edge ((i,j)), implement
    (e\^{-i`\gamma `{=tex}J\_{ij}Z_iZ_j}) using
    `CX(i,j) → RZ(2*gamma*J_ij, j) → CX(i,j)`.
-   Apply `RX(2*beta)` to every qubit.

The initial state uses one Hadamard gate per qubit. Measure all qubits
after the final layer.

**Important:** The global constant omitted from (H_C) changes only the
overall phase, not measurement probabilities. The sign and angle
conventions above must be kept consistent in both circuit construction
and the classical energy evaluator. Unit-test the circuit expectation
against the direct QUBO evaluator on small instances.

### Standard QAOA limitation

The standard X mixer does not preserve MWIS feasibility. It can produce
bitstrings containing conflicts. Therefore:

1.  Decode each measured bitstring.
2.  Check it against the conflict graph and current safety state.
3.  Discard infeasible candidates.
4.  Select the best feasible candidate under the original reward.
5.  If no acceptable candidate is available, use a safe classical
    fallback.

A constrained mixer is a possible research extension, not an MVP
requirement.

------------------------------------------------------------------------

## 6. QAOA configuration

Start with:

-   12 qubits for the 12 movement variables.
-   Standard QAOA.
-   Depth (p=1), then (p=2), then (p=3).
-   COBYLA as the initial classical parameter optimizer.
-   SPSA as an optional alternative, especially for noisy evaluations.
-   A fixed, documented shot count for reproducible comparisons.
-   Multiple random seeds/initial parameter sets for each experiment.

QAOA is hybrid: a quantum circuit estimates the objective, while a
classical optimizer updates (`\gamma`{=tex}) and (`\beta`{=tex}).

### Qiskit implementation notes

Use Qiskit and Qiskit Aer for local circuit simulation. Aer simulates
quantum circuits on classical hardware; it is not a physical quantum
computer.

Implement the QUBO-to-Ising mapping directly or use a currently
maintained optimization integration after checking its maintenance
status and compatibility. Do not make the archived `qiskit-optimization`
package a critical dependency without verifying its status. Keep the
mathematical model independent of the SDK so the circuit backend can be
replaced.

Recommended implementation modules:

``` text
backend/app/optimization/
├── movement_model.py
├── conflict_graph.py
├── qubo.py
├── ising.py
├── qaoa_circuit.py
├── qaoa_solver.py
├── greedy_solver.py
├── exact_solver.py
├── annealing_solver.py
├── feasibility.py
└── benchmark.py
```

### Circuit unit tests

For 2--5 qubits, test:

-   QUBO energy and Ising energy differ only by the expected constant.
-   The implemented cost unitary matches the intended Hamiltonian
    convention.
-   A sampled bitstring is decoded consistently with Qiskit's bit
    ordering.
-   Feasibility checks reject every known conflicting pair.
-   QAOA's best feasible result is no worse than the fallback result
    only when the comparison is explicitly based on the same objective;
    never assume this without checking.
-   The optimizer handles no-edge graphs, zero weights, and tied
    weights.

------------------------------------------------------------------------

## 7. Classical benchmark algorithms

All solvers must receive the **same movement weights, conflict graph,
and scenario snapshot**.

### A. Greedy MWIS

1.  Sort movements by descending weight.
2.  Select the highest-weight remaining movement.
3.  Remove its conflicting neighbours.
4.  Repeat until no candidates remain.

Use deterministic tie-breaking (e.g. movement ID) and document it.

### B. Exact MWIS

For 12 variables, enumerate all (2\^{12}=4096) bitstrings, reject
infeasible sets, and retain the highest-reward feasible set. This gives
the exact optimum for the defined MWIS instance.

For larger instances, consider branch-and-bound or an
integer-programming/CP-SAT solver.

### C. Simulated annealing

Use a documented simulated-annealing implementation over the same QUBO
energy. Record schedule, initial temperature, cooling rate, sweeps,
seed, and runtime. Validate the final bitstring; use the same fallback
policy if it is infeasible.

### D. QAOA

Run the parameterized QAOA circuit, sample bitstrings, decode, validate,
and select the best feasible candidate.

### Fair comparison

Report:

-   Original MWIS reward (not only negative QUBO energy).
-   Feasibility rate.
-   Runtime, including relevant optimization overhead.
-   Number of objective evaluations and circuit shots.
-   Approximation ratio against exact MWIS.
-   End-to-end traffic metrics from SUMO.

For a positive exact optimum:

\[ `\text{Approximation ratio}`{=tex}=
`\frac{\text{candidate feasible reward}}{\text{exact reward}}`{=tex} \]

Do not compare a QAOA circuit-only runtime against a classical
end-to-end solver runtime. State clearly whether compilation, parameter
optimization, sampling, and data transfer are included.

------------------------------------------------------------------------

## 8. Safety controller and signal phases

This is the most important system boundary.

### The optimizer does not control signal lamps directly

The optimizer returns a candidate movement set. The independent
validator and phase scheduler decide whether and when it can be applied.

### Required safety checks

-   No pair of conflicting vehicle movements may receive green together.
-   No vehicle movement may conflict with an active pedestrian crossing.
-   Do not terminate a pedestrian WALK/clearance interval early because
    an emergency vehicle arrives.
-   Respect configured minimum green, maximum green, yellow, and all-red
    intervals.
-   Only transition at a valid state-machine boundary.
-   Reject malformed, stale, empty, or infeasible solver output.
-   If QAOA times out, crashes, or returns no feasible candidate, use a
    safe, deterministic classical fallback.
-   Log every rejected candidate and fallback reason.

### Suggested phase state machine

``` text
IDLE / ALL_RED
      |
      v
GREEN (compatible vehicle set)
      |
      v
YELLOW (current vehicle phase)
      |
      v
ALL_RED (clearance)
      |
      +------> next valid GREEN phase

Pedestrian request:
  queue request → wait for safe service window
  → WALK → pedestrian clearance → release crossing

Emergency request:
  detect and identify route
  → request priority
  → finish any non-interruptible pedestrian/clearance interval
  → safe yellow/all-red transition
  → serve emergency-compatible movement
  → recovery phase plan
```

This is a simulation design, not a claim of compliance with any specific
national traffic-control standard. Use applicable local standards and
qualified traffic-engineering review before any real-world deployment.

### Pedestrian handling

For the MVP, model pedestrian calls and occupancy in SUMO and let the
safety controller schedule crossings. Define WALK and clearance
durations as explicit scenario parameters based on the applicable
standard and crossing geometry. Never infer that a crossing is clear
merely because a timer expired if the simulator provides occupancy
information.

### Emergency handling

Represent emergency vehicles explicitly in SUMO (vehicle type, route,
and priority metadata). Detect their approach and estimate the relevant
movement. Request preemption, but only execute it after a safe
transition. After passage, use a recovery policy to avoid starving other
approaches.

------------------------------------------------------------------------

## 9. Predictive traffic model

Do not start with a complex neural network. Establish a reliable
baseline first.

### Baseline predictor

-   Use recent queue counts and arrival rates.
-   Predict queue/arrivals at 30 and 60 seconds.
-   Compare against persistence and moving-average baselines.
-   Prevent data leakage: train/test splits must be by simulation
    episode or time block, not random adjacent rows.

### Later model

A GRU or LSTM can be evaluated if the baseline is stable and enough
generated episodes exist. Save:

-   Model version and feature schema.
-   Training scenario IDs and random seeds.
-   Training/validation/test split.
-   Forecast horizon and error metrics (MAE/RMSE).
-   Model artifact path/version.

The predictor informs weights; it does not override the safety
controller.

------------------------------------------------------------------------

## 10. SUMO simulation

Use SUMO to generate controlled scenarios and collect objective traffic
metrics.

### Scenarios

At minimum, create:

1.  Low traffic.
2.  Balanced peak traffic.
3.  One-direction-heavy traffic.
4.  Sudden traffic surge.
5.  Emergency vehicle approach.
6.  Pedestrian crossing demand.
7.  Mixed emergency + pedestrian demand.
8.  Incident/blocked-lane scenario (optional).

Use fixed seeds and repeat each scenario across multiple seeds.

### Metrics

-   Mean and median vehicle waiting time.
-   Mean and maximum queue length.
-   Throughput (vehicles served per simulation interval).
-   Travel time.
-   Emergency response delay within the simulated network.
-   Pedestrian request wait and crossing completion.
-   Number of conflicting green assignments (must be zero).
-   Number of interrupted/violated pedestrian intervals (must be zero).
-   Solver runtime and fallback count.

Use the same traffic demand, route files, simulation horizon, and seed
for each controller comparison.

### SUMO integration

The SUMO adapter should:

1.  Start SUMO in GUI or headless mode.
2.  Connect using TraCI.
3.  Read lane queues, vehicle waiting times, vehicle types, and
    traffic-light state.
4.  Map lane-to-lane connections to the movement registry.
5.  Pass a snapshot to the decision pipeline.
6.  Receive a validated phase decision.
7.  Apply only a valid signal transition.
8.  Collect metrics and close TraCI cleanly.

Keep SUMO-specific code behind an adapter so optimization tests can run
without SUMO installed.

------------------------------------------------------------------------

## 11. Technology stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Traffic simulation                  Eclipse SUMO

  Simulator interface                 Python TraCI

  Core language                       Python 3.11+ (use a tested
                                      environment)

  Quantum circuit                     Qiskit

  Local circuit simulation            Qiskit Aer

  Numerical work                      NumPy, SciPy

  Conflict graph                      NetworkX

  Classical optimization              Custom exact/greedy + simulated
                                      annealing

  Backend API                         FastAPI

  ASGI server                         Uvicorn

  Database                            MongoDB

  MongoDB driver                      PyMongo async API or synchronous
                                      PyMongo in a dedicated worker

  Frontend                            React + TypeScript + Vite

  Styling                             Tailwind CSS

  Charts                              Recharts or another maintained
                                      chart library

  Live updates                        FastAPI WebSocket

  Testing                             pytest, Vitest, Playwright
                                      (optional)

  Version control                     Git
  -----------------------------------------------------------------------

Pin tested dependency versions in lock files after a clean installation.
Do not assume that every newest package release is mutually compatible.

------------------------------------------------------------------------

## 12. Repository structure

``` text
green-wave/
├── README.md
├── .gitignore
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── architecture.md
│   ├── movement-mapping.md
│   ├── safety-model.md
│   └── experiment-protocol.md
├── simulation/
│   ├── networks/
│   │   └── intersection/
│   ├── routes/
│   ├── scenarios/
│   ├── sumo_configs/
│   └── scripts/
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── api/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── simulation/
│   │   ├── prediction/
│   │   ├── optimization/
│   │   ├── safety/
│   │   └── tests/
│   └── scripts/
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── components/
        ├── pages/
        ├── hooks/
        ├── services/
        ├── types/
        └── charts/
```

------------------------------------------------------------------------

## 13. MongoDB data design

MongoDB stores configuration, run metadata, snapshots, solver results,
and aggregated metrics. SUMO remains the simulation engine; MongoDB is
not used as a real-time control loop.

### Collections

#### `experiments`

One document per experiment:

``` json
{
  "_id": "ObjectId",
  "name": "balanced-peak-qaoa-p1",
  "scenario_id": "balanced_peak",
  "seed": 42,
  "status": "completed",
  "controller": "qaoa",
  "qaoa": {
    "p": 1,
    "shots": 2048,
    "optimizer": "COBYLA"
  },
  "config_version": "v1",
  "started_at": "ISODate",
  "completed_at": "ISODate"
}
```

#### `simulation_metrics`

Store time-series metrics in bounded batches, not one MongoDB write per
vehicle per simulation tick:

``` json
{
  "experiment_id": "ObjectId",
  "simulation_time": 120.0,
  "queue_lengths": {"M0": 4, "M1": 2},
  "mean_waiting_time": 18.5,
  "throughput": 36,
  "active_movements": ["M0", "M6"],
  "pedestrian_state": "waiting",
  "emergency_state": "none"
}
```

#### `solver_results`

``` json
{
  "experiment_id": "ObjectId",
  "simulation_time": 120.0,
  "solver": "qaoa",
  "objective_reward": 18.2,
  "qubo_energy": -18.2,
  "bitstring": "100001000000",
  "feasible": true,
  "valid_sample_rate": 0.73,
  "runtime_ms": 145.2,
  "fallback_used": false
}
```

#### `scenario_configs`

Store scenario parameters, demand definitions, pedestrian requests,
emergency routes, and simulation settings.

#### `model_registry`

Store predictor model versions, feature schema, evaluation metrics, and
artifact references. Do not store large model binaries directly in
MongoDB; store them in a file/object store and keep a versioned URI.

### Database rules

-   Use MongoDB ObjectIds consistently in application code and serialize
    them as strings in API responses.
-   Create indexes on `experiment_id`, `scenario_id`, `started_at`, and
    relevant query fields.
-   Add a TTL index only for explicitly temporary telemetry, never for
    experiment records that must be retained.
-   Validate request and document schemas with Pydantic.
-   Store timestamps in UTC.
-   Keep secrets in environment variables.
-   Do not expose MongoDB to the public internet.
-   Use bounded batch writes and retention policies for high-volume
    metrics.

------------------------------------------------------------------------

## 14. Backend API contract

Suggested endpoints:

  Method   Endpoint                          Purpose
  -------- --------------------------------- --------------------------------
  GET      `/health`                         API and database health
  GET      `/api/scenarios`                  List available scenarios
  POST     `/api/experiments`                Create an experiment
  GET      `/api/experiments`                List experiments
  GET      `/api/experiments/{id}`           Experiment details
  POST     `/api/experiments/{id}/start`     Start a simulation run
  POST     `/api/experiments/{id}/stop`      Request graceful stop
  GET      `/api/experiments/{id}/metrics`   Fetch aggregated metrics
  GET      `/api/experiments/{id}/solvers`   Compare solver results
  GET      `/api/config`                     Read active configuration
  PUT      `/api/config`                     Update validated configuration
  WS       `/ws/experiments/{id}`            Stream live read-only updates

### API behaviour

-   Validate every request.
-   Return consistent error objects.
-   A run has explicit states: `queued`, `running`, `stopping`,
    `completed`, `failed`, `cancelled`.
-   Do not run long SUMO/QAOA jobs inside a normal HTTP request handler.
    Use a background worker/process with a job manager.
-   Prevent two runs from controlling the same SUMO instance.
-   The WebSocket is for observation, not direct signal control.
-   Provide pagination for experiment history and metrics.
-   Make start/stop operations idempotent where practical.

------------------------------------------------------------------------

## 15. Frontend requirements

### Dashboard

Show:

-   SUMO junction view or a clear schematic.
-   Current simulation time and run status.
-   Queue length per movement.
-   Current vehicle phase and transition state.
-   Pedestrian request/occupancy state.
-   Emergency vehicle status.
-   Selected solver and latest candidate.
-   Whether the candidate passed validation.
-   Whether fallback was used.

### Experiments page

Allow the user to:

-   Select a scenario and random seed.
-   Select solver: greedy, exact, simulated annealing, QAOA.
-   Configure QAOA depth, shots, and optimizer within safe limits.
-   Start, stop, and inspect runs.
-   Compare metrics across experiments.

### Results page

Compare:

-   Waiting time.
-   Queue length.
-   Throughput.
-   Travel time.
-   Emergency delay.
-   Pedestrian waiting time.
-   Solver runtime.
-   Feasibility and fallback rate.

Display confidence intervals or variation across seeds where
appropriate. Avoid presenting one lucky seed as proof of performance.

### UX safety

Clearly label this as a simulation. Use read-only live state. Do not add
a UI control that sends arbitrary traffic-light states.

------------------------------------------------------------------------

## 16. Environment setup

### Prerequisites

Install:

-   Git.
-   Python 3.11 or later.
-   Node.js LTS and npm.
-   MongoDB Community Server or Docker.
-   Eclipse SUMO and its tools.
-   A compatible C/C++ build toolchain if required by platform packages.

Verify:

``` bash
git --version
python --version
node --version
npm --version
mongosh --version
sumo --version
```

SUMO installation differs by operating system. Follow the official SUMO
installation instructions for your OS. Ensure `SUMO_HOME` is configured
if required by the installed TraCI package.

### Clone project

``` bash
git clone <YOUR_REPOSITORY_URL> green-wave
cd green-wave
```

### Python environment

``` bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

On Windows PowerShell:

``` powershell
.venv\Scripts\Activate.ps1
```

Create `backend/requirements.txt` with tested versions of:

``` text
fastapi
uvicorn[standard]
pydantic
pydantic-settings
pymongo
numpy
scipy
networkx
qiskit
qiskit-aer
pytest
httpx
python-dotenv
```

Install:

``` bash
pip install -r requirements.txt
```

Install the TraCI package compatible with the installed SUMO version.
Prefer the Python tools supplied by the SUMO installation where
available; do not silently mix incompatible SUMO and TraCI versions.

### Frontend

``` bash
cd ../frontend
npm install
npm run dev
```

### MongoDB

For a local MongoDB installation, start the MongoDB service using the
command appropriate to your OS. Alternatively use Docker Compose (see
below).

------------------------------------------------------------------------

## 17. Environment variables

Create `.env` from `.env.example`. Never commit `.env`.

Example `.env.example`:

``` dotenv
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=green_wave
FRONTEND_ORIGIN=http://localhost:5173
SUMO_BINARY=sumo
SUMO_GUI_BINARY=sumo-gui
SIMULATION_STEP_LENGTH=1.0
DEFAULT_QAOA_SHOTS=2048
DEFAULT_QAOA_P=1
```

Validate configuration at application startup. Fail with a clear error
if required settings are missing. Never print database credentials in
logs.

------------------------------------------------------------------------

## 18. Docker Compose for MongoDB

Use Docker for MongoDB first; SUMO can remain installed on the host
during the MVP.

Example `docker-compose.yml`:

``` yaml
services:
  mongodb:
    image: mongo:7
    container_name: green-wave-mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Start:

``` bash
docker compose up -d mongodb
docker compose ps
```

For a shared or production environment, configure MongoDB
authentication, private networking, backups, and access control. Do not
expose port 27017 publicly.

------------------------------------------------------------------------

## 19. Development order

Follow this sequence to reduce integration errors.

### Milestone 1 --- Mathematical core (no SUMO, no UI)

-   Define movement registry.
-   Define and test conflict graph.
-   Implement QUBO energy function.
-   Implement feasibility validator.
-   Implement exact enumeration.
-   Implement greedy MWIS.
-   Add unit tests for known small graphs.

**Exit condition:** exact solver and direct QUBO evaluator pass all
tests.

### Milestone 2 --- QAOA circuit

-   Implement QUBO-to-Ising coefficients.
-   Build parameterized p=1 circuit.
-   Verify cost Hamiltonian on small instances.
-   Run Aer simulation.
-   Decode bitstrings correctly.
-   Add p=2 and p=3.
-   Add COBYLA and optional SPSA.
-   Add valid-sample and fallback handling.

**Exit condition:** circuit energy and classical energy conventions
agree on small test cases.

### Milestone 3 --- Classical benchmark

-   Add simulated annealing.
-   Run all solvers on the same stored instances.
-   Record objective, feasibility, runtime, and seeds.
-   Compare every approximate solver to exact MWIS.

**Exit condition:** reproducible benchmark output.

### Milestone 4 --- SUMO integration

-   Build and validate one junction.
-   Map all twelve movements to lane connections.
-   Verify the signal program and conflict matrix.
-   Read queues and waiting times through TraCI.
-   Apply only phase decisions accepted by the safety controller.
-   Add scenario seeds and metric collection.

**Exit condition:** stable simulation without conflicting green
assignments.

### Milestone 5 --- Pedestrian and emergency safety

-   Add pedestrian demand and occupancy.
-   Add WALK and clearance state machine.
-   Add emergency vehicle routes and safe preemption.
-   Add recovery scheduling and starvation prevention.
-   Test emergency arrival during every pedestrian/signal state.

**Exit condition:** all safety invariants hold across automated
scenarios.

### Milestone 6 --- Prediction

-   Establish moving-average/persistence baselines.
-   Add 30/60-second predictions.
-   Measure forecast error on held-out simulation episodes.
-   Feed predictions into movement weights.

**Exit condition:** predictor is demonstrably better than or
transparently no better than the baseline.

### Milestone 7 --- FastAPI and MongoDB

-   Add settings and database connection lifecycle.
-   Add Pydantic schemas and indexes.
-   Add experiment and metric repositories.
-   Add run manager and worker isolation.
-   Add REST and WebSocket read-only updates.
-   Add integration tests.

**Exit condition:** runs and metrics persist correctly across backend
restarts.

### Milestone 8 --- React dashboard

-   Add scenario selection.
-   Add experiment controls.
-   Add live junction/queue view.
-   Add solver comparison and metric charts.
-   Add error/loading/empty states.

**Exit condition:** a complete demo can be run from the dashboard.

------------------------------------------------------------------------

## 20. Testing strategy

### Unit tests

-   QUBO energy for hand-calculated bitstrings.
-   Ising coefficient conversion.
-   Conflict graph validation.
-   Feasibility validator.
-   Bitstring decoding and endianness.
-   Greedy and exact solver correctness.
-   Phase-state transition rules.
-   Pedestrian clearance cannot be interrupted.
-   Emergency preemption waits for safe transition.
-   MongoDB serialization and schema validation.

### Integration tests

-   Backend connects to MongoDB.
-   Experiment creation and state updates.
-   SUMO starts and closes cleanly.
-   TraCI state maps to the correct movement IDs.
-   Solver timeout triggers fallback.
-   Invalid candidate never reaches the SUMO signal adapter.
-   WebSocket disconnect does not stop a simulation unexpectedly.

### Property/invariant tests

At every simulation step:

1.  No conflicting vehicle movements are simultaneously green.
2.  No vehicle movement conflicting with an active pedestrian crossing
    is green.
3.  Yellow and all-red transition rules are respected.
4.  Pedestrian clearance is not shortened.
5.  Emergency priority never bypasses a safety transition.
6.  Invalid or missing optimizer output cannot cause an unsafe phase.
7.  A deterministic fallback is always available.

### Reproducibility

Every experiment records:

-   Scenario ID and version.
-   SUMO version and network version.
-   Random seed.
-   Movement/conflict configuration version.
-   Weight coefficients and normalization.
-   QUBO penalty.
-   Solver name and version.
-   QAOA p, shots, optimizer, initial parameters, and seed.
-   Predictor model version.
-   Start/end timestamps.

------------------------------------------------------------------------

## 21. Benchmark protocol

For each traffic scenario:

1.  Generate one fixed demand/route set.
2.  Run each controller with the same SUMO seed and simulation horizon.
3.  Repeat over multiple seeds.
4.  Compare greedy, exact, simulated annealing, and QAOA.
5.  Include a conventional fixed-time or actuated baseline if possible.
6.  Report means and variation, not just the best run.
7.  Separate optimization quality from traffic-system performance.

The exact MWIS solution is a reference for the per-decision optimization
instance. It is not necessarily the globally optimal traffic-control
policy over an entire simulated day because the traffic system is
dynamic and signal timing has temporal effects.

Do not claim QAOA is superior unless statistically and operationally
meaningful evidence supports that claim. For a 12-variable instance,
classical exact enumeration is expected to be extremely competitive.

------------------------------------------------------------------------

## 22. Common failure modes and prevention

  -----------------------------------------------------------------------
  Failure                             Prevention
  ----------------------------------- -----------------------------------
  Wrong movement/conflict mapping     Derive from SUMO connections;
                                      review and test the matrix

  QUBO and Ising sign mismatch        Unit-test energy equivalence on all
                                      small bitstrings

  Incorrect Qiskit bit order          Add explicit encode/decode tests

  QAOA returns conflicting movements  Independent validator and safe
                                      fallback

  QAOA appears worse than greedy      Compare same objective and
                                      tune/benchmark honestly

  SUMO/TraCI version mismatch         Match TraCI to installed SUMO

  Long run blocks FastAPI             Use a background worker/process

  MongoDB grows without limit         Batch metrics, index queries,
                                      define retention

  Emergency vehicle interrupts        Non-interruptible
  pedestrian crossing                 crossing/clearance state

  Frontend controls simulator         Route all decisions through backend
  directly                            safety controller

  One random seed looks unusually     Repeat scenarios across fixed seeds
  good                                

  Camera detector misses a pedestrian Keep safety model independent of
                                      detector confidence; test fail-safe
                                      behaviour
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 23. Definition of done

The MVP is complete only when:

-   [ ] One SUMO four-way junction runs repeatably.
-   [ ] Twelve movements are mapped and documented.
-   [ ] Conflict graph is verified and tested.
-   [ ] QUBO and Ising energies match under the documented constant
    offset.
-   [ ] QAOA p=1, p=2, and p=3 run on Aer.
-   [ ] Greedy, exact, and simulated-annealing baselines run.
-   [ ] Every solver result passes through the same feasibility
    validator.
-   [ ] Safe fallback is tested for timeout, exception, and invalid
    output.
-   [ ] Pedestrian crossing intervals cannot be interrupted.
-   [ ] Emergency preemption uses safe transition logic.
-   [ ] SUMO metrics are collected consistently.
-   [ ] MongoDB persists experiments and metrics.
-   [ ] Dashboard displays live state and comparison results.
-   [ ] Repeated-seed benchmarks are available.
-   [ ] Documentation clearly states simulation-only limitations and
    makes no unsupported quantum-advantage claim.

------------------------------------------------------------------------

## 24. Suggested demo flow

1.  Open the dashboard and select a balanced-peak scenario.
2.  Show the SUMO junction and live queues.
3.  Run fixed-time/actuated baseline.
4.  Run greedy and exact MWIS.
5.  Run QAOA p=1, then p=2/p=3.
6.  Show the selected bitstring and conflict-validation result.
7.  Trigger a pedestrian request and show WALK/clearance.
8.  Introduce an emergency vehicle while a crossing is active; show that
    preemption waits for the safe transition.
9.  Compare queue, waiting-time, throughput, and solver metrics.
10. Open experiment history to show the MongoDB-persisted results.

### What to say in the presentation

"GREEN-WAVE evaluates QAOA as a hybrid optimizer for traffic-movement
selection. We compare it against exact and heuristic classical
algorithms on identical QUBO instances. A separate deterministic safety
layer governs pedestrian crossings, emergency preemption, and signal
transitions. Our contribution is the integrated, measurable simulation
and safety-aware decision architecture---not an assumed quantum
speedup."

------------------------------------------------------------------------

## 25. Further reading

-   Eclipse SUMO documentation: https://sumo.dlr.de/docs/
-   SUMO TraCI documentation: https://sumo.dlr.de/docs/TraCI/
-   Qiskit documentation: https://docs.quantum.ibm.com/
-   Qiskit Aer: https://github.com/Qiskit/qiskit-aer
-   MongoDB documentation: https://www.mongodb.com/docs/
-   FastAPI documentation: https://fastapi.tiangolo.com/
-   NetworkX documentation: https://networkx.org/documentation/stable/

------------------------------------------------------------------------

## Final engineering rule

**Never let a quantum or classical optimizer directly command a real
traffic signal.** In this project, SUMO is the simulation environment,
the optimizer proposes movement selections, and the independently tested
safety/phase controller decides what can be applied. Any future physical
deployment would require qualified traffic-engineering review,
applicable standards compliance, hardware-in-the-loop testing, fail-safe
design, and formal authorization.
